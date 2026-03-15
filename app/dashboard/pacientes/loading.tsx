export default function PacientesLoading() {
  return (
    <div style={{ padding: '36px 40px', maxWidth: 1400 }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 200, height: 16, borderRadius: 4 }} />
      </div>

      {/* Card skeleton */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '24px',
          border: '1px solid rgba(58,140,140,0.1)',
          boxShadow: '0 2px 8px rgba(58,140,140,0.06)',
        }}
      >
        {/* Filter bar skeleton */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="skeleton" style={{ width: 320, height: 38, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 200, height: 38, borderRadius: 8 }} />
        </div>

        {/* Table header skeleton */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr',
            gap: 14,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(58,140,140,0.1)',
            marginBottom: 4,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 13, borderRadius: 4, width: '60%' }} />
          ))}
        </div>

        {/* Table rows skeleton */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr',
              gap: 14,
              padding: '14px',
              borderBottom: i < 9 ? '1px solid rgba(58,140,140,0.06)' : 'none',
              alignItems: 'center',
            }}
          >
            <div>
              <div className="skeleton" style={{ height: 15, borderRadius: 4, width: '75%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 12, borderRadius: 4, width: '55%' }} />
            </div>
            <div className="skeleton" style={{ height: 15, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 15, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 15, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 24, borderRadius: 20, width: 110 }} />
            <div className="skeleton" style={{ height: 15, borderRadius: 4 }} />
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
