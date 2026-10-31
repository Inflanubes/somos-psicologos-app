import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Centro, Psicologo } from '@/types/database'
import { KpiCard, Card } from './Cards'
import CitasPorDiaChart from './CitasPorDiaChart'
import FiltroPeriodo from './FiltroPeriodo'
import { diasDelRango, enRango, etiquetaRango, fechaMadrid, sumarDias, type Rango } from '@/lib/periodo'

// ─── Panel personal del call center ──────────────────────────────────────────
// Sustituye al Panel General para el rol call_center: solo muestra la actividad
// del usuario logueado (citas y pacientes que ha registrado él), nunca los datos
// globales de la clínica.

const TZ = 'Europe/Madrid'

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
  centro_id: string | null
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
  rango,
  hoy,
}: {
  userId: string
  nombre: string
  rango: Rango
  hoy: string
}) {
  const supabase = await createSupabaseServerClient()

  // Margen de un día para no perder filas por la diferencia UTC/Madrid; luego se
  // filtra por la fecha real en hora de Madrid.
  let consultaAcciones = supabase
    .from('acciones_historial')
    .select('id, accion, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita, centro_id, creado_en')
    .eq('realizado_por_id', userId)
  if (rango.desde) consultaAcciones = consultaAcciones.gte('creado_en', sumarDias(rango.desde, -1) + 'T00:00:00Z')
  if (rango.hasta) consultaAcciones = consultaAcciones.lt('creado_en', sumarDias(rango.hasta, 2) + 'T00:00:00Z')

  const [accionesRes, psicologosRes, centrosRes] = await Promise.all([
    // Historial (migración 011): una fila por acción, atribuida a quien la hizo
    // y con la fecha real, aunque la cita se haya anulado o cambiado después.
    consultaAcciones.order('creado_en', { ascending: false }),
    supabase.from('psicologos').select('id, nombre'),
    supabase.from('centros').select('id, nombre'),
  ])

  const acciones = ((accionesRes.data ?? []) as AccionRow[]).filter((a) => {
    return !!a.creado_en && enRango(fechaMadrid(a.creado_en), rango)
  })
  const psicologos = (psicologosRes.data ?? []) as Pick<Psicologo, 'id' | 'nombre'>[]
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
  if (!pacRes.error) pacientesAnadidos = (pacRes.data ?? []).filter((p) => enRango(p.fecha_incorporacion, rango)).length

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
  // "Desde siempre" empieza en la primera acción; sin acciones, solo hoy.
  const diasPorDefecto = Object.keys(porDia).sort()
  for (const f of diasDelRango(rango, { primero: diasPorDefecto[0] ?? hoy, ultimo: hoy }))
    dias.push({ label: etiquetaDia(f), count: porDia[f] ?? 0 })

  // ── Reparto por psicólogo y por centro (citas agendadas) ──
  const porPsicologo: Record<string, number> = {}
  const porCentro: Record<string, number> = {}
  for (const a of agendadas) {
    const psi = a.psicologo_id ? psicologoMap[a.psicologo_id] : undefined
    const nombrePsi = psi?.nombre ?? 'Sin psicólogo'
    porPsicologo[nombrePsi] = (porPsicologo[nombrePsi] ?? 0) + 1
    // Centro de la cita (migración 014), no del psicólogo.
    const nombreCentro = a.centro_id ? centroMap[a.centro_id] ?? 'Sin centro' : 'Sin centro'
    porCentro[nombreCentro] = (porCentro[nombreCentro] ?? 0) + 1
  }
  const listaPsicologos = Object.entries(porPsicologo).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const listaCentros = Object.entries(porCentro).sort((a, b) => b[1] - a[1])


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
          {nombre} · citas y pacientes que has registrado · {etiquetaRango(rango)}
        </p>
        <div style={{ marginTop: 14 }}>
          <FiltroPeriodo rango={rango} hoy={hoy} />
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
                        {a.centro_id && centroMap[a.centro_id] && (
                          <div style={{ fontSize: 11.5, color: '#8899bb' }}>{centroMap[a.centro_id]}</div>
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
