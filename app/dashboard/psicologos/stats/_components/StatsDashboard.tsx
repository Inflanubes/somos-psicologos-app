'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import MotivosChart from './MotivosChart'
import BloqueosBarChart from './BloqueosBarChart'

export type PeriodKey = 'this_month' | 'last_30' | 'last_90' | 'all'

export type PsicologoLite = { id: string; nombre: string; centro: string }

export type CentroLite = { id: string; nombre: string }

export type MotivoCounts = {
  'Asuntos propios': number
  Vacaciones: number
  'Baja laboral': number
  Otros: number
}

export type PerPsicologoRow = {
  id: string
  nombre: string
  centro: string
  citas: number
  bloqueos: number
  vacaciones: number
  asuntos_propios: number
  baja_laboral: number
}

export type AccionRecent = {
  id: string
  accion: string
  motivo_bloqueo: string | null
  creado_en: string | null
  paciente_iniciales: string | null
  fecha_cita: string | null
  hora_cita: string | null
  fecha_bloqueo_inicio: string | null
  fecha_bloqueo_fin: string | null
}

type Kpis = {
  psicologosActivos: number
  psicologosTotal: number
  bloqueosTotal: number
  vacaciones: number
  asuntosPropios: number
  bajaLaboral: number
  citasTotal: number
}

