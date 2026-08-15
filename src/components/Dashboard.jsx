import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts'
import CountUp from './CountUp'
import { SkeletonDashboard } from './Skeleton'
import MicrobeNetwork from './MicrobeNetwork'
import { buildMicrobeNetwork } from '../utils/microbeNetwork'
import { classifyMicrobialGroup, parseSeverityLevel } from '../utils/classify'
import { matchStateIds } from '../utils/indiaStates'

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']
const MAX_PIE_SLICES = 7

function parseAlcoholMidpoint(value) {
  if (!value) return null
  const nums = String(value).match(/[\d.]+/g)
  if (!nums || nums.length === 0) return null
  const parsed = nums.map(Number).filter((n) => !Number.isNaN(n))
  if (parsed.length === 0) return null
  return parsed.reduce((a, b) => a + b, 0) / parsed.length
}

// Source data has entries like "Assam (Dima Hasao)" and multi-state composite
// entries like "Goa, Kerala, Tamil Nadu, ...". Strip parenthetical qualifiers
// and split on commas/semicolons so each real state gets counted on its own
// -- otherwise a single messy record turns into an unreadable chart label.
function normalizeStateTokens(rawValue) {
  if (!rawValue) return []
  return rawValue
    .split(/[,;]/)
    .map((token) => token.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)
}

function truncateLabel(label, maxLen = 18) {
  return label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label
}

const FLAVOR_STOPWORDS = new Set([
  'and', 'with', 'from', 'the', 'a', 'an', 'of', 'to', 'in', 'notes', 'note', 'profile',
  'than', 'distinct', 'characteristic', 'outstanding', 'literature', 'mildly', 'mild',
  'slightly', 'more', 'less', 'some', 'trace', 'via', 'due', 'for', 'on', 'is', 'are',
  'not', 'no', 'study', 'studies', 'studied', 'reported', 'described', 'ethnographic',
  'surveys', 'survey', 'data', 'available', 'specific', 'specifically', 'inferred',
  'related', 'comparable', 'sources', 'source', 'documented', 'documentation',
])

function buildFlavorWords(records) {
  const counts = new Map()
  for (const rec of records) {
    const text = `${rec['Taste Profile'] || ''} ${rec['Aroma Description'] || ''}`.toLowerCase()
    const words = text.split(/[^a-z]+/).filter((w) => w.length >= 3 && !FLAVOR_STOPWORDS.has(w))
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 28)
    .map(([text, count]) => ({ text, count }))
}

// Field universe is derived from the records themselves (not hardcoded) so
// completeness stays meaningful if the schema changes or a different
// dataset is loaded.
function buildTopRecords(records, { limit = 8 } = {}) {
  const allKeys = new Set()
  for (const rec of records) {
    for (const k of Object.keys(rec)) {
      if (k === 'id' || k === '_source_file') continue
      allKeys.add(k)
    }
  }
  const totalFields = allKeys.size || 1

  const scored = records.map((rec) => {
    let filled = 0
    for (const k of allKeys) {
      const v = rec[k]
      if (v !== null && v !== undefined && String(v).trim() !== '') filled += 1
    }
    return {
      record: rec,
      pct: Math.round((filled / totalFields) * 100),
      confidence: rec['Data Confidence Level'] || rec['Documentation Level'] || rec['Documentation Status'] || null,
    }
  })

  scored.sort((a, b) => b.pct - a.pct)
  return { rows: scored.slice(0, limit), totalFields }
}

function buildHeatmap(records, getRegionTokens) {
  const stateCounts = {}
  for (const rec of records) {
    for (const state of new Set(getRegionTokens(rec))) {
      stateCounts[state] = (stateCounts[state] || 0) + 1
    }
  }
  const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s)
  const groupOrder = ['Yeast + LAB', 'Yeast-dominant', 'LAB-dominant', 'Mold-yeast-LAB mixed', 'Other / mixed']

  const matrix = topStates.map((state) => {
    const row = { state, cells: groupOrder.map(() => 0) }
    return row
  })
  const stateRowIndex = new Map(topStates.map((s, i) => [s, i]))

  let max = 0
  for (const rec of records) {
    const microbe = rec['Dominant Microbial Group']
    if (!microbe) continue
    const group = classifyMicrobialGroup(microbe)
    const groupIdx = groupOrder.indexOf(group)
    if (groupIdx === -1) continue
    for (const state of new Set(getRegionTokens(rec))) {
      const rowIdx = stateRowIndex.get(state)
      if (rowIdx === undefined) continue
      matrix[rowIdx].cells[groupIdx] += 1
      max = Math.max(max, matrix[rowIdx].cells[groupIdx])
    }
  }

  return { groupOrder, matrix, max, hasData: topStates.length > 0 }
}

