import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

// 3D interactive globe for the Map view -- one glowing, pulsing point per
// country/state (sized by beverage count), matching the aggregated
// granularity the app already uses elsewhere rather than per-record pins
// (the underlying data doesn't have reliable per-record coordinates for
// India, and only ~half of world records carry their own lat/lng).
export default function Globe3D({ regions, activeId, onSelect }) {
  const globeRef = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Read live theme colors from CSS custom properties rather than accepting
  // them as props -- re-runs on every render, so a theme toggle (which
  // re-renders the whole tree via App's theme state) picks up the new colors
  // automatically without threading theme through Map/Globe props.
  const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const accentColor = styles?.getPropertyValue('--teal').trim() || '#34D6C4'
  const accentColorDim = styles?.getPropertyValue('--amber').trim() || '#E5AC42'

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const maxCount = useMemo(() => Math.max(1, ...regions.map((r) => r.count)), [regions])

  // htmlElementsData renders real, camera-facing DOM nodes -- globe.gl's
  // default `points` layer draws 3D cylinder bars instead, which look like
  // blocky rectangles from any angle near the globe's horizon. This is what
  // actually produces WarWatch's flat glowing-dot look.
  const pointsData = useMemo(
    () => regions.map((r) => ({ ...r, isActive: r.id === activeId })),
    [regions, activeId]
  )

  const makePointElement = (d) => {
    const el = document.createElement('div')
    const size = 10 + 22 * (d.count / maxCount)
    const color = d.isActive ? accentColor : accentColorDim
    el.className = 'geo-globe-point' + (d.isActive ? ' is-active' : '')
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.setProperty('--point-color', color)
    el.title = `${d.name} — ${d.count} beverage${d.count === 1 ? '' : 's'}`
    el.addEventListener('click', () => onSelect(d.id))
    return el
  }

  // Only the top few regions pulse -- a ring per point would look noisy at
  // 40+ points, so reserve it for the ones actually worth drawing the eye to.
  const ringsData = useMemo(
    () => [...regions].sort((a, b) => b.count - a.count).slice(0, 6),
    [regions]
  )

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView({ lat: 20, lng: 80, altitude: 1.6 }, 0)

    // Default three-globe lighting is tuned for a moody, far-away look;
    // brighten it so continent outlines read clearly without zooming in.
    const scene = globe.scene()
    scene.children
      .filter((c) => c.isAmbientLight || c.isDirectionalLight)
      .forEach((light) => scene.remove(light))
    scene.add(new AmbientLight(0xffffff, 1.4))
    const sun = new DirectionalLight(0xffffff, 0.9)
    sun.position.set(1, 1, 1)
    scene.add(sun)

    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.enableZoom = true
    const stopRotate = () => { controls.autoRotate = false }
    const el = wrapRef.current
    el?.addEventListener('pointerdown', stopRotate, { once: true })
    return () => el?.removeEventListener('pointerdown', stopRotate)
  }, [])

  return (
    <div className="geo-globe-wrap" ref={wrapRef}>
      <Globe
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor={accentColor}
        atmosphereAltitude={0.18}
        htmlElementsData={pointsData}
        htmlLat={(d) => d.lat}
        htmlLng={(d) => d.lng}
        htmlElement={makePointElement}
        ringsData={ringsData}
        ringLat={(d) => d.lat}
        ringLng={(d) => d.lng}
        ringColor={() => accentColor}
        ringMaxRadius={(d) => 2 + 3 * (d.count / maxCount)}
        ringPropagationSpeed={1.2}
        ringRepeatPeriod={(d) => 1800 - 800 * (d.count / maxCount)}
        width={size.width}
        height={size.height}
      />
    </div>
  )
}
