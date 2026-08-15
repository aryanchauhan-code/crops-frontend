import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Quote } from 'lucide-react'
import { classifyCarbSource, classifyMicrobialGroup, classifyEndProduct, parseSeverityLevel } from '../utils/classify'

// Fields this profile knows how to feature. Any dataset carrying at least a
// few of these gets the magazine treatment; everything else falls back to
// the plain field list below -- the backend is schema-flexible across many
// research files, so the profile can't assume this exact shape everywhere.
const PROFILE_FIELDS = [
  'Taste Profile', 'Aroma Description', 'Associated Myths / Beliefs', 'Risk of Knowledge Loss',
  'Carbohydrate Source', 'Dominant Microbial Group', 'Major End Products', 'Fermentation Time (days)',
]

function parseDayRange(value) {
  if (!value) return null
  const nums = String(value).match(/[\d.]+/g)
  if (!nums || nums.length === 0) return null
  const parsed = nums.map(Number).filter((n) => !Number.isNaN(n))
  if (parsed.length === 0) return null
  return { min: Math.min(...parsed), max: Math.max(...parsed) }
}

// parseSeverityLevel's level colors assume "high = bad" (risk, danger). For a
// field where high is GOOD (confidence, quality), flip which color the same
// level maps to so red never means "high confidence."
const INVERT_LEVEL = { high: 'low', moderate: 'moderate', low: 'high' }

function FlowChip({ label, tone }) {
  if (!label) return null
  return <span className={`flow-chip flow-chip-${tone}`}>{label}</span>
}

