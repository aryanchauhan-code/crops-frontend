// Generates a small equirectangular starfield as a data-URL PNG, for
// react-globe.gl's backgroundImageUrl (a real 3D skybox sphere around the
// camera, not a flat CSS background -- stars keep correct parallax as the
// globe rotates). Generated once at runtime instead of shipping a static
// asset for what's just noise.
export function createStarfieldDataUrl(width = 1600, height = 800) {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#00030a'
  ctx.fillRect(0, 0, width, height)

  // A few faint nebula-ish blobs, scattered (not centered) so the sphere
  // doesn't read as having an obvious "seam" when wrapped.
  const nebulae = [
    { color: 'rgba(52, 214, 196, 0.05)' },
    { color: 'rgba(229, 172, 66, 0.035)' },
    { color: 'rgba(90, 140, 255, 0.03)' },
  ]
  for (const { color } of nebulae) {
    const x = Math.random() * width
    const y = Math.random() * height
    const r = width * (0.15 + Math.random() * 0.15)
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  const starCount = Math.round((width * height) / 850)
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const isBright = Math.random() > 0.94
    const r = isBright ? 0.6 + Math.random() * 1.1 : 0.2 + Math.random() * 0.5
    const alpha = isBright ? 0.6 + Math.random() * 0.4 : 0.15 + Math.random() * 0.45
    ctx.beginPath()
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas.toDataURL('image/png')
}
