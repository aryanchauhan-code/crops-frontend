import { useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { LayoutDashboard, Table2, Map as MapIcon, Database, FlaskConical, Search } from 'lucide-react'

export default function CommandPalette({
  open, onOpenChange,
  datasets, activeDataset, onSelectDataset,
  onChangeView,
  records, titleField, onViewRecord,
}) {
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange((o) => !o)
      }
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onOpenChange])

  const recordMatches = useMemo(() => {
    if (!titleField) return []
    return records.filter((r) => r[titleField]).slice(0, 200)
  }, [records, titleField])

  const run = (fn) => {
    fn()
    onOpenChange(false)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="cmdk-root"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <div className="cmdk-input-row">
        <Search size={15} className="cmdk-search-icon" />
        <Command.Input placeholder="Jump to a view, dataset, or record…" />
      </div>
      <Command.List>
        <Command.Empty>No matches.</Command.Empty>

        <Command.Group heading="Views">
          <Command.Item onSelect={() => run(() => onChangeView('dashboard'))}>
            <LayoutDashboard size={15} /> Dashboard
          </Command.Item>
          <Command.Item onSelect={() => run(() => onChangeView('table'))}>
            <Table2 size={15} /> Records table
          </Command.Item>
          <Command.Item onSelect={() => run(() => onChangeView('map'))}>
            <MapIcon size={15} /> Geographic map
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Datasets">
          {datasets.map((ds) => (
            <Command.Item key={ds.name} onSelect={() => run(() => onSelectDataset(ds.name))}>
              <Database size={15} />
              {ds.label}
              <span className="cmdk-hint">{ds.record_count} records</span>
            </Command.Item>
          ))}
        </Command.Group>

        {recordMatches.length > 0 && (
          <Command.Group heading={`Records in ${activeDataset}`}>
            {recordMatches.map((r) => (
              <Command.Item
                key={r.id}
                value={`${r[titleField]} ${r.id}`}
                onSelect={() => run(() => onViewRecord(r))}
              >
                <FlaskConical size={15} />
                {r[titleField]}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  )
}