function buildNetworkInfo(records) {
  const { nodes, links, genusOrder, otherGenusCount } = buildMicrobeNetwork(records)
  const microbeNodes = nodes.filter((n) => n.kind === 'microbe')
  const beverageNodes = nodes.filter((n) => n.kind === 'beverage')
  const topHub = [...microbeNodes].sort((a, b) => b.count - a.count)[0] || null
  return {
    hubCount: microbeNodes.length,
    beverageCount: beverageNodes.length,
    linkCount: links.length,
    genusCount: genusOrder.length + otherGenusCount,
    topHub: topHub ? { name: topHub.name, count: topHub.count } : null,
  }
}

function computeStats(records) {
  // The two datasets carry geography in different fields (India: free-text
  // "Region / State (typical)" matched against real state names; world data:
  // a clean "Country" field written by the importer). Detect which one this
  // record set uses instead of assuming -- keeps the dashboard working for
  // either without a dataset-name switch.
  const isCountryDataset = records.some((r) => r['Country'])
  const getRegionTokens = isCountryDataset
    ? (rec) => (rec['Country'] ? [rec['Country'].trim()] : [])
    : (rec) => matchStateIds(rec['Region / State (typical)']) // state IDs -- fine for counting, dedupe doesn't need display names
  const getChartRegionTokens = isCountryDataset
    ? getRegionTokens
    : (rec) => normalizeStateTokens(rec['Region / State (typical)'])

  const geoIds = new Set()
  const tribes = new Set()
  let alcoholSum = 0
  let alcoholCount = 0

  const perRegion = {}
  const perFermentType = {}

  for (const rec of records) {
    for (const token of getRegionTokens(rec)) geoIds.add(token)
    for (const token of new Set(getChartRegionTokens(rec))) { // de-dupe within one record
      perRegion[token] = (perRegion[token] || 0) + 1
    }

    const tribe = rec['Tribe / Ethnic Group (major consumers)']
    if (tribe) {
      tribe.split(';').map((t) => t.trim()).filter(Boolean).forEach((t) => tribes.add(t))
    }

    const alcohol = parseAlcoholMidpoint(rec['Alcohol Content (% v/v)'] || rec['Alcohol Content (%)'])
    if (alcohol !== null) {
      alcoholSum += alcohol
      alcoholCount += 1
    }

    const fermType = rec['Fermentation Type'] || rec['Type of Fermentation']
    if (fermType) {
      const key = fermType.split('(')[0].trim() || fermType
      perFermentType[key] = (perFermentType[key] || 0) + 1
    }
  }

  const geoChartData = Object.entries(perRegion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name: truncateLabel(name), fullName: name, count }))

  // Cap the pie to the top N slices; everything else folds into "Other" so
  // the legend stays readable even when the underlying data has 40+ near-
  // duplicate free-text categories.
  const fermentEntries = Object.entries(perFermentType).sort((a, b) => b[1] - a[1])
  const topEntries = fermentEntries.slice(0, MAX_PIE_SLICES)
  const otherCount = fermentEntries.slice(MAX_PIE_SLICES).reduce((sum, [, v]) => sum + v, 0)
  const fermentTypeChartData = [
    ...topEntries.map(([name, value]) => ({ name: truncateLabel(name, 26), fullName: name, value })),
    ...(otherCount > 0 ? [{ name: `Other (${fermentEntries.length - MAX_PIE_SLICES} types)`, fullName: 'Other', value: otherCount }] : []),
  ]

  return {
    total: records.length,
    isCountryDataset,
    geoLabel: isCountryDataset ? 'Countries Covered' : 'States Covered',
    geoChartTitle: isCountryDataset ? 'Beverages by Country' : 'Beverages by State',
    geoChartSub: isCountryDataset ? 'Top 10 countries by number of recorded beverages' : 'Top 10 states by number of recorded beverages',
    geoCount: geoIds.size,
    tribeCount: tribes.size,
    avgAlcohol: alcoholCount > 0 ? (alcoholSum / alcoholCount).toFixed(1) : '—',
    stateChartData: geoChartData,
    fermentTypeChartData,
    topRecords: buildTopRecords(records),
    heatmap: buildHeatmap(records, getChartRegionTokens),
    networkInfo: buildNetworkInfo(records),
    flavorWords: buildFlavorWords(records),
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.05 } }),
}

