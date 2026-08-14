import indiaMap from '@svg-maps/india'

// The dataset's "Region / State (typical)" field is free text -- single
// states, comma/slash-separated lists, district names followed by a state,
// or "Throughout X (some qualifier)". Rather than parse it into clean
// tokens, just check whether each known state/UT name appears anywhere in
// the string. That's robust to all of the messy shapes above and never
// double-counts a state within one record (name -> id is deduped via Set).
const STATE_PATTERNS = indiaMap.locations.map((loc) => ({
  id: loc.id,
  name: loc.name,
  pattern: new RegExp(loc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
}))

// Jammu & Kashmir shows up under several regional names in the source data
// that never spell out "Jammu and/& Kashmir" verbatim.
const ALIAS_PATTERNS = [
  { id: 'jk', pattern: /jammu\s*(?:&|and)\s*kashmir|\bkashmir\b|\bladakh\b/i },
]

export function matchStateIds(rawValue) {
  if (!rawValue) return []
  const ids = new Set()
  for (const { id, pattern } of STATE_PATTERNS) {
    if (pattern.test(rawValue)) ids.add(id)
  }
  for (const { id, pattern } of ALIAS_PATTERNS) {
    if (pattern.test(rawValue)) ids.add(id)
  }
  return Array.from(ids)
}

const STATE_NAME_BY_ID = new Map(indiaMap.locations.map((loc) => [loc.id, loc.name]))

// Groups records by every state/UT their region field mentions. A record
// naming several states (composite entries) counts toward each of them --
// consistent with how the dashboard's own state breakdown treats them.
export function groupRecordsByState(records) {
  const byId = new Map() // id -> { id, name, records: [] }
  let unmatched = 0

  for (const rec of records) {
    const ids = matchStateIds(rec['Region / State (typical)'])
    if (ids.length === 0) {
      unmatched += 1
      continue
    }
    for (const id of ids) {
      if (!byId.has(id)) {
        byId.set(id, { id, name: STATE_NAME_BY_ID.get(id), records: [] })
      }
      byId.get(id).records.push(rec)
    }
  }

  return { byId, unmatched }
}

export { indiaMap }
