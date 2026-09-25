// Tarjetas compartidas del Panel General (KPI y sección).
// ─── KPI Card ────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = '#2f5aae',
  accentBg = '#eef2fb',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: string
  accentBg?: string
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '22px 24px',
        border: '1px solid rgba(47,90,174,0.13)',
        boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: '#272626',
            lineHeight: 1,
            marginBottom: 6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, color: '#4a5870', fontWeight: 500 }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11.5, color: '#8899bb', marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '24px',
        border: '1px solid rgba(47,90,174,0.13)',
        boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#3a4a6b',
          marginBottom: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}
