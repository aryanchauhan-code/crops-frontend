import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import IndiaMap from './IndiaMap'
import { groupRecordsByState } from '../utils/indiaStates'
import { onActivateKey } from '../utils/a11y'

export default function MapView({ records, titleField, onSelectRecord }) {
  const [activeId, setActiveId] = useState(null)

  const { byId, unmatched } = useMemo(() => groupRecordsByState(records), [records])
  const counts = useMemo(() => {
    const c = {}
    for (const [id, group] of byId) c[id] = group.records.length
    return c
  }, [byId])
  const maxCount = Math.max(0, ...Object.values(counts))
  const activeGroup = activeId ? byId.get(activeId) : null

  return (
    <div className="map-shell india-map-shell">
      <IndiaMap counts={counts} maxCount={maxCount} activeId={activeId} onSelect={setActiveId} />

      <div className="map-side-panel">
        <AnimatePresence>
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
              <p>Select a glowing state to see the beverages recorded there.</p>
              <p className="map-side-hint">Brighter states have more recorded beverages.</p>
              {unmatched > 0 && (
                <p className="map-side-warning">
                  {unmatched} record{unmatched === 1 ? '' : 's'} {unmatched === 1 ? "doesn't" : "don't"} name a
                  recognizable state, so {unmatched === 1 ? "it isn't" : "they aren't"} shown here — still visible
                  in Table view.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
