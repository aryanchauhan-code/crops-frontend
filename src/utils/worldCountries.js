import worldMap from '@svg-maps/world'

// Our own importer wrote the "Country" field, so values are already clean
// country names -- a direct name lookup is enough (no free-text parsing
// needed like the Indian state matcher has to do).
const NAME_ALIASES = {
  'brunei': 'Brunei Darussalam',
  'palestine': 'Palestinian Territories',
  'timor leste': 'Timor-Leste',
}

const ID_BY_NORMALIZED_NAME = new Map(
  worldMap.locations.map((loc) => [loc.name.toLowerCase(), loc.id])
)

function normalize(name) {
  return name.trim().toLowerCase()
}

export function matchCountryId(rawValue) {
  if (!rawValue) return null
  const key = normalize(rawValue)
  const aliased = NAME_ALIASES[key]
  if (aliased) return ID_BY_NORMALIZED_NAME.get(aliased.toLowerCase()) ?? null
  return ID_BY_NORMALIZED_NAME.get(key) ?? null
}

const COUNTRY_NAME_BY_ID = new Map(worldMap.locations.map((loc) => [loc.id, loc.name]))

// Groups records by their "Country" field. Unlike the Indian state matcher,
// each record belongs to exactly one country (no composite entries here).
export function groupRecordsByCountry(records) {
  const byId = new Map() // id -> { id, name, records: [] }
  let unmatched = 0

  for (const rec of records) {
    const id = matchCountryId(rec['Country'])
    if (!id) {
      unmatched += 1
      continue
    }
    if (!byId.has(id)) {
      byId.set(id, { id, name: COUNTRY_NAME_BY_ID.get(id), records: [] })
    }
    byId.get(id).records.push(rec)
  }

  return { byId, unmatched }
}

export { worldMap }
