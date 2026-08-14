const MICROBE_FIELDS = [
  'Microorganisms Used (dominant reported)',
  'Major Microorganisms',
  'Dominant Yeasts',
  'Dominant LAB',
  'Other Microbes',
]

// Free-text research fields, several source files merged with inconsistent
// conventions: some list one species per field, others cram a comma-separated
// list into a single semicolon-delimited slot, abbreviate the genus ("L.
// brevis"), or drop in a prose note instead of a species ("Data not available
// in Kerala-specific studies"). This tries to recover real species/genus
// tokens and discard the prose.
const JUNK_PATTERN = /not available|ethnographic|peer-reviewed|described in|assumed based|unclear|unknown|no data|minimal at|n\/a\b/i

// "L." is ambiguous in general, but in this dataset it only ever shows up
// alongside a spelled-out "Lactobacillus" in the same composite list.
const GENUS_ALIASES = {
  'l.': 'Lactobacillus',
  'lactiplantibacillus': 'Lactobacillus', // modern reclassification of L. plantarum et al.
}

function cleanToken(raw) {
  let t = raw
    .replace(/\([^)]*\)/g, '') // "(minor)", "(if exposed to air)", etc.
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(sp\.?|spp\.?)$/i, '') // genus-only mentions -> just the genus
    .replace(/[.,;]+$/, '')
    .trim()

  if (!t || JUNK_PATTERN.test(t)) return null
  if (t.split(' ').length > 6) return null // prose, not a species name

  const [first, ...rest] = t.split(' ')
  const alias = GENUS_ALIASES[first.toLowerCase()]
  if (alias) t = [alias, ...rest].join(' ')

  return t
}

function extractTokens(rawValue) {
  if (!rawValue) return []
  return rawValue
    .split(/[;,]/)
    .map(cleanToken)
    .filter(Boolean)
}

function genusOf(name) {
  const first = name.split(' ')[0]
  // Lowercase generic groups ("wild yeasts", "lactic acid bacteria") read as
  // their own identity rather than a genus fragment.
  return /^[A-Z]/.test(first) ? first : name
}

// Builds a microbe-hub / beverage-node graph: hub nodes are the most
// frequently reported microorganisms (sized by how many beverages report
// them, colored by genus), linked to the beverages that report them.
export function buildMicrobeNetwork(records, { maxHubs = 26 } = {}) {
  const freq = new Map() // name -> count
  const perRecordMicrobes = new Map() // record.id -> Set<name>

  for (const rec of records) {
    const names = new Set()
    for (const field of MICROBE_FIELDS) {
      for (const token of extractTokens(rec[field])) names.add(token)
    }
    if (names.size === 0) continue
    perRecordMicrobes.set(rec.id, names)
    for (const name of names) freq.set(name, (freq.get(name) || 0) + 1)
  }

  const topHubs = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxHubs)
  const hubNames = new Set(topHubs.map(([name]) => name))

  // Fixed categorical order by total prevalence, never re-ranked by a filter
  // -- the 8 highest-volume genera get a hue, everything else is "Other".
  const genusTotals = new Map()
  for (const [name, count] of topHubs) {
    const g = genusOf(name)
    genusTotals.set(g, (genusTotals.get(g) || 0) + count)
  }
  const genusOrder = Array.from(genusTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)
  const genusRank = new Map(genusOrder.map((g, i) => [g, i]))

  const microbeNodes = topHubs.map(([name, count]) => ({
    id: `microbe:${name}`,
    kind: 'microbe',
    name,
    genus: genusOf(name),
    genusRank: genusRank.get(genusOf(name)),
    count,
  }))

  const beverageNodes = []
  const links = []
  for (const rec of records) {
    const names = perRecordMicrobes.get(rec.id)
    if (!names) continue
    const matched = Array.from(names).filter((n) => hubNames.has(n))
    if (matched.length === 0) continue
    beverageNodes.push({ id: `beverage:${rec.id}`, kind: 'beverage', record: rec })
    for (const name of matched) {
      links.push({ source: `beverage:${rec.id}`, target: `microbe:${name}` })
    }
  }

  return {
    nodes: [...microbeNodes, ...beverageNodes],
    links,
    genusOrder: genusOrder.slice(0, 8),
    otherGenusCount: Math.max(0, genusOrder.length - 8),
  }
}
