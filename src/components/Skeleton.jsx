export function Skeleton({ width = '100%', height = 16, radius = 6, style }) {
  return <div className="skeleton-block" style={{ width, height, borderRadius: radius, ...style }} />
}

export function SkeletonDashboard() {
  return (
    <div className="dashboard-grid" aria-busy="true" aria-label="Loading dashboard">
      <div className="stat-cards">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat-card" key={i}>
            <Skeleton width={70} height={30} />
            <div style={{ marginTop: 10 }}><Skeleton width={100} height={11} /></div>
          </div>
        ))}
      </div>
      <div className="chart-row">
        <div className="chart-card">
          <Skeleton width={160} height={16} />
          <div style={{ marginTop: 8, marginBottom: 20 }}><Skeleton width={220} height={11} /></div>
          <Skeleton height={240} radius={10} />
        </div>
        <div className="chart-card">
          <Skeleton width={160} height={16} />
          <div style={{ marginTop: 8, marginBottom: 20 }}><Skeleton width={220} height={11} /></div>
          <Skeleton height={240} radius={10} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading records" style={{ padding: 18 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <Skeleton width="18%" height={13} />
          <Skeleton width="22%" height={13} />
          <Skeleton width="18%" height={13} />
          <Skeleton width="14%" height={13} />
          <Skeleton width="20%" height={13} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonMap() {
  return (
    <div className="map-shell" aria-busy="true" aria-label="Loading map">
      <Skeleton height="100%" radius={12} />
      <Skeleton height="100%" radius={12} />
    </div>
  )
}
