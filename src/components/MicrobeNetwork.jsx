import { useEffect, useMemo, useRef, useState } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import { buildMicrobeNetwork } from '../utils/microbeNetwork'

const OTHER_COLOR = '#8a94a3'
const CLICK_DRAG_THRESHOLD = 4
const LABEL_PADDING = 3

function microbeRadius(count) {
  return 7 + Math.sqrt(count) * 3.6
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgba([r, g, b], a) {
  return `rgba(${r},${g},${b},${a})`
}

// Canvas fillStyle/strokeStyle need resolved colors, not `var(--x)` strings --
// read the design system's current (theme-aware) values once per theme change
// so the graph always matches the surrounding light/dark dashboard instead of
// carrying its own hardcoded palette.
function readThemeColors() {
  const cs = getComputedStyle(document.documentElement)
  const get = (name) => cs.getPropertyValue(name).trim()
  return {
    text: hexToRgb(get('--text')),
    textMuted: hexToRgb(get('--text-muted')),
    textDim: hexToRgb(get('--text-dim')),
    panel: hexToRgb(get('--panel')),
    chart: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => get(`--chart-${i}`)),
  }
}

export default function MicrobeNetwork({ records, onSelectRecord, onNodeSelect }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const simRef = useRef(null)
  const dimsRef = useRef({ width: 0, height: 0, dpr: 1 })
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const pointerRef = useRef({ mode: null, node: null, startX: 0, startY: 0, moved: 0, lastX: 0, lastY: 0 })
  const hoverIdRef = useRef(null)
  const activeIdRef = useRef(null)
  const colorsRef = useRef(readThemeColors())
  const interactedRef = useRef(false)

  const [tooltip, setTooltip] = useState(null)

  const graph = useMemo(() => buildMicrobeNetwork(records), [records])

  const colorForGenusRank = (rank) => {
    const chart = colorsRef.current.chart
    return rank != null && rank < chart.length ? chart[rank] : OTHER_COLOR
  }

  // ---------- simulation lifecycle ----------
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const nodes = graph.nodes.map((n) => ({ ...n }))
    const links = graph.links.map((l) => ({ ...l }))

    const ctx = canvas.getContext('2d')

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      dimsRef.current = { width: rect.width, height: rect.height, dpr }
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      sim?.force('center', forceCenter(rect.width / 2, rect.height / 2))
      draw()
    }

    const draw = () => {
      const { width, height, dpr } = dimsRef.current
      const { x, y, k } = transformRef.current
      const colors = colorsRef.current
      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(x, y)
      ctx.scale(k, k)

      const activeId = activeIdRef.current
      const hoverId = hoverIdRef.current
      const isolating = Boolean(activeId)
      const linkColor = rgba(colors.textDim, 0.22)
      const linkDim = rgba(colors.textDim, 0.04)
      const beverageColor = rgba(colors.textMuted, 0.55)
      const beverageDim = rgba(colors.textMuted, 0.07)

      // links
      for (const l of links) {
        const s = l.source, t = l.target
        if (typeof s !== 'object' || typeof t !== 'object') continue
        const connected = !isolating || s.id === activeId || t.id === activeId
        ctx.strokeStyle = connected ? linkColor : linkDim
        ctx.lineWidth = 1 / k
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.stroke()
      }

      // beverage dots
      for (const n of nodes) {
        if (n.kind !== 'beverage') continue
        ctx.beginPath()
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = isolating && !connectedToActive(n, activeId) ? beverageDim : beverageColor
        ctx.fill()
      }

      // microbe hubs
      const worldMinX = -x / k, worldMaxX = (width - x) / k
      const labelRects = []
      const sortedBySize = [...nodes].filter((n) => n.kind === 'microbe').sort((a, b) => b.count - a.count)

      // Pass 1: every hub circle, so a later-drawn node never paints over an
      // earlier node's label (which a single combined loop would allow).
      for (const n of nodes) {
        if (n.kind !== 'microbe') continue
        const r = microbeRadius(n.count)
        const dim = isolating && n.id !== activeId
        const color = colorForGenusRank(n.genusRank)
        const isHot = n.id === hoverId || n.id === activeId

        if (isHot) {
          ctx.shadowBlur = 14
          ctx.shadowColor = color
        } else {
          ctx.shadowBlur = 0
        }
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = dim ? rgba(colors.textDim, 0.14) : color
        ctx.globalAlpha = dim ? 0.55 : 1
        ctx.fill()
        if (isHot) {
          ctx.lineWidth = 2.5 / k
          ctx.strokeStyle = rgba(colors.panel, 1)
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      // Pass 2: selective direct labels, biggest hubs first, skipped if
      // they'd collide with an already-placed label or run off the canvas --
      // a name that's cut off or stacked on another is worse than none.
      for (const n of sortedBySize.slice(0, 7)) {
        const dim = isolating && n.id !== activeId
        if (dim) continue
        const r = microbeRadius(n.count)
        ctx.font = `600 ${11 / k}px Inter, sans-serif`
        const textWidth = ctx.measureText(n.name).width
        const halfW = textWidth / 2 + LABEL_PADDING
        const labelX = Math.min(Math.max(n.x, worldMinX + halfW), worldMaxX - halfW)
        const labelY = n.y - r - 6 / k
        const rect = { x0: labelX - halfW, x1: labelX + halfW, y0: labelY - 12 / k, y1: labelY + 4 / k }
        const overlaps = labelRects.some((o) => rect.x0 < o.x1 && rect.x1 > o.x0 && rect.y0 < o.y1 && rect.y1 > o.y0)
        if (overlaps) continue
        labelRects.push(rect)
        ctx.fillStyle = rgba(colors.text, 0.92)
        ctx.textAlign = 'center'
        ctx.fillText(n.name, labelX, labelY)
      }

      ctx.restore()
    }

    function connectedToActive(beverageNode, activeId) {
      return links.some((l) => l.source === beverageNode && l.target?.id === activeId)
    }

    // Frames the settled layout inside the canvas with padding -- a force
    // graph's natural size has no relation to its container, so without this
    // it either floats tiny in a sea of empty space or spills off the edge.
    function fitView() {
      const { width, height } = dimsRef.current
      if (!width || !height) return
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const n of nodes) {
        const r = n.kind === 'microbe' ? microbeRadius(n.count) : 3
        minX = Math.min(minX, n.x - r); maxX = Math.max(maxX, n.x + r)
        minY = Math.min(minY, n.y - r); maxY = Math.max(maxY, n.y + r)
      }
      const graphW = maxX - minX, graphH = maxY - minY
      if (graphW <= 0 || graphH <= 0) return
      const padding = 44
      const k = Math.min((width - padding * 2) / graphW, (height - padding * 2) / graphH, 2)
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      transformRef.current = { k, x: width / 2 - cx * k, y: height / 2 - cy * k }
      draw()
    }

    const sim = forceSimulation(nodes)
      .alphaDecay(0.045)
      .force('link', forceLink(links).id((d) => d.id).distance((l) => microbeRadius(l.target.count) + 42).strength(0.55))
      .force('charge', forceManyBody().strength((d) => (d.kind === 'microbe' ? -340 : -10)))
      .force('collide', forceCollide().radius((d) => (d.kind === 'microbe' ? microbeRadius(d.count) + 12 : 9)).strength(1))
      .force('center', forceCenter(0, 0))
      .on('tick', () => {
        // Keep re-framing to the live bounding box while the layout is still
        // actively spreading/settling -- fitting once at a fixed point in
        // time risks catching a transient wide spread mid-settle, then
        // looking "zoomed out" once the graph relaxes back down. Once the
        // user has taken control (dragged/zoomed), stop overriding them.
        if (!interactedRef.current) fitView()
        else draw()
      })

    simRef.current = { sim, nodes, links }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // Re-read the palette whenever the theme toggle flips data-theme, so the
    // graph never gets stuck showing dark-mode colors on a light page or vice versa.
    const themeObserver = new MutationObserver(() => {
      colorsRef.current = readThemeColors()
      draw()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // ---------- pointer interaction (hand-rolled pan/zoom/drag) ----------
    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const { x, y, k } = transformRef.current
      return { x: (clientX - rect.left - x) / k, y: (clientY - rect.top - y) / k }
    }

    function hitTest(clientX, clientY) {
      const { x: wx, y: wy } = toWorld(clientX, clientY)
      let best = null, bestDist = Infinity
      for (const n of nodes) {
        // Beverage dots draw at radius 3 but hit-test generously -- a 3px
        // target is unclickable once the layout is gently drifting.
        const r = n.kind === 'microbe' ? microbeRadius(n.count) : 9
        const d = Math.hypot(n.x - wx, n.y - wy)
        if (d <= r && d < bestDist) { best = n; bestDist = d }
      }
      return best
    }

    function onMouseDown(e) {
      interactedRef.current = true
      const node = hitTest(e.clientX, e.clientY)
      pointerRef.current = {
        mode: node ? 'drag-node' : 'pan',
        node,
        startX: e.clientX, startY: e.clientY, moved: 0,
        lastX: e.clientX, lastY: e.clientY,
      }
      if (node) {
        sim.alphaTarget(0.25).restart()
        node.fx = node.x
        node.fy = node.y
      }
    }

    function onMouseMove(e) {
      const p = pointerRef.current
      if (p.mode === 'drag-node' && p.node) {
        const { x: wx, y: wy } = toWorld(e.clientX, e.clientY)
        p.node.fx = wx
        p.node.fy = wy
        p.moved += Math.hypot(e.clientX - p.lastX, e.clientY - p.lastY)
        p.lastX = e.clientX; p.lastY = e.clientY
      } else if (p.mode === 'pan') {
        const dx = e.clientX - p.lastX, dy = e.clientY - p.lastY
        transformRef.current = { ...transformRef.current, x: transformRef.current.x + dx, y: transformRef.current.y + dy }
        p.moved += Math.hypot(dx, dy)
        p.lastX = e.clientX; p.lastY = e.clientY
        draw()
      } else {
        const node = hitTest(e.clientX, e.clientY)
        const id = node?.id ?? null
        if (id !== hoverIdRef.current) {
          hoverIdRef.current = id
          draw()
        }
        canvas.style.cursor = node ? 'pointer' : 'grab'
        if (node) {
          const rect = wrap.getBoundingClientRect()
          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            name: node.kind === 'microbe' ? node.name : (node.record['Beverage Name'] || 'Beverage'),
            sub: node.kind === 'microbe' ? `${node.count} beverage${node.count === 1 ? '' : 's'}` : node.record['Region / State (typical)'] || '',
          })
        } else {
          setTooltip(null)
        }
      }
    }

    function onMouseUp() {
      const p = pointerRef.current
      if (p.mode === 'drag-node' && p.node) {
        sim.alphaTarget(0)
        p.node.fx = null
        p.node.fy = null
        if (p.moved < CLICK_DRAG_THRESHOLD) {
          if (p.node.kind === 'microbe') {
            const next = activeIdRef.current === p.node.id ? null : p.node.id
            activeIdRef.current = next
            onNodeSelect?.(next ? { kind: 'microbe', name: p.node.name, genus: p.node.genus, count: p.node.count } : null)
          } else {
            onSelectRecord?.(p.node.record)
            onNodeSelect?.({
              kind: 'beverage',
              name: p.node.record['Beverage Name'] || 'Beverage',
              region: p.node.record['Region / State (typical)'] || null,
              record: p.node.record,
            })
          }
        }
      } else if (p.mode === 'pan' && p.moved < CLICK_DRAG_THRESHOLD && activeIdRef.current) {
        activeIdRef.current = null
        onNodeSelect?.(null)
      }
      pointerRef.current = { mode: null, node: null, startX: 0, startY: 0, moved: 0, lastX: 0, lastY: 0 }
      draw()
    }

    function onWheel(e) {
      e.preventDefault()
      interactedRef.current = true
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const { x, y, k } = transformRef.current
      const factor = Math.exp(-e.deltaY * 0.001)
      const nextK = Math.min(4, Math.max(0.35, k * factor))
      const nx = cx - (cx - x) * (nextK / k)
      const ny = cy - (cy - y) * (nextK / k)
      transformRef.current = { x: nx, y: ny, k: nextK }
      draw()
    }

    function onMouseLeave() {
      if (pointerRef.current.mode === 'drag-node' && pointerRef.current.node) {
        pointerRef.current.node.fx = null
        pointerRef.current.node.fy = null
        sim.alphaTarget(0)
      }
      pointerRef.current = { mode: null, node: null, startX: 0, startY: 0, moved: 0, lastX: 0, lastY: 0 }
      hoverIdRef.current = null
      setTooltip(null)
      canvas.style.cursor = 'default'
      draw()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mouseleave', onMouseLeave)

    return () => {
      ro.disconnect()
      themeObserver.disconnect()
      sim.stop()
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [graph, onSelectRecord, onNodeSelect])

  return (
    <div className="chart-card microbe-network-card">
      <h3>Shared Microorganism Network</h3>
      <div className="chart-sub">
        How recorded beverages cluster by shared microorganism — drag to rearrange, scroll to zoom, click a hub to isolate it, click a beverage dot to open its record.
      </div>

      <div className="microbe-network-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="microbe-network-canvas" />

        {tooltip && (
          <div className="microbe-network-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <span className="microbe-network-tooltip-name">{tooltip.name}</span>
            {tooltip.sub && <span className="microbe-network-tooltip-sub">{tooltip.sub}</span>}
          </div>
        )}
      </div>

      <div className="microbe-network-legend">
        {graph.genusOrder.map((genus, i) => (
          <div className="sankey-tier-legend-item" key={genus}>
            <span className="sankey-tier-swatch" style={{ background: colorForGenusRank(i) }} />
            {genus}
          </div>
        ))}
        {graph.otherGenusCount > 0 && (
          <div className="sankey-tier-legend-item">
            <span className="sankey-tier-swatch" style={{ background: OTHER_COLOR }} />
            +{graph.otherGenusCount} other genera
          </div>
        )}
      </div>
    </div>
  )
}
