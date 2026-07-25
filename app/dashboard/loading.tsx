export default function DashboardLoading() {
  return (
    <div className="page-pad" style={{ minHeight: '100vh' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 4 }} />
      </div>

      {/* KPI grid skeleton */}
      <div
        className="r-grid-kpi"
        style={{
          gap: 20,
          marginBottom: 28,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '24px',
              border: '1px solid rgba(58,140,140,0.1)',
            }}
          >
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="r-grid-side" style={{ gap: 20, marginBottom: 28 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '24px',
            border: '1px solid rgba(58,140,140,0.1)',
          }}
        >
          <div className="skeleton" style={{ width: 160, height: 20, borderRadius: 4, marginBottom: 24 }} />
          <div className="skeleton" style={{ width: 220, height: 220, borderRadius: '50%', margin: '0 auto' }} />
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '24px',
            border: '1px solid rgba(58,140,140,0.1)',
          }}
        >
          <div className="skeleton" style={{ width: 200, height: 20, borderRadius: 4, marginBottom: 24 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div className="skeleton" style={{ width: `${55 + i * 7}%`, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '24px',
          border: '1px solid rgba(58,140,140,0.1)',
        }}
      >
        <div className="skeleton" style={{ width: 180, height: 20, borderRadius: 4, marginBottom: 20 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
              gap: 16,
              padding: '14px 0',
              borderBottom: i < 7 ? '1px solid rgba(58,140,140,0.06)' : 'none',
            }}
          >
            <div className="skeleton" style={{ height: 16, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 22, borderRadius: 20, width: 100 }} />
            <div className="skeleton" style={{ height: 16, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 16, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 16, borderRadius: 4, width: 70 }} />
          </div>
        ))}
      </div>

      <style>{`
        .skeleton {
          background: linear-gradient(90deg, #ede9e2 25%, #e4dfd7 50%, #ede9e2 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
