import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Centro, Psicologo } from '@/types/database'
import { KpiCard, Card } from './Cards'
import CitasPorDiaChart from './CitasPorDiaChart'

// ─── Panel personal del call center ──────────────────────────────────────────
// Sustituye al Panel General para el rol call_center: solo muestra la actividad
// del usuario logueado (citas y pacientes que ha registrado él), nunca los datos
// globales de la clínica.

export type Periodo = 'hoy' | 'semana' | 'mes'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
]

const TZ = 'Europe/Madrid'

/** 'YYYY-MM-DD' de un instante en hora de Madrid. */
function fechaMadrid(d: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(d)
  )
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética en UTC, sin efectos de zona). */
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function inicioPeriodo(hoy: string, periodo: Periodo): string {
  if (periodo === 'hoy') return hoy
  if (periodo === 'mes') return hoy.slice(0, 7) + '-01'
  // Semana: desde el lunes.
  const dia = new Date(hoy + 'T00:00:00Z').getUTCDay() // 0 = domingo
  return sumarDias(hoy, -((dia + 6) % 7))
}

function etiquetaDia(fecha: string): string {
  return new Date(fecha + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function formatFechaCorta(fecha: string | null): string {
  if (!fecha) return '—'
  return new Date(fecha + 'T00:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

function formatHora(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

function formatMomento(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const icons = {
  calendar: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  swap: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  xCircle: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  personPlus: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  ),
}

type AccionRow = {
  id: string
  accion: string
  psicologo_id: string | null
  paciente_id: string | null
  fecha_cita: string | null
  hora_cita: string | null
  tipo_cita: string | null
  creado_en: string | null
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: '#667799',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  borderBottom: '1px solid rgba(47,90,174,0.1)',
  whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#4a5870', verticalAlign: 'top' }

function accionBadge(accion: string): React.CSSProperties {
  if (accion === 'Agendar cita') return { background: '#dcfce7', color: '#166534' }
  if (accion === 'Cancelar cita') return { background: '#fee2e2', color: '#991b1b' }
  if (accion === 'Cambiar cita') return { background: '#e0e7ff', color: '#3730a3' }
  return { background: '#eef2fb', color: '#254d99' }
}

export default async function PanelCallCenter({
  userId,
  nombre,
  periodo,
}: {
  userId: string
  nombre: string
  periodo: Periodo
}) {
  const supabase = await createSupabaseServerClient()

  const hoy = fechaMadrid(new Date())
  const inicio = inicioPeriodo(hoy, periodo)
  // Margen de un día para no perder filas por la diferencia UTC/Madrid; luego se
  // filtra por la fecha real en hora de Madrid.
  const desdeIso = sumarDias(inicio, -1) + 'T00:00:00Z'

  const [accionesRes, psicologosRes, centrosRes] = await Promise.all([
    supabase
      .from('acciones_psicologos')
      .select('id, accion, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita, creado_en')
      .eq('created_by_id', userId)
      .gte('creado_en', desdeIso)
      .order('creado_en', { ascending: false }),
    supabase.from('psicologos').select('id, nombre, centro_id'),
    supabase.from('centros').select('id, nombre'),
  ])

  const acciones = ((accionesRes.data ?? []) as AccionRow[]).filter((a) => {
    if (!a.creado_en) return false
    const f = fechaMadrid(a.creado_en)
    return f >= inicio && f <= hoy
  })
  const psicologos = (psicologosRes.data ?? []) as Pick<Psicologo, 'id' | 'nombre' | 'centro_id'>[]
  const centros = (centrosRes.data ?? []) as Pick<Centro, 'id' | 'nombre'>[]
  const psicologoMap = Object.fromEntries(psicologos.map((p) => [p.id, p]))
  const centroMap = Object.fromEntries(centros.map((c) => [c.id, c.nombre]))

  // Pacientes añadidos por este usuario (columnas de la migración 011). Si la
  // migración no se ha ejecutado todavía la consulta falla: se muestra "—".
  let pacientesAnadidos: number | null = null
  const pacRes = await supabase
    .from('pacientes')
    .select('id, fecha_incorporacion')
    .eq('created_by_id', userId)
    .gte('fecha_incorporacion', inicio)
  if (!pacRes.error) pacientesAnadidos = (pacRes.data ?? []).length

  // Nombres de los pacientes de las últimas acciones.
  const ultimas = acciones.slice(0, 15)
  const pacienteIds = Array.from(new Set(ultimas.map((a) => a.paciente_id).filter((id): id is string => !!id)))
  const pacienteNombre: Record<string, string> = {}
  if (pacienteIds.length) {
    const { data } = await supabase.from('pacientes').select('id, nombre, iniciales').in('id', pacienteIds)
    for (const p of data ?? []) pacienteNombre[p.id] = p.nombre ?? p.iniciales ?? '—'
  }

  // ── KPIs ──
  const agendadas = acciones.filter((a) => a.accion === 'Agendar cita')
  const cambiadas = acciones.filter((a) => a.accion === 'Cambiar cita').length
  const canceladas = acciones.filter((a) => a.accion === 'Cancelar cita').length

  // ── Citas agendadas por día del periodo ──
  const porDia: Record<string, number> = {}
  for (const a of agendadas) {
    const f = fechaMadrid(a.creado_en!)
    porDia[f] = (porDia[f] ?? 0) + 1
  }
  const dias: { label: string; count: number }[] = []
  for (let f = inicio; f <= hoy; f = sumarDias(f, 1)) dias.push({ label: etiquetaDia(f), count: porDia[f] ?? 0 })

  // ── Reparto por psicólogo y por centro (citas agendadas) ──
  const porPsicologo: Record<string, number> = {}
  const porCentro: Record<string, number> = {}
  for (const a of agendadas) {
    const psi = a.psicologo_id ? psicologoMap[a.psicologo_id] : undefined
    const nombrePsi = psi?.nombre ?? 'Sin psicólogo'
    porPsicologo[nombrePsi] = (porPsicologo[nombrePsi] ?? 0) + 1
    const nombreCentro = psi?.centro_id ? centroMap[psi.centro_id] ?? 'Sin centro' : 'Sin centro'
    porCentro[nombreCentro] = (porCentro[nombreCentro] ?? 0) + 1
  }
  const listaPsicologos = Object.entries(porPsicologo).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const listaCentros = Object.entries(porCentro).sort((a, b) => b[1] - a[1])

  const tituloPeriodo = PERIODOS.find((p) => p.key === periodo)?.label.toLowerCase() ?? ''

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      {/* ── Cabecera ── */}
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
          Mi actividad
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          {nombre} · citas y pacientes que has registrado {tituloPeriodo}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {PERIODOS.map((p) => {
            const activo = p.key === periodo
            return (
              <Link
                key={p.key}
                href={`/dashboard?periodo=${p.key}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1.5px solid',
                  borderColor: activo ? '#2f5aae' : 'rgba(47,90,174,0.2)',
                  background: activo ? '#eef2fb' : '#fff',
                  color: activo ? '#254d99' : '#4a5870',
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {p.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="r-grid-kpi" style={{ gap: 18, marginBottom: 24 }}>
        <KpiCard label="Citas agendadas" value={agendadas.length} icon={icons.calendar} accent="#10b981" accentBg="#d1fae5" />
        <KpiCard label="Citas cambiadas" value={cambiadas} icon={icons.swap} accent="#6366f1" accentBg="#e0e7ff" />
        <KpiCard label="Citas canceladas" value={canceladas} icon={icons.xCircle} accent="#ef4444" accentBg="#fee2e2" />
        <KpiCard
          label="Pacientes añadidos"
          value={pacientesAnadidos ?? '—'}
          sub={pacientesAnadidos === null ? 'Pendiente de activar en la base de datos' : undefined}
          icon={icons.personPlus}
          accent="#8b5cf6"
          accentBg="#f3e8ff"
        />
      </div>

      {/* ── Gráfico + reparto ── */}
      <div className="r-grid-side" style={{ gap: 18, marginBottom: 24 }}>
        <Card title="Por psicólogo y centro">
          {agendadas.length === 0 ? (
            <div style={{ color: '#a0b0cc', fontSize: 14 }}>Sin citas agendadas en este periodo</div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Centros
                </div>
                {listaCentros.map(([n, c]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#4a5870', padding: '5px 0', borderBottom: '1px solid rgba(47,90,174,0.06)' }}>
                    <span>{n}</span>
                    <strong style={{ color: '#272626', fontVariantNumeric: 'tabular-nums' }}>{c}</strong>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Psicólogos
                </div>
                {listaPsicologos.map(([n, c]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#4a5870', padding: '5px 0', borderBottom: '1px solid rgba(47,90,174,0.06)' }}>
                    <span>{n}</span>
                    <strong style={{ color: '#272626', fontVariantNumeric: 'tabular-nums' }}>{c}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card title="Citas agendadas por día">
          <CitasPorDiaChart data={dias} />
        </Card>
      </div>

      {/* ── Últimas acciones ── */}
      <Card title="Últimas acciones">
        {ultimas.length === 0 ? (
          <div style={{ color: '#a0b0cc', fontSize: 14 }}>Todavía no has registrado ninguna acción en este periodo</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['Cuándo', 'Acción', 'Paciente', 'Psicólogo', 'Cita'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimas.map((a) => {
                  const psi = a.psicologo_id ? psicologoMap[a.psicologo_id] : undefined
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(47,90,174,0.06)' }}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatMomento(a.creado_en)}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...accionBadge(a.accion) }}>
                          {a.accion}
                        </span>
                      </td>
                      <td style={td}>{a.paciente_id ? pacienteNombre[a.paciente_id] ?? '—' : '—'}</td>
                      <td style={td}>
                        {psi?.nombre ?? '—'}
                        {psi?.centro_id && centroMap[psi.centro_id] && (
                          <div style={{ fontSize: 11.5, color: '#8899bb' }}>{centroMap[psi.centro_id]}</div>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {formatFechaCorta(a.fecha_cita)} {formatHora(a.hora_cita)}
                        {a.tipo_cita && <span style={{ marginLeft: 6, color: '#8899bb', fontSize: 12 }}>{a.tipo_cita}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
