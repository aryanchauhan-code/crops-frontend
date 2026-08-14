import { useState } from 'react'
import { motion } from 'framer-motion'

const LONG_FIELD_HINTS = ['steps', 'source', 'component', 'remark', 'belief', 'description', 'notes', 'profile', 'gap']

function isLongField(fieldName) {
  const lower = fieldName.toLowerCase()
  return LONG_FIELD_HINTS.some((hint) => lower.includes(hint))
}

export default function RecordForm({ fields, initialRecord, onSave, onCancel, saving, error }) {
  const isEditing = Boolean(initialRecord)

  const buildInitialValues = () => {
    const values = {}
    fields.forEach((f) => {
      values[f] = initialRecord?.[f] ?? ''
    })
    return values
  }

  const [values, setValues] = useState(buildInitialValues)
  const [newFieldName, setNewFieldName] = useState('')
  const [extraFields, setExtraFields] = useState([])

  const handleChange = (field, val) => {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  const handleAddField = () => {
    const name = newFieldName.trim()
    if (!name || fields.includes(name) || extraFields.includes(name)) return
    setExtraFields((prev) => [...prev, name])
    setValues((prev) => ({ ...prev, [name]: '' }))
    setNewFieldName('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Drop empty-string fields on create so we don't pollute Mongo with blank keys;
    // keep them on edit so blanking a field actually clears it.
    const payload = {}
    Object.entries(values).forEach(([k, v]) => {
      if (isEditing || v !== '') payload[k] = v
    })
    onSave(payload)
  }

  const allFields = [...fields, ...extraFields]

  return (
    <motion.div
      className="drawer-backdrop"
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.form
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      >
        <h2>{isEditing ? 'Edit Record' : 'Add Record'}</h2>
        <div className="drawer-sub">
          {isEditing ? `Record ID: ${initialRecord.id}` : 'Fill in what you know — every field is optional.'}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {allFields.map((field) => (
          <div className="field-group" key={field}>
            <label htmlFor={field}>{field}</label>
            {isLongField(field) ? (
              <textarea
                id={field}
                value={values[field] ?? ''}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            ) : (
              <input
                id={field}
                type="text"
                value={values[field] ?? ''}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            )}
          </div>
        ))}

        {!isEditing && (
          <div className="field-group">
            <label>Add a field not listed above</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="e.g. Sensory Panel Score"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <button type="button" className="btn btn-ghost" onClick={handleAddField}>Add</button>
            </div>
          </div>
        )}

        <div className="drawer-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Record'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </motion.form>
    </motion.div>
  )
}
