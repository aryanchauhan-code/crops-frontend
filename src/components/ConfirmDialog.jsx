import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
        >
          <motion.div
            className="confirm-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon"><AlertTriangle size={18} /></div>
            <h3>{title}</h3>
            <p>{message}</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
              <button className="btn-danger-solid" onClick={onConfirm}>{confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
