import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Globe3D from './Globe3D'
import { groupRecordsByState } from '../utils/indiaStates'
import { groupRecordsByCountry } from '../utils/worldCountries'
import { INDIA_STATE_CENTROIDS } from '../utils/indiaCentroids'
import { WORLD_COUNTRY_CENTROIDS } from '../utils/worldCentroids'
import { onActivateKey } from '../utils/a11y'

export default function MapView({ records, titleField, onSelectRecord }) {
  const [activeId, setActiveId] = useState(null)

  // Datasets carry different geography fields ("Region / State (typical)"
  // for India, "Country" for the international collection) -- detect which
  // one this dataset uses from the records themselves rather than assuming.
  const isCountryDataset = useMemo(() => records.some((r) => r['Country']), [records])
  const unitWord = isCountryDataset ? 'country' : 'state'
  const unitWordPlural = isCountryDataset ? 'countries' : 'states'

  const { byId, unmatched } = useMemo(
    () => (isCountryDataset ? groupRecordsByCountry(records) : groupRecordsByState(records)),
    [records, isCountryDataset]
  )
  const centroids = isCountryDataset ? WORLD_COUNTRY_CENTROIDS : INDIA_STATE_CENTROIDS
  const regions = useMemo(() => {
    const out = []
    for (const [id, group] of byId) {
      const centroid = centroids[id]
      if (!centroid) continue // no known coordinate for this id -- skip rather than plot at (0,0)
      out.push({ id, name: group.name, count: group.records.length, lat: centroid[0], lng: centroid[1] })
    }
    return out
  }, [byId, centroids])
  const activeGroup = activeId ? byId.get(activeId) : null

  return (
    <div className="map-shell geo-map-shell">
      <Globe3D
        regions={regions}
        activeId={activeId}
        onSelect={setActiveId}
        geoType={isCountryDataset ? 'country' : 'state'}
      />

      <div className="map-side-panel">
        <AnimatePresence mode="wait">
          {activeGroup ? (
            <motion.div
              key={activeGroup.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <h3>{activeGroup.name}</h3>
              <div className="map-side-sub">
                {activeGroup.records.length} beverage{activeGroup.records.length === 1 ? '' : 's'} recorded here
              </div>
              <ul className="map-record-list">
                {activeGroup.records.map((rec) => (
                  <li
                    key={rec.id}
                    onClick={() => onSelectRecord(rec)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={onActivateKey(() => onSelectRecord(rec))}
                  >
                    <span className="map-record-name">
                      {titleField && rec[titleField] ? rec[titleField] : rec.id}
                    </span>
                    {rec['Tribe / Ethnic Group (major consumers)'] && (
                      <span className="map-record-meta">{rec['Tribe / Ethnic Group (major consumers)']}</span>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="map-side-empty"
            >
              <p>Select a glowing {unitWord} to see the beverages recorded there.</p>
              <p className="map-side-hint">Brighter {unitWordPlural} have more recorded beverages.</p>
              {unmatched > 0 && (
                <p className="map-side-warning">
                  {unmatched} record{unmatched === 1 ? '' : 's'} {unmatched === 1 ? "doesn't" : "don't"} name a
                  recognizable {unitWord}, so {unmatched === 1 ? "it isn't" : "they aren't"} shown here — still
                  visible in Table view.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
