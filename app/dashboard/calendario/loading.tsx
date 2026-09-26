export default function CalendarioLoading() {
  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 260, height: 16, borderRadius: 4 }} />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(58,140,140,0.1)' }}>
        <div className="cal-filtros" style={{ marginBottom: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 38, borderRadius: 8 }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
            ))}
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
