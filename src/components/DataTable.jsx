import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, Columns3 } from 'lucide-react'
import { onActivateKey } from '../utils/a11y'

const AUTO_COLUMN_COUNT = 6

// Instead of showing the same fixed columns for every row (which produces a
// wall of dashes when a row's data lives in different fields than another
// row's), pick the columns with the best fill-rate across the CURRENT page.
// This means the visible columns actually shift a little page to page --
// intentional, since it's chasing where the real data is.
function pickAutoColumns(records, titleField, fields) {
  const candidates = titleField ? fields.filter((f) => f !== titleField) : fields
  const fillCounts = candidates.map((field) => {
    const filled = records.filter((r) => r[field] !== null && r[field] !== undefined && r[field] !== '').length
    return { field, filled }
  })
  fillCounts.sort((a, b) => b.filled - a.filled)
  const best = fillCounts.slice(0, AUTO_COLUMN_COUNT - (titleField ? 1 : 0)).map((f) => f.field)
  return titleField ? [titleField, ...best] : best
}

function ColumnPickerList({ fields, visibleColumns, toggleColumn }) {
  const scrollRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 8,
  })

  return (
    <div ref={scrollRef} style={{ maxHeight: 260, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const f = fields[item.index]
          return (
            <label
              className="column-picker-item"
              key={f}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)`, height: item.size }}
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(f)}
                onChange={() => toggleColumn(f)}
              />
              {f}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default function DataTable({ records, fields, titleField, onView, onEdit, onDelete }) {
  const [manualColumns, setManualColumns] = useState(null) // null = auto mode
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState(null) // { key, direction }

  const autoColumns = useMemo(
    () => pickAutoColumns(records, titleField, fields),
    [records, titleField, fields]
  )
  const visibleColumns = manualColumns ?? autoColumns

  const sortedRecords = useMemo(() => {
    if (!sortConfig) return records
    const { key, direction } = sortConfig
    return [...records].sort((a, b) => {
      const av = (a[key] ?? '').toString().toLowerCase()
      const bv = (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return direction === 'asc' ? -1 : 1
      if (av > bv) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [records, sortConfig])

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== field) return { key: field, direction: 'asc' }
      if (prev.direction === 'asc') return { key: field, direction: 'desc' }
      return null
    })
  }

  const toggleColumn = (field) => {
    setManualColumns((prev) => {
      const base = prev ?? autoColumns
      return base.includes(field) ? base.filter((f) => f !== field) : [...base, field]
    })
  }

  if (records.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty-state">No records yet. Click "Add Record" to create the first one.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="table-toolbar-row">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
          Showing {visibleColumns.length} of {fields.length} fields — columns auto-selected by data coverage
        </span>
        <div className="column-picker">
          <button className="btn btn-ghost" onClick={() => setPickerOpen((o) => !o)}>
            <Columns3 size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            Columns
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                className="column-picker-panel"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="column-picker-item"
                  style={{ cursor: 'pointer', color: 'var(--teal)' }}
                  onClick={() => setManualColumns(null)}
                >
                  ↺ Reset to auto
                </div>
                <ColumnPickerList fields={fields} visibleColumns={visibleColumns} toggleColumn={toggleColumn} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {visibleColumns.map((f) => (
                <th
                  key={f}
                  onClick={() => handleSort(f)}
                  role="button"
                  tabIndex={0}
                  aria-sort={sortConfig?.key === f ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={onActivateKey(() => handleSort(f))}
                >
                  {f}
                  {sortConfig?.key === f && (
                    <motion.span
                      className="sort-indicator"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ display: 'inline-block' }}
                    >
                      {sortConfig.direction === 'asc'
                        ? <ChevronUp size={11} style={{ verticalAlign: -1 }} />
                        : <ChevronDown size={11} style={{ verticalAlign: -1 }} />}
                    </motion.span>
                  )}
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody key={`${sortConfig?.key ?? ''}-${sortConfig?.direction ?? ''}`} className="tbody-fade">
            {sortedRecords.map((rec) => (
              <tr key={rec.id}>
                {visibleColumns.map((f) => (
                  <td key={f} title={rec[f] ?? ''} className={rec[f] ? '' : 'empty-cell'}>
                    {rec[f] || '—'}
                  </td>
                ))}
                <td className="row-actions">
                  <button onClick={() => onView(rec)}>View</button>
                  <button onClick={() => onEdit(rec)}>Edit</button>
                  <button className="btn-danger" onClick={() => onDelete(rec)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
