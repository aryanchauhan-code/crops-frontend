import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

const BORDERS_URL = {
  country: '/data/world-country-borders.json',
  state: '/data/india-state-borders.json',
}

const EARTH_TEXTURE_URL = '/textures/earth-night.jpg'
const EARTH_BUMP_URL = '/textures/earth-topology.png'

function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/.{1,2}/g)
  if (!m) return [52, 214, 196]
  return m.map((h) => parseInt(h, 16))
}

// 3D interactive globe for the Map view. Countries/states are rendered as
// actual shaded polygons (colored by beverage count), the same way the old
// 2D choropleth worked, so the geography reads as an actual map rather than
// a scatter of disconnected dots. A small glowing marker + pulse ring is
// layered on top of the highest-count regions as an accent, matching
// WarWatch's combined "shaded region + hotspot glow" look.
export default function Globe3D({ regions, activeId, onSelect, geoType }) {
  const globeRef = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [borders, setBorders] = useState(null)

  const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const accentColor = styles?.getPropertyValue('--teal').trim() || '#34D6C4'
  const accentColorDim = styles?.getPropertyValue('--amber').trim() || '#E5AC42'
  const accentRgb = useMemo(() => hexToRgb(accentColor), [accentColor])

  useEffect(() => {
    let cancelled = false
    setBorders(null)
    fetch(BORDERS_URL[geoType])
      .then((r) => r.json())
      .then((geojson) => { if (!cancelled) setBorders(geojson.features) })
      .catch(() => { if (!cancelled) setBorders([]) })
    return () => { cancelled = true }
  }, [geoType])

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

  const regionById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])
  const maxCount = useMemo(() => Math.max(1, ...regions.map((r) => r.count)), [regions])

  const polygons = useMemo(() => {
    if (!borders) return []
    return borders.map((feature) => {
      const id = feature.properties.id
      const region = regionById.get(id)
      return { feature, id, name: region?.name || feature.properties.name, count: region?.count || 0 }
    })
  }, [borders, regionById])

  const capColor = (d) => {
    const t = d.count / maxCount
    const isActive = d.id === activeId
    const alpha = d.count === 0 ? 0.05 : 0.18 + 0.62 * t
    const [r, g, b] = accentRgb
    return isActive ? accentColorDim : `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Glowing point + pulse ring only for the top regions -- with shaded
  // polygons doing the main work, markers are now just an accent instead of
  // the only way to see where the data is.
  const topRegions = useMemo(
    () => [...regions].sort((a, b) => b.count - a.count).slice(0, 8),
    [regions]
  )
  const pointsData = useMemo(
    () => topRegions.map((r) => ({ ...r, isActive: r.id === activeId })),
    [topRegions, activeId]
  )
  const makePointElement = (d) => {
    const el = document.createElement('div')
    const size = 8 + 14 * (d.count / maxCount)
    const color = d.isActive ? accentColorDim : accentColor
    el.className = 'geo-globe-point' + (d.isActive ? ' is-active' : '')
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.setProperty('--point-color', color)
    el.title = `${d.name} — ${d.count} beverage${d.count === 1 ? '' : 's'}`
    el.addEventListener('click', () => onSelect(d.id))
    return el
  }
  const ringsData = useMemo(() => topRegions.slice(0, 6), [topRegions])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView({ lat: 20, lng: 80, altitude: 1.6 }, 0)

    const scene = globe.scene()
    scene.children
      .filter((c) => c.isAmbientLight || c.isDirectionalLight)
      .forEach((light) => scene.remove(light))
    scene.add(new AmbientLight(0xffffff, 1.4))
    const sun = new DirectionalLight(0xffffff, 0.9)
    sun.position.set(1, 1, 1)
    scene.add(sun)

    // Cap the renderer's pixel ratio -- letting three.js render at a raw
    // 3x/4x devicePixelRatio (common on modern laptop/Retina screens) costs
    // far more GPU work than the visual gain is worth and is the main cause
    // of stutter while rotating/zooming. 2x keeps text/edges crisp without
    // the extra cost.
    const renderer = globe.renderer()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.enableZoom = true
    const stopRotate = () => { controls.autoRotate = false }
    const el = wrapRef.current
    el?.addEventListener('pointerdown', stopRotate, { once: true })
    return () => el?.removeEventListener('pointerdown', stopRotate)
  }, [geoType]) // re-run against the new Globe instance -- key={geoType} on <Globe> remounts it

  return (
    <div className="geo-globe-wrap" ref={wrapRef}>
      <Globe
        key={geoType}
        ref={globeRef}
        rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        globeImageUrl={EARTH_TEXTURE_URL}
        bumpImageUrl={EARTH_BUMP_URL}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor={accentColor}
        atmosphereAltitude={0.18}
        polygonsData={polygons}
        polygonGeoJsonGeometry={(d) => d.feature.geometry}
        polygonCapColor={capColor}
        polygonSideColor={() => 'rgba(0, 0, 0, 0.15)'}
        polygonStrokeColor={() => accentColor}
        polygonAltitude={(d) => (d.id === activeId ? 0.02 : 0.006 + 0.02 * (d.count / maxCount))}
        polygonLabel={(d) => `<div class="geo-globe-tooltip"><b>${d.name}</b><br/>${d.count} beverage${d.count === 1 ? '' : 's'}</div>`}
        onPolygonClick={(d) => d.count > 0 && onSelect(d.id)}
        polygonsTransitionDuration={200}
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