export default function RecordDetail({ record, titleField, onClose, onEdit }) {
  const [allFieldsOpen, setAllFieldsOpen] = useState(false)
  if (!record) return null

  const title = titleField && record[titleField] ? record[titleField] : record.id
  const entries = Object.entries(record).filter(([k]) => k !== 'id')
  const hasProfile = PROFILE_FIELDS.some((f) => record[f])

  const tribe = record['Tribe / Ethnic Group (major consumers)']
  const region = record['Region / State (typical)'] || record['Province / Region (typical)'] || record['Country']
  const taste = record['Taste Profile']
  const aroma = record['Aroma Description']
  const myths = record['Associated Myths / Beliefs']
  const risk = parseSeverityLevel(record['Risk of Knowledge Loss'])
  const confidence = parseSeverityLevel(record['Data Confidence Level'])
  const dayRange = parseDayRange(record['Fermentation Time (days)'])

  const carb = classifyCarbSource(record['Carbohydrate Source'])
  const microbe = classifyMicrobialGroup(record['Dominant Microbial Group'])
  const product = classifyEndProduct(record['Major End Products'])
  const hasFlow = carb || microbe || product

  const alcohol = record['Alcohol Content (% v/v)'] || record['Alcohol Content (%)']
  const badges = [
    record['Fermentation Type'] || record['Type of Fermentation'],
    alcohol && `${alcohol}% ABV`,
    record['pH (reported range)'] && `pH ${record['pH (reported range)']}`,
  ].filter(Boolean)

  const featuredKeys = new Set([
    titleField, 'Tribe / Ethnic Group (major consumers)', 'Region / State (typical)',
    'Province / Region (typical)', 'Country',
    'Taste Profile', 'Aroma Description', 'Associated Myths / Beliefs', 'Risk of Knowledge Loss',
    'Data Confidence Level', 'Carbohydrate Source', 'Dominant Microbial Group', 'Major End Products',
    'Fermentation Time (days)', 'Fermentation Type', 'Type of Fermentation',
    'Alcohol Content (% v/v)', 'Alcohol Content (%)', 'pH (reported range)',
    'Fermentation Vessel', 'Fermentation Temperature (°C)',
  ])
  const remainingEntries = entries.filter(([k]) => !featuredKeys.has(k))

  return (
    <motion.div
      className="drawer-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="drawer profile-drawer"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      >
        <h2>{title}</h2>
        <div className="drawer-sub">
          {[tribe, region].filter(Boolean).join(' · ') || `Record ID: ${record.id}`}
        </div>

        {badges.length > 0 && (
          <div className="profile-badges">
            {badges.map((b) => <span className="profile-badge" key={b}>{b}</span>)}
          </div>
        )}

        {!hasProfile ? (
          entries.map(([key, value], i) => (
            <motion.div
              className="detail-row"
              key={key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.4) }}
            >
              <div className="k">{key}</div>
              <div className={`v ${value === null || value === '' ? 'empty' : ''}`}>
                {value === null || value === '' ? '—' : String(value)}
              </div>
            </motion.div>
          ))
        ) : (
          <>
            {(taste || aroma) && (
              <div className="profile-quote">
                <Quote size={16} className="profile-quote-icon" />
                <div>
                  {taste && <p>{taste}</p>}
                  {aroma && <p className="profile-quote-aroma">{aroma}</p>}
                </div>
              </div>
            )}

            {hasFlow && (
              <div className="profile-section">
                <div className="profile-section-label">Biochemical flow</div>
                <div className="flow-diagram">
                  <FlowChip label={carb} tone="carb" />
                  {carb && (microbe || product) && <ArrowRight size={14} className="flow-arrow" />}
                  <FlowChip label={microbe} tone="microbe" />
                  {microbe && product && <ArrowRight size={14} className="flow-arrow" />}
                  <FlowChip label={product} tone="product" />
                </div>
                {record['Key Fermentative Enzymes'] && (
                  <div className="profile-note">Key enzymes: {record['Key Fermentative Enzymes']}</div>
                )}
              </div>
            )}

            {dayRange && (
              <div className="profile-section">
                <div className="profile-section-label">Fermentation timeline</div>
                <div className="timeline-track">
                  <motion.div
                    className="timeline-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (dayRange.max / 40) * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
                <div className="timeline-caption">
                  {dayRange.min === dayRange.max ? `${dayRange.min} days` : `${dayRange.min}–${dayRange.max} days`}
                  {record['Fermentation Vessel'] && ` · ${record['Fermentation Vessel']}`}
                  {record['Fermentation Temperature (°C)'] && ` · ${record['Fermentation Temperature (°C)']}°C`}
                </div>
              </div>
            )}

            {myths && (
              <div className="profile-section">
                <div className="profile-section-label">Myths & beliefs</div>
                <blockquote className="profile-blockquote">{myths}</blockquote>
              </div>
            )}

            {(risk || confidence) && (
              <div className="profile-section profile-gauges">
                {risk && (
                  <div className="gauge-block">
                    <div className="profile-section-label">Risk of knowledge loss</div>
                    <div className={`meter-track gauge-track-${risk.level}`}>
                      <motion.div
                        className={`meter-fill gauge-fill-${risk.level}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${risk.pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="timeline-caption">{risk.label}</div>
                  </div>
                )}
                {confidence && (
                  <div className="gauge-block">
                    <div className="profile-section-label">Research confidence</div>
                    <div className={`meter-track gauge-track-${INVERT_LEVEL[confidence.level]}`}>
                      <motion.div
                        className={`meter-fill gauge-fill-${INVERT_LEVEL[confidence.level]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${confidence.pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                      />
                    </div>
                    <div className="timeline-caption">{confidence.label}</div>
                  </div>
                )}
              </div>
            )}

            <div className="profile-section">
              <button className="accordion-toggle" onClick={() => setAllFieldsOpen((o) => !o)}>
                <motion.span animate={{ rotate: allFieldsOpen ? 180 : 0 }} style={{ display: 'inline-flex' }}>
                  <ChevronDown size={14} />
                </motion.span>
                {allFieldsOpen ? 'Hide' : 'Show'} all {entries.length} recorded fields
              </button>
              {allFieldsOpen && remainingEntries.map(([key, value]) => (
                <div className="detail-row" key={key}>
                  <div className="k">{key}</div>
                  <div className={`v ${value === null || value === '' ? 'empty' : ''}`}>
                    {value === null || value === '' ? '—' : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="drawer-actions">
          <button className="btn btn-primary" onClick={() => onEdit(record)}>Edit this record</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
