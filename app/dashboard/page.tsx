import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { EstadoPaciente, Paciente, Psicologo } from '@/types/database'
import EstadosChart from './_components/EstadosChart'
import PsicologosChart from './_components/PsicologosChart'
import PacientesTable from './_components/PacientesTable'
import type { PacienteRow } from './_components/PacientesTable'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
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
function Card({ title, children }: { title: string; children: React.ReactNode }) {
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

// ─── Icons ────────────────────────────────────────────────────────────────────
const icons = {
  person: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  sparkle: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  xCircle: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  child: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="5" r="3" />
      <path d="M12 8v6M9 22l3-4 3 4M9 14l-2 8M15 14l2 8" />
    </svg>
  ),
  badge: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ESTADOS: EstadoPaciente[] = [
  'Nuevo paciente',
  'Agendado',
  'Anulado',
  'Sin disponibilidad',
  'En espera',
  'Cambio solicitado',
  'Dudoso',
  'Dudoso contactado',
  'Revisar recomendado',
  'Psicólogo sin disponibilidad',
]

function formatDateES(date: Date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: pacientes }, { data: psicologos }, { data: centros }] =
    await Promise.all([
      supabase.from('pacientes').select('*').order('fecha_incorporacion', { ascending: false }),
      supabase.from('psicologos').select('*'),
      supabase.from('centros').select('*'),
    ])

  const pac = (pacientes ?? []) as Paciente[]
  const psi = (psicologos ?? []) as Psicologo[]
  const centrosList = (centros ?? []) as import('@/types/database').Centro[]

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total = pac.length
  const agendados = pac.filter((p) => p.estado === 'Agendado').length
  const anulados = pac.filter((p) => p.estado === 'Anulado').length
  const tasaAnulacion = total > 0 ? Math.round((anulados / total) * 100) : 0
  const menores = pac.filter((p) => p.es_menor).length
  const psicologosActivos = psi.filter((p) => p.activo).length

  const oneWeekAgo = new Date('2026-03-15')
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const nuevosEstaSemana = pac.filter((p) => {
    if (!p.fecha_incorporacion) return false
    return new Date(p.fecha_incorporacion) >= oneWeekAgo
  }).length

  // ── Chart: estados ────────────────────────────────────────────────────────
  const estadosCounts: Record<string, number> = {}
  pac.forEach((p) => {
    estadosCounts[p.estado] = (estadosCounts[p.estado] ?? 0) + 1
  })
  const estadosData = ESTADOS.map((e) => ({ label: e, value: estadosCounts[e] ?? 0 }))

  // ── Chart: psicólogos ─────────────────────────────────────────────────────
  const psicologosData = psi
    .map((p) => ({
      nombre: p.nombre,
      count: pac.filter((pa) => pa.psicologo_id === p.id).length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // ── Table rows ────────────────────────────────────────────────────────────
  const psicologoMap = Object.fromEntries(psi.map((p) => [p.id, p.nombre]))
  const tableData: PacienteRow[] = pac.slice(0, 50).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono,
    estado: p.estado,
    psicologo_nombre: psicologoMap[p.psicologo_id] ?? 'Sin asignar',
    fecha_cita: p.fecha_cita,
    hora_cita: p.hora_cita,
    es_menor: p.es_menor,
    edad: p.edad,
    fecha_nacimiento: p.fecha_nacimiento,
    consentimiento: p.consentimiento,
    fecha_incorporacion: p.fecha_incorporacion,
  }))

  const today = formatDateES(new Date('2026-03-15'))

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
            fontSize: 26,
            fontWeight: 600,
            color: '#272626',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Panel General
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0, textTransform: 'capitalize' }}>
          {today}
        </p>
        {centrosList.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {centrosList.map((c) => (
              <span
                key={c.id}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: '#eef2fb',
                  color: '#254d99',
                  border: '1px solid rgba(58,140,140,0.2)',
                }}
              >
                {c.nombre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI Grid ── */}
      <div
        className="r-grid-kpi"
        style={{
          gap: 18,
          marginBottom: 24,
        }}
      >
        <KpiCard
          label="Total de Pacientes"
          value={total}
          sub={`${centrosList.length} centro${centrosList.length !== 1 ? 's' : ''}`}
          icon={icons.person}
        />
        <KpiCard
          label="Pacientes Agendados"
          value={agendados}
          sub={total > 0 ? `${Math.round((agendados / total) * 100)}% del total` : undefined}
          icon={icons.calendar}
          accent="#10b981"
          accentBg="#d1fae5"
        />
        <KpiCard
          label="Nuevos Esta Semana"
          value={nuevosEstaSemana}
          sub="Últimos 7 días"
          icon={icons.sparkle}
          accent="#6366f1"
          accentBg="#e0e7ff"
        />
        <KpiCard
          label="Tasa de Anulación"
          value={`${tasaAnulacion}%`}
          sub={`${anulados} anulados en total`}
          icon={icons.xCircle}
          accent={tasaAnulacion > 20 ? '#ef4444' : '#f59e0b'}
          accentBg={tasaAnulacion > 20 ? '#fee2e2' : '#fef3c7'}
        />
        <KpiCard
          label="Pacientes Menores"
          value={menores}
          sub={total > 0 ? `${Math.round((menores / total) * 100)}% del total` : undefined}
          icon={icons.child}
          accent="#8b5cf6"
          accentBg="#f3e8ff"
        />
        <KpiCard
          label="Psicólogos Activos"
          value={psicologosActivos}
          sub={`de ${psi.length} en total`}
          icon={icons.badge}
          accent="#2f5aae"
          accentBg="#eef2fb"
        />
      </div>

      {/* ── Charts ── */}
      <div
        className="r-grid-side"
        style={{
          gap: 18,
          marginBottom: 24,
        }}
      >
        <Card title="Distribución por Estado">
          <EstadosChart data={estadosData} />
        </Card>
        <Card title="Pacientes por Psicólogo">
          <PsicologosChart data={psicologosData} />
        </Card>
      </div>

      {/* ── Table ── */}
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
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Pacientes Recientes
        </h3>
        <p style={{ fontSize: 12, color: '#8899bb', marginBottom: 20 }}>
          Últimos {tableData.length} registros
        </p>
        <PacientesTable pacientes={tableData} />
      </div>
    </div>
  )
}
