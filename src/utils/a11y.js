// For elements that must be clickable but aren't natively focusable (li, th,
// div used as a button) -- pair with role="button" tabIndex={0} so Enter/Space
// activates them the same way a click would.
export function onActivateKey(handler) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler(e)
    }
  }
}