export default function Dashboard({ records, loading, onSelectRecord, search }) {
  const stats = useMemo(() => computeStats(records), [records])
  const maxFlavorCount = stats.flavorWords[0]?.count ?? 1
  const minFlavorCount = stats.flavorWords[stats.flavorWords.length - 1]?.count ?? 1
  const [selectedNode, setSelectedNode] = useState(null)
  useEffect(() => setSelectedNode(null), [records])

  if (loading) {
    return <SkeletonDashboard />
  }

  if (records.length === 0) {
    return (
      <div className="empty-state">
        {search
          ? `No records match "${search}".`
          : 'No records yet — import your data to see the dashboard.'}
      </div>
    )
  }

  return (
    <div className="dashboard-grid">
      <div className="stat-cards">
        <motion.div className="stat-card accent-teal" custom={0} variants={cardVariants} initial="hidden" animate="show">
          <div className="stat-value"><CountUp value={stats.total} /></div>
          <div className="stat-label">Total Records</div>
        </motion.div>
        <motion.div className="stat-card accent-amber" custom={1} variants={cardVariants} initial="hidden" animate="show">
          <div className="stat-value"><CountUp value={stats.geoCount} /></div>
          <div className="stat-label">{stats.geoLabel}</div>
        </motion.div>
        <motion.div className="stat-card accent-sage" custom={2} variants={cardVariants} initial="hidden" animate="show">
          <div className="stat-value"><CountUp value={stats.tribeCount} /></div>
          <div className="stat-label">Distinct Tribes / Ethnic Groups</div>
        </motion.div>
        <motion.div className="stat-card" custom={3} variants={cardVariants} initial="hidden" animate="show">
          <div className="stat-value"><CountUp value={Number(stats.avgAlcohol) || 0} decimals={1} suffix="%" /></div>
          <div className="stat-label">Avg. Alcohol Content (v/v)</div>
        </motion.div>
      </div>

      <div className="chart-row">
        <div className="chart-card">
          <h3>{stats.geoChartTitle}</h3>
          <div className="chart-sub">{stats.geoChartSub}</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.stateChartData} layout="vertical" margin={{ top: 4, left: 10, right: 32, bottom: 4 }} barCategoryGap="34%">
              <defs>
                <linearGradient id="stateBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                stroke="var(--border)"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={114}
                tick={{ fill: 'var(--text)', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                stroke="var(--border)"
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif' }}
                labelStyle={{ color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}
                cursor={{ fill: 'var(--teal-glow)' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
              />
              <Bar dataKey="count" fill="url(#stateBarGradient)" radius={[0, 6, 6, 0]} maxBarSize={18}>
                <LabelList
                  dataKey="count"
                  position="right"
                  offset={8}
                  style={{ fill: 'var(--text)', fontSize: 11.5, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Fermentation Type Mix</h3>
          <div className="chart-sub">Distribution across recorded fermentation categories</div>
          {stats.fermentTypeChartData.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <ResponsiveContainer width="55%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.fermentTypeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {stats.fermentTypeChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text)' }}
                    itemStyle={{ color: 'var(--text)' }}
                    formatter={(value, _, entry) => [value, entry?.payload?.fullName || '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {stats.fermentTypeChartData.map((entry, i) => (
                  <div className="pie-legend-item" key={`${entry.fullName}-${i}`} title={entry.fullName}>
                    <span className="pie-legend-swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="pie-legend-label">{entry.name}</span>
                    <span className="pie-legend-value">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="loading">Not enough fermentation-type data yet.</div>
          )}
        </div>
      </div>

      <div className="chart-card top-records-card">
        <h3>Most Complete Records</h3>
        <div className="chart-sub">
          Ranked by data completeness across {stats.topRecords.totalFields} tracked fields — a quick way to spot the best-documented entries
        </div>
        <div className="top-records-table-wrap">
          <table className="top-records-table">
            <thead>
              <tr>
                <th>Beverage</th>
                <th>Region</th>
                <th>Confidence</th>
                <th>Completeness</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.topRecords.rows.map(({ record, pct, confidence }) => {
                const severity = parseSeverityLevel(confidence)
                return (
                  <tr key={record.id}>
                    <td className="top-records-name">{record['Beverage Name'] || record.id}</td>
                    <td>{record['Region / State (typical)'] || record['Country'] || '—'}</td>
                    <td>
                      {severity ? (
                        <span className={`confidence-badge confidence-badge-${severity.level}`}>{severity.label}</span>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="completeness-row">
                        <div className="completeness-bar-track">
                          <div className="completeness-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="completeness-pct">{pct}%</span>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => onSelectRecord?.(record)}>View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-row-secondary">
        <div className="chart-card">
          <h3>Microbial Group by {stats.isCountryDataset ? 'Country' : 'State'}</h3>
          <div className="chart-sub">Top 8 {stats.isCountryDataset ? 'countries' : 'states'} × dominant microbial group (count of recorded beverages)</div>
          {stats.heatmap.hasData ? (
            <div className="heatmap-scroll">
              <div
                className="heatmap-grid"
                style={{ gridTemplateColumns: `120px repeat(${stats.heatmap.groupOrder.length}, 1fr)` }}
              >
                <div className="heatmap-corner" />
                {stats.heatmap.groupOrder.map((g) => (
                  <div className="heatmap-col-label" key={g}>{truncateLabel(g, 22)}</div>
                ))}
                {stats.heatmap.matrix.map((row) => (
                  <FragmentRow key={row.state} row={row} max={stats.heatmap.max} />
                ))}
              </div>
            </div>
          ) : (
            <div className="loading">Not enough geographic/microbial data yet.</div>
          )}
        </div>

        <div className="stacked-cards">
          <div className="chart-card">
            <h3>Flavor & Aroma Lexicon</h3>
            <div className="chart-sub">Most common descriptors, sized by frequency</div>
            <div className="flavor-cloud">
              {stats.flavorWords.map((w) => {
                const range = Math.max(1, maxFlavorCount - minFlavorCount)
                const t = (w.count - minFlavorCount) / range
                const fontSize = 11 + t * 15
                const weight = 0.55 + t * 0.45
                return (
                  <span
                    key={w.text}
                    className="flavor-word"
                    style={{ fontSize, '--w': weight.toFixed(2) }}
                    title={`${w.text} · ${w.count} mentions`}
                  >
                    {w.text}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="chart-card">
            <h3>Network at a Glance</h3>
            {selectedNode ? (
              selectedNode.kind === 'microbe' ? (
                <>
                  <div className="chart-sub">Selected hub in the graph below — click it again to clear</div>
                  <div className="network-info-selected-name">{selectedNode.name}</div>
                  <div className="network-info-grid network-info-grid-2">
                    <div className="network-info-stat">
                      <div className="network-info-value"><CountUp value={selectedNode.count} /></div>
                      <div className="network-info-label">Beverages linked</div>
                    </div>
                    <div className="network-info-stat">
                      <div className="network-info-value network-info-value-text">{selectedNode.genus}</div>
                      <div className="network-info-label">Genus</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="chart-sub">Selected beverage in the graph below</div>
                  <div className="network-info-selected-name">{selectedNode.name}</div>
                  {selectedNode.region && (
                    <div className="network-info-highlight">Region: <strong>{selectedNode.region}</strong></div>
                  )}
                </>
              )
            ) : (
              <>
                <div className="chart-sub">Snapshot of the shared-microorganism graph below — click a node to inspect it</div>
                <div className="network-info-grid">
                  <div className="network-info-stat">
                    <div className="network-info-value"><CountUp value={stats.networkInfo.hubCount} /></div>
                    <div className="network-info-label">Microorganism hubs</div>
                  </div>
                  <div className="network-info-stat">
                    <div className="network-info-value"><CountUp value={stats.networkInfo.beverageCount} /></div>
                    <div className="network-info-label">Connected beverages</div>
                  </div>
                  <div className="network-info-stat">
                    <div className="network-info-value"><CountUp value={stats.networkInfo.genusCount} /></div>
                    <div className="network-info-label">Genera represented</div>
                  </div>
                </div>
                {stats.networkInfo.topHub && (
                  <div className="network-info-highlight">
                    Most shared microorganism: <strong>{stats.networkInfo.topHub.name}</strong> — linked to {stats.networkInfo.topHub.count} beverages
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <MicrobeNetwork records={records} onSelectRecord={onSelectRecord} onNodeSelect={setSelectedNode} />
    </div>
  )
}

function FragmentRow({ row, max }) {
  return (
    <>
      <div className="heatmap-row-label">{truncateLabel(row.state, 16)}</div>
      {row.cells.map((count, i) => {
        const alpha = count === 0 ? 0 : 0.12 + (count / max) * 0.7
        return (
          <div
            key={i}
            className={`heatmap-cell ${count === 0 ? 'empty' : ''}`}
            style={{ background: `rgba(var(--chart-teal-rgb), ${alpha})` }}
          >
            {count || '—'}
          </div>
        )
      })}
    </>
  )
}
