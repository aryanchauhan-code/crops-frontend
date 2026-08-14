import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.span
        className="theme-toggle-track"
        animate={{ backgroundColor: isDark ? 'var(--panel-hover)' : 'var(--amber-glow)' }}
      >
        <motion.span
          className="theme-toggle-thumb"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ marginLeft: isDark ? 2 : 22 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="moon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex' }}
              >
                <Moon size={12} />
              </motion.span>
            ) : (
              <motion.span
                key="sun"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex' }}
              >
                <Sun size={12} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      </motion.span>
      <span className="theme-toggle-label">{isDark ? 'Dark' : 'Light'} mode</span>
    </button>
  )
}