interface Props {
  period: PeriodKey
  periodOptions: { key: PeriodKey; label: string }[]
  psicologosLite: PsicologoLite[]
  centrosLite: CentroLite[]
  selectedCentroId: string | null
  selectedPsicologoId: string | null
  selectedDetail: {
    id: string
    nombre: string
    centro: string
    calendar_id: string | null
    activo: boolean
  } | null
  kpis: Kpis
  motivoCounts: MotivoCounts
  topBloqueosChart: { nombre: string; count: number }[]
  perPsicologoRows: PerPsicologoRow[]
  recentActions: AccionRecent[]
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const icons = {
  badge: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  lock: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  sun: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  briefcase: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  health: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  person: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

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
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, color: '#4a5870', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#8899bb', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Card({
  title,
  children,
  right,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: 24,
        border: '1px solid rgba(47,90,174,0.13)',
        boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#3a4a6b',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function splitNombreModalidad(nombre: string): { name: string; modalidad: string | null } {
  const idx = nombre.lastIndexOf(' - ')
  if (idx === -1) return { name: nombre, modalidad: null }
  return { name: nombre.slice(0, idx), modalidad: nombre.slice(idx + 3) }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const ACCION_STYLE: Record<string, { bg: string; color: string }> = {
  'Bloquear agenda': { bg: '#fef3c7', color: '#92400e' },
  'Desbloquear agenda': { bg: '#d1fae5', color: '#065f46' },
  'Agendar cita': { bg: '#e0e7ff', color: '#3730a3' },
  'Cancelar cita': { bg: '#fee2e2', color: '#991b1b' },
  'Cambiar cita': { bg: '#f3e8ff', color: '#6b21a8' },
}

export default function StatsDashboard({
  period,
  periodOptions,
  psicologosLite,
  centrosLite,
  selectedCentroId,
  selectedPsicologoId,
  selectedDetail,
  kpis,
  motivoCounts,
  topBloqueosChart,
  perPsicologoRows,
  recentActions,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function navigate(next: {
    period?: PeriodKey
    psi?: string | null
    centro?: string | null
  }) {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next.period !== undefined) sp.set('period', next.period)
    if (next.centro === null) sp.delete('centro')
    else if (next.centro !== undefined) sp.set('centro', next.centro)
    if (next.psi === null) sp.delete('psi')
    else if (next.psi !== undefined) sp.set('psi', next.psi)
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`)
    })
  }

  // Changing centro clears the psicólogo filter so we never show "psicólogo X in centro Y"
  // when X doesn't actually belong to Y.
  function onCentroChange(value: string) {
    const nextCentro = value === 'all' ? null : value
    navigate({ centro: nextCentro, psi: null })
  }

  const isAll = !selectedPsicologoId
  const periodLabel = periodOptions.find((p) => p.key === period)?.label ?? ''
  const isCentroFiltered = !!selectedCentroId
  const anyFilterActive = isCentroFiltered || !!selectedPsicologoId

  const selectedNombreSplit = selectedDetail ? splitNombreModalidad(selectedDetail.nombre) : null

  return (
    <div className="page-pad" style={{ maxWidth: 1400, opacity: isPending ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
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
          Estadísticas Psicólogos
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Bloqueos de agenda, motivos y actividad por psicólogo
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: '#ffffff',
          padding: '14px 18px',
          borderRadius: 12,
          border: '1px solid rgba(47,90,174,0.13)',
          boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Período
          </label>
          <select
            value={period}
            onChange={(e) => navigate({ period: e.target.value as PeriodKey })}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(47,90,174,0.2)',
              background: '#f4f5f7',
              fontSize: 13,
              color: '#272626',
              outline: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
              minWidth: 170,
            }}
          >
            {periodOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Centro
          </label>
          <select
            value={selectedCentroId ?? 'all'}
            onChange={(e) => onCentroChange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(47,90,174,0.2)',
              background: '#f4f5f7',
              fontSize: 13,
              color: '#272626',
              outline: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
              minWidth: 180,
            }}
          >
            <option value="all">Todos los centros</option>
            {centrosLite.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Psicólogo
          </label>
          <select
            value={selectedPsicologoId ?? 'all'}
            onChange={(e) => navigate({ psi: e.target.value === 'all' ? null : e.target.value })}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(47,90,174,0.2)',
              background: '#f4f5f7',
              fontSize: 13,
              color: '#272626',
              outline: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
              minWidth: 220,
              maxWidth: 320,
            }}
          >
            <option value="all">
              {isCentroFiltered ? 'Todos los del centro' : 'Todos los psicólogos'}
            </option>
            {psicologosLite.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {anyFilterActive && (
          <button
            onClick={() => navigate({ centro: null, psi: null })}
            style={{
              marginLeft: 'auto',
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid rgba(47,90,174,0.2)',
              background: '#eef2fb',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#2f5aae',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── KPI Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 18,
          marginBottom: 24,
        }}
      >
        {isAll ? (
          <KpiCard
            label="Psicólogos Activos"
            value={kpis.psicologosActivos}
            sub={`de ${kpis.psicologosTotal} en total`}
            icon={icons.badge}
            accent="#2f5aae"
            accentBg="#eef2fb"
          />
        ) : (
          <KpiCard
            label="Psicólogo seleccionado"
            value={selectedNombreSplit?.name ?? '—'}
            sub={selectedDetail?.centro ?? undefined}
            icon={icons.person}
            accent="#2f5aae"
            accentBg="#eef2fb"
          />
        )}
        <KpiCard
          label="Bloqueos totales"
          value={kpis.bloqueosTotal}
          sub={periodLabel}
          icon={icons.lock}
          accent="#f59e0b"
          accentBg="#fef3c7"
        />
        <KpiCard
          label="Vacaciones"
          value={kpis.vacaciones}
          sub="Bloqueos por vacaciones"
          icon={icons.sun}
          accent="#10b981"
          accentBg="#d1fae5"
        />
        <KpiCard
          label="Asuntos propios"
          value={kpis.asuntosPropios}
          sub="Bloqueos personales"
          icon={icons.briefcase}
          accent="#6366f1"
          accentBg="#e0e7ff"
        />
        <KpiCard
          label="Baja laboral"
          value={kpis.bajaLaboral}
          sub="Bloqueos por baja"
          icon={icons.health}
          accent="#ef4444"
          accentBg="#fee2e2"
        />
        <KpiCard
          label="Citas agendadas"
          value={kpis.citasTotal}
          sub={periodLabel}
          icon={icons.calendar}
          accent="#0ea5e9"
          accentBg="#e0f2fe"
        />
      </div>

      {/* ── Charts row ── */}
      <div
        className={isAll ? 'r-grid-side' : undefined}
        style={{
          display: 'grid',
          gap: 18,
          marginBottom: 24,
        }}
      >
        <Card title="Motivos de bloqueo">
          <MotivosChart data={motivoCounts} />
        </Card>
        {isAll && (
          <Card title="Bloqueos por psicólogo (top 10)">
            <BloqueosBarChart data={topBloqueosChart} />
          </Card>
        )}
      </div>

      {/* ── Per psicólogo table OR detail card ── */}
      {isAll ? (
        <Card
          title="Detalle por psicólogo"
          right={
            <span style={{ fontSize: 12, color: '#8899bb' }}>
              {perPsicologoRows.length} psicólogos · clic para filtrar
            </span>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(47,90,174,0.12)' }}>
                  {['Psicólogo', 'Centro', 'Citas', 'Bloqueos', 'Vacaciones', 'Asuntos propios', 'Baja laboral'].map(
                    (h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i >= 2 ? 'right' : 'left',
                          padding: '10px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#667799',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {perPsicologoRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: '40px 12px',
                        textAlign: 'center',
                        color: '#a0b0cc',
                        fontSize: 14,
                      }}
                    >
                      Sin datos en este período
                    </td>
                  </tr>
                ) : (
                  perPsicologoRows.map((r, i) => {
                    const { name, modalidad } = splitNombreModalidad(r.nombre)
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate({ psi: r.id })}
                        style={{
                          borderBottom: '1px solid rgba(47,90,174,0.07)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(47,90,174,0.018)',
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'rgba(47,90,174,0.06)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            i % 2 === 0 ? 'transparent' : 'rgba(47,90,174,0.018)')
                        }
                      >
                        <td
                          data-label="Psicólogo"
                          style={{
                            padding: '12px',
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: '#272626',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                          {modalidad && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 10.5,
                                background: '#e0f2fe',
                                color: '#075985',
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontWeight: 600,
                                letterSpacing: '0.03em',
                              }}
                            >
                              {modalidad}
                            </span>
                          )}
                        </td>
                        <td data-label="Centro" style={{ padding: '12px', fontSize: 13, color: '#4a5870' }}>
                          {r.centro}
                        </td>
                        <td
                          data-label="Citas"
                          style={{
                            padding: '12px',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#0ea5e9',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.citas}
                        </td>
                        <td
                          data-label="Bloqueos"
                          style={{
                            padding: '12px',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#f59e0b',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.bloqueos}
                        </td>
                        <td
                          data-label="Vacaciones"
                          style={{
                            padding: '12px',
                            fontSize: 13,
                            color: '#4a5870',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.vacaciones}
                        </td>
                        <td
                          data-label="Asuntos propios"
                          style={{
                            padding: '12px',
                            fontSize: 13,
                            color: '#4a5870',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.asuntos_propios}
                        </td>
                        <td
                          data-label="Baja laboral"
                          style={{
                            padding: '12px',
                            fontSize: 13,
                            color: '#4a5870',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.baja_laboral}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        selectedDetail && (
          <div
            className="r-grid-side"
            style={{
              gap: 18,
            }}
          >
            <Card title="Psicólogo">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8899bb', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Nombre
                  </div>
                  <div style={{ fontSize: 16, color: '#272626', fontWeight: 600 }}>
                    {selectedNombreSplit?.name}
                    {selectedNombreSplit?.modalidad && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          background: '#e0f2fe',
                          color: '#075985',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        {selectedNombreSplit.modalidad}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8899bb', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Centro
                  </div>
                  <div style={{ fontSize: 14, color: '#4a5870' }}>{selectedDetail.centro}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8899bb', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Estado
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      background: selectedDetail.activo ? '#d1fae5' : '#f3f4f6',
                      color: selectedDetail.activo ? '#065f46' : '#6b7280',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {selectedDetail.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8899bb', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Calendario
                  </div>
                  {selectedDetail.calendar_id ? (
                    <a
                      href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(selectedDetail.calendar_id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: '#2f5aae',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                      }}
                    >
                      Abrir calendario
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: '#a0b0cc' }}>No configurado</div>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Últimas 10 acciones">
              {recentActions.length === 0 ? (
                <div
                  style={{
                    padding: '40px 12px',
                    textAlign: 'center',
                    color: '#a0b0cc',
                    fontSize: 14,
                  }}
                >
                  Sin acciones registradas
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentActions.map((a) => {
                    const badge = ACCION_STYLE[a.accion] ?? { bg: '#f3f4f6', color: '#6b7280' }
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(47,90,174,0.025)',
                          border: '1px solid rgba(47,90,174,0.06)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                padding: '2px 9px',
                                borderRadius: 20,
                                fontSize: 11.5,
                                fontWeight: 600,
                              }}
                            >
                              {a.accion}
                            </span>
                            {a.motivo_bloqueo && (
                              <span style={{ fontSize: 12, color: '#4a5870' }}>
                                · {a.motivo_bloqueo}
                              </span>
                            )}
                            {a.paciente_iniciales && (
                              <span style={{ fontSize: 12, color: '#4a5870' }}>
                                · Paciente: <strong>{a.paciente_iniciales}</strong>
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#8899bb' }}>
                            {formatDateTime(a.creado_en)}
                            {a.fecha_cita && (
                              <>
                                {' '}
                                · cita {a.fecha_cita} {a.hora_cita ?? ''}
                              </>
                            )}
                            {a.fecha_bloqueo_inicio && (
                              <>
                                {' '}
                                · {a.fecha_bloqueo_inicio}
                                {a.fecha_bloqueo_fin ? ` → ${a.fecha_bloqueo_fin}` : ''}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )
      )}
    </div>
  )
}
