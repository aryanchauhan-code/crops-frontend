import { useEffect, useRef, useState } from 'react'

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)

export default function CountUp({ value, duration = 900, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = Number(value) || 0
    if (from === to) return
    let raf
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = easeOutQuint(t)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display.toFixed(decimals)}{suffix}</>
}
