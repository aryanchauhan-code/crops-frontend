import { useRef, useState } from 'react'
import { indiaMap } from '../utils/indiaStates'
import { onActivateKey } from '../utils/a11y'

export default function IndiaMap({ counts, maxCount, activeId, onSelect }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState(null) // { x, y, name, count }
  const wrapRef = useRef(null)

  const handleMove = (e, loc, count) => {
    const bounds = wrapRef.current?.getBoundingClientRect()
    if (!bounds) return
    setTooltip({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      name: loc.name,
      count,
    })
  }

  return (
    <div className="india-map-wrap" ref={wrapRef}>
      <div className="india-map-grid" aria-hidden="true" />
      <svg viewBox={indiaMap.viewBox} className="india-map-svg" role="img" aria-label="Map of India by state">
        <defs>
          <filter id="state-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {indiaMap.locations.map((loc) => {
          const count = counts[loc.id] || 0
          const t = maxCount > 0 ? count / maxCount : 0
          const isActive = activeId === loc.id
          const isHovered = hoveredId === loc.id
          const interactive = count > 0

          return (
            <path
              key={loc.id}
              d={loc.path}
              className={[
                'india-state',
                count === 0 ? 'is-empty' : '',
                isActive ? 'is-active' : '',
                isHovered ? 'is-hovered' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--t': t }}
              onMouseEnter={() => interactive && setHoveredId(loc.id)}
              onMouseMove={(e) => interactive && handleMove(e, loc, count)}
              onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}
              onClick={() => interactive && onSelect(loc.id)}
              onKeyDown={interactive ? onActivateKey(() => onSelect(loc.id)) : undefined}
              tabIndex={interactive ? 0 : -1}
              role={interactive ? 'button' : undefined}
              aria-label={interactive ? `${loc.name} — ${count} beverage${count === 1 ? '' : 's'}` : loc.name}
            />
          )
        })}
      </svg>

      {tooltip && (
        <div className="india-map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <span className="india-map-tooltip-name">{tooltip.name}</span>
          <span className="india-map-tooltip-count">{tooltip.count} beverage{tooltip.count === 1 ? '' : 's'}</span>
        </div>
      )}

      <div className="india-map-legend">
        <span>Fewer</span>
        <span className="india-map-legend-bar" />
        <span>More</span>
      </div>
    </div>
  )
}
