import { useEffect, useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Menu } from 'lucide-react'
import { api } from './api/client'
import { useTheme } from './hooks/useTheme'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import DataTable from './components/DataTable'
import MapView from './components/MapView'
import RecordDetail from './components/RecordDetail'
import RecordForm from './components/RecordForm'
import ConfirmDialog from './components/ConfirmDialog'
import CommandPalette from './components/CommandPalette'
import { SkeletonMap, SkeletonTable } from './components/Skeleton'

const PAGE_SIZE = 25

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState('dashboard') // 'dashboard' | 'table' | 'map'
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [datasets, setDatasets] = useState([])
  const [activeDataset, setActiveDataset] = useState(null)

  // Paginated + searched, used by the Records (table) view
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)

  // Full unfiltered dataset, used by Dashboard (stats/charts) and Map (needs
  // every geocoded record, not just one page)
  const [allRecords, setAllRecords] = useState([])
  const [allRecordsLoading, setAllRecordsLoading] = useState(false)

  const [error, setError] = useState(null)

  const [viewingRecord, setViewingRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const activeMeta = datasets.find((d) => d.name === activeDataset)

  const loadDatasets = useCallback(async () => {
    try {
      const data = await api.listDatasets()
      const visible = data.filter((d) => d.name !== 'assam')
      setDatasets(visible)
      if (!activeDataset && visible.length > 0) {
        setActiveDataset(visible[0].name)
      }
    } catch (err) {
      setError('Could not reach the API. Is the backend running?')
    }
  }, [activeDataset])

  const loadRecords = useCallback(async () => {
    if (!activeDataset) return
    setLoading(true)
    setError(null)
    try {
      const [recordsData, fieldsData] = await Promise.all([
        api.listRecords(activeDataset, { page, pageSize: PAGE_SIZE, search }),
        api.getFields(activeDataset),
      ])
      setRecords(recordsData.items)
      setTotal(recordsData.total)
      setFields(fieldsData.fields)
    } catch (err) {
      setError('Failed to load records for this dataset.')
    } finally {
      setLoading(false)
    }
  }, [activeDataset, page, search])

  const loadAllRecords = useCallback(async () => {
    if (!activeDataset) return
    setAllRecordsLoading(true)
    try {
      // Pages through the full dataset rather than assuming it fits in one
      // request -- a single fixed pageSize would silently truncate the data
      // feeding the Dashboard/Map/Network views once the collection outgrows it.
      const pageSize = 2000
      let page = 1
      let all = []
      while (true) {
        const data = await api.listRecords(activeDataset, { page, pageSize })
        all = all.concat(data.items)
        if (all.length >= data.total || data.items.length === 0) break
        page += 1
      }
      setAllRecords(all)
    } catch (err) {
      setError('Failed to load full dataset.')
    } finally {
      setAllRecordsLoading(false)
    }
  }, [activeDataset])

  useEffect(() => { loadDatasets() }, [loadDatasets])
  useEffect(() => { loadRecords() }, [loadRecords])
  useEffect(() => { loadAllRecords() }, [loadAllRecords])

  const handleSelectDataset = (name) => {
    setActiveDataset(name)
    setPage(1)
    setSearch('')
    setSidebarOpen(false)
  }

  const handleChangeView = (v) => {
    setView(v)
    setSidebarOpen(false)
  }

  const handleSave = async (payload) => {
    setSaving(true)
    setFormError(null)
    const wasEditing = Boolean(editingRecord?.id)
    try {
      if (wasEditing) {
        await api.updateRecord(activeDataset, editingRecord.id, payload)
      } else {
        await api.createRecord(activeDataset, payload)
      }
      setEditingRecord(null)
      await Promise.all([loadRecords(), loadDatasets(), loadAllRecords()])
      toast.success(wasEditing ? 'Record updated' : 'Record created')
    } catch (err) {
      const message = err.response?.data?.detail || 'Save failed. Check the backend logs.'
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (record) => setPendingDelete(record)

  const confirmDelete = async () => {
    const record = pendingDelete
    if (!record) return
    setPendingDelete(null)
    try {
      await api.deleteRecord(activeDataset, record.id)
      await Promise.all([loadRecords(), loadDatasets(), loadAllRecords()])
      toast.success('Record deleted')
    } catch (err) {
      toast.error('Delete failed.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Shared by Dashboard and Map -- both work off the full dataset rather
  // than one paginated page, so the same search box narrows what they show.
  const filteredAllRecords = useMemo(
    () => (search ? allRecords.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())) : allRecords),
    [allRecords, search]
  )

  const viewTitles = {
    dashboard: 'Dashboard',
    table: 'Records',
    map: 'Geographic Map',
  }

  const deleteTitle = pendingDelete
    ? (activeMeta?.title_field ? pendingDelete[activeMeta.title_field] : pendingDelete.id)
    : ''

  return (
    <MotionConfig reducedMotion="user">
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
          },
        }}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        datasets={datasets}
        activeDataset={activeDataset}
        onSelectDataset={handleSelectDataset}
        onChangeView={setView}
        records={allRecords}
        titleField={activeMeta?.title_field}
        onViewRecord={setViewingRecord}
      />

    <div className="mobile-topbar">
      <button className="mobile-nav-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <span className="mobile-topbar-title">Fermentation Atlas</span>
    </div>

    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        view={view}
        onChangeView={handleChangeView}
        datasets={datasets}
        activeDataset={activeDataset}
        onSelectDataset={handleSelectDataset}
        theme={theme}
        onToggleTheme={toggleTheme}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-panel">
        <div className="panel-header">
          <div>
            <h1>{activeMeta ? `${activeMeta.label} — ${viewTitles[view]}` : 'Select a dataset'}</h1>
            <div className="subtitle">
              {activeDataset ? `collection: ${activeDataset} · ${activeMeta?.record_count ?? total} records` : 'No dataset selected'}
            </div>
          </div>

          {activeDataset && (
            <div className="toolbar">
              <input
                className="search-input"
                placeholder="Search this dataset…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
              {view !== 'dashboard' && (
                <button className="btn btn-primary" onClick={() => setEditingRecord({})}>
                  + Add Record
                </button>
              )}
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {!activeDataset ? (
          <div className="empty-state">
            No datasets found yet. Import your data with <code>backend/scripts/bulk_import_all.py</code> to get started.
          </div>
        ) : (
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'dashboard' ? (
              <Dashboard records={filteredAllRecords} loading={allRecordsLoading} onSelectRecord={setViewingRecord} search={search} />
            ) : view === 'map' ? (
              allRecordsLoading ? (
                <SkeletonMap />
              ) : (
                <MapView
                  records={filteredAllRecords}
                  titleField={activeMeta?.title_field}
                  onSelectRecord={setViewingRecord}
                />
              )
            ) : loading ? (
              <SkeletonTable />
            ) : (
              <>
                <DataTable
                  records={records}
                  fields={fields}
                  titleField={activeMeta?.title_field}
                  onView={setViewingRecord}
                  onEdit={setEditingRecord}
                  onDelete={handleDelete}
                />
                <div className="pagination">
                  <span>Page {page} of {totalPages}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                    <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>

      <AnimatePresence>
        {viewingRecord && (
          <RecordDetail
            record={viewingRecord}
            titleField={activeMeta?.title_field}
            onClose={() => setViewingRecord(null)}
            onEdit={(rec) => { setViewingRecord(null); setEditingRecord(rec) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingRecord !== null && (
          <RecordForm
            fields={fields}
            initialRecord={editingRecord.id ? editingRecord : null}
            onSave={handleSave}
            onCancel={() => { setEditingRecord(null); setFormError(null) }}
            saving={saving}
            error={formError}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this record?"
        message={`"${deleteTitle}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </MotionConfig>
  )
}
