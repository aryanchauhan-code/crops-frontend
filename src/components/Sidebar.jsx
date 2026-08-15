import { motion } from 'framer-motion'
import { LayoutDashboard, Table2, Map as MapIcon, FlaskConical, X } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { onActivateKey } from '../utils/a11y'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'table', label: 'Records', icon: Table2 },
  { key: 'map', label: 'Map', icon: MapIcon },
]

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 28 } },
}

export default function Sidebar({ view, onChangeView, datasets, activeDataset, onSelectDataset, theme, onToggleTheme, open, onClose }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={16} />
      </button>

      <motion.div
        className="sidebar-brand"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="sidebar-brand-title">
          <motion.span
            initial={{ rotate: -12, scale: 0.85 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            style={{ display: 'inline-flex' }}
          >
            <FlaskConical size={18} color="var(--amber)" />
          </motion.span>
          Fermentation Atlas
        </div>
        <div className="sidebar-brand-sub">Research Data Platform</div>
      </motion.div>

      <div>
        <div className="nav-section-label">View</div>
        <motion.ul className="nav-list" variants={listVariants} initial="hidden" animate="show">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <motion.li
              key={key}
              variants={itemVariants}
              className={`nav-item ${view === key ? 'active' : ''}`}
              onClick={() => onChangeView(key)}
              role="button"
              tabIndex={0}
              aria-current={view === key ? 'page' : undefined}
              onKeyDown={onActivateKey(() => onChangeView(key))}
              style={{ position: 'relative' }}
            >
              {view === key && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="nav-active-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                />
              )}
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={16} />
                {label}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div>
        <div className="nav-section-label">Datasets</div>
        <motion.ul className="dataset-list" variants={listVariants} initial="hidden" animate="show">
          {datasets.map((ds) => (
            <motion.li
              key={ds.name}
              variants={itemVariants}
              className={`dataset-item ${ds.name === activeDataset ? 'active' : ''}`}
              onClick={() => onSelectDataset(ds.name)}
              role="button"
              tabIndex={0}
              aria-current={ds.name === activeDataset ? 'true' : undefined}
              onKeyDown={onActivateKey(() => onSelectDataset(ds.name))}
              whileHover={{ x: 2 }}
            >
              <span>{ds.label}</span>
              <span className="dataset-count">{ds.record_count}</span>
            </motion.li>
          ))}
          {datasets.length === 0 && (
            <li className="dataset-item" style={{ opacity: 0.6 }}>No datasets yet</li>
          )}
        </motion.ul>
      </div>

      <div className="sidebar-footer">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div style={{ marginTop: 10 }}>MongoDB Atlas · FastAPI · React</div>
        <div className="sidebar-footer-hint">Press <kbd>⌘</kbd><kbd>K</kbd> to search</div>
      </div>
    </aside>
  )
}
