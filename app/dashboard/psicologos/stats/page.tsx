import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Psicologo, Centro, AccionPsicologo, Paciente } from '@/types/database'
import StatsDashboard from './_components/StatsDashboard'
import type {
  PeriodKey,
  PsicologoLite,
  CentroLite,
  PerPsicologoRow,
  MotivoCounts,
  AccionRecent,
} from './_components/StatsDashboard'

const MOTIVOS = ['Asuntos propios', 'Vacaciones', 'Baja laboral', 'Otros'] as const
type Motivo = (typeof MOTIVOS)[number]

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_30', label: 'Últimos 30 días' },
  { key: 'last_90', label: 'Últimos 90 días' },
  { key: 'all', label: 'Desde siempre' },
]

function getPeriodStart(period: PeriodKey, now: Date): string | null {
  if (period === 'all') return null
  if (period === 'this_month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d.toISOString()
  }
  const d = new Date(now)
  if (period === 'last_30') d.setDate(d.getDate() - 30)
  if (period === 'last_90') d.setDate(d.getDate() - 90)
  return d.toISOString()
}

type SearchParams = Promise<{ period?: string; psi?: string; centro?: string }>

export default async function PsicologosStatsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const period: PeriodKey = (PERIOD_OPTIONS.find((p) => p.key === params.period)?.key ??
    'this_month') as PeriodKey
  const selectedCentroId = params.centro && params.centro !== 'all' ? params.centro : null
  const selectedPsicologoId = params.psi && params.psi !== 'all' ? params.psi : null

  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const periodStart = getPeriodStart(period, now)

  // ── Fetch psicologos & centros (always all, used for filter dropdown + table) ──
  const [{ data: psicologosRaw }, { data: centrosRaw }] = await Promise.all([
    supabase.from('psicologos').select('*'),
    supabase.from('centros').select('*'),
  ])

  const allPsicologos = (psicologosRaw ?? []) as Psicologo[]
  const centros = (centrosRaw ?? []) as Centro[]
  const centroMap = Object.fromEntries(centros.map((c) => [c.id, c.nombre])) as Record<
    string,
    string
  >

  // Apply centro filter — narrows the psicólogo set used for KPIs, per-psi table, and dropdown.
  const psicologos = selectedCentroId
    ? allPsicologos.filter((p) => p.centro_id === selectedCentroId)
    : allPsicologos

  // ── Agrupación por persona ───────────────────────────────────────────────────
  // Un psicólogo que trabaja en varios centros tiene una fila en `psicologos` por
  // centro. Las estadísticas son de la persona, no de la ficha: si no se agrupara,
  // saldría dos veces en la tabla, contaría doble en los KPIs y sus bloqueos
  // (que afectan a un calendario compartido) aparecerían partidos entre centros.
  // Se agrupa por email, la misma clave que usa el resto de la app, con el nombre
  // de respaldo para las fichas antiguas creadas a mano sin email.
  const personaKey = (p: Psicologo) =>
    p.email?.trim().toLowerCase() || `nombre:${p.nombre.trim().toLowerCase()}`

  type Persona = {
    key: string
    id: string // ficha principal: la que se usa como valor en la URL
    nombre: string
    ids: string[]
    centros: string[]
    activo: boolean
    calendarId: string | null
  }
  const personasMap = new Map<string, Persona>()
  for (const p of psicologos) {
    const key = personaKey(p)
    let persona = personasMap.get(key)
    if (!persona) {
      persona = { key, id: p.id, nombre: p.nombre, ids: [], centros: [], activo: false, calendarId: null }
      personasMap.set(key, persona)
    }
    persona.ids.push(p.id)
    const nombreCentro = p.centro_id ? centroMap[p.centro_id] : null
    if (nombreCentro && !persona.centros.includes(nombreCentro)) persona.centros.push(nombreCentro)
    if (p.activo) persona.activo = true
    if (!persona.calendarId && p.calendar_id) persona.calendarId = p.calendar_id
  }
  const personas = Array.from(personasMap.values())
  for (const persona of personas) persona.centros.sort((a, b) => a.localeCompare(b))
  const centrosDePersona = (persona: Persona) => persona.centros.join(' · ') || '—'

  // La URL lleva el id de UNA ficha; se expande a todas las de esa persona para que
  // el detalle sume sus centros. Se resuelve sobre la lista completa para que un
  // enlace antiguo (o de otro centro) siga identificando a la persona.
  const selectedRow = selectedPsicologoId
    ? allPsicologos.find((p) => p.id === selectedPsicologoId) ?? null
    : null
  const selectedPersona = selectedRow ? personasMap.get(personaKey(selectedRow)) ?? null : null
  const idsSeleccionados = selectedPersona?.ids ?? (selectedRow ? [selectedRow.id] : null)

  // Ids que acotan las consultas: la persona elegida o, si no hay, el centro filtrado.
  // `[]` = centro sin psicólogos → no debe devolver ninguna fila; `null` = sin filtro.
  const idsFiltro = idsSeleccionados ?? (selectedCentroId ? psicologos.map((p) => p.id) : null)
  const SIN_RESULTADOS = '00000000-0000-0000-0000-000000000000'

  // KEY QUERY 1: bloqueos in period (for KPIs, motivos chart, per-psi table)
  let bloqueosQ = supabase
    .from('acciones_psicologos')
    .select('*')
    .eq('accion', 'Bloquear agenda')
  if (periodStart) bloqueosQ = bloqueosQ.gte('creado_en', periodStart)
  if (idsFiltro)
    bloqueosQ =
      idsFiltro.length > 0
        ? bloqueosQ.in('psicologo_id', idsFiltro)
        : bloqueosQ.eq('psicologo_id', SIN_RESULTADOS)
  const { data: bloqueosRows } = await bloqueosQ

  // KEY QUERY 2: citas agendadas in period (for KPIs and per-psi table)
  let citasQ = supabase
    .from('acciones_psicologos')
    .select('*')
    .eq('accion', 'Agendar cita')
  if (periodStart) citasQ = citasQ.gte('creado_en', periodStart)
  if (idsFiltro)
    citasQ =
      idsFiltro.length > 0
        ? citasQ.in('psicologo_id', idsFiltro)
        : citasQ.eq('psicologo_id', SIN_RESULTADOS)
  const { data: citasRows } = await citasQ

  // KEY QUERY 3: last 10 actions for selected psicólogo (only when one is picked).
  // Se consultan todas sus fichas para que el historial no salga partido por centro.
  let recentActions: AccionRecent[] = []
  if (idsSeleccionados) {
    const { data: recentRows } = await supabase
      .from('acciones_psicologos')
      .select('*')
      .in('psicologo_id', idsSeleccionados)
      .order('creado_en', { ascending: false })
      .limit(10)
    const rows = (recentRows ?? []) as AccionPsicologo[]

    // resolve paciente iniciales for any with paciente_id
    const pacIds = Array.from(new Set(rows.map((r) => r.paciente_id).filter((x): x is string => !!x)))
    let pacMap: Record<string, string> = {}
    if (pacIds.length > 0) {
      const { data: pacs } = await supabase
        .from('pacientes')
        .select('*')
        .in('id', pacIds)
      const pacsList = (pacs ?? []) as Paciente[]
      pacMap = Object.fromEntries(
        pacsList.map((p) => [
          p.id,
          p.iniciales ?? (p.nombre ? p.nombre.slice(0, 2).toUpperCase() : ''),
        ])
      )
    }

    recentActions = rows.map((r) => ({
      id: r.id,
      accion: r.accion,
      motivo_bloqueo: r.motivo_bloqueo,
      creado_en: r.creado_en,
      paciente_iniciales: r.paciente_id ? pacMap[r.paciente_id] ?? null : null,
      fecha_cita: r.fecha_cita,
      hora_cita: r.hora_cita,
      fecha_bloqueo_inicio: r.fecha_bloqueo_inicio,
      fecha_bloqueo_fin: r.fecha_bloqueo_fin,
    }))
  }

  // ── Aggregate (server side) ──
  const bloq = (bloqueosRows ?? []) as AccionPsicologo[]
  const cit = (citasRows ?? []) as AccionPsicologo[]

  // KPI counts
  const bloqueosTotal = bloq.length
  const citasTotal = cit.length
  const motivoCounts: MotivoCounts = { 'Asuntos propios': 0, Vacaciones: 0, 'Baja laboral': 0, Otros: 0 }
  for (const r of bloq) {
    if (r.motivo_bloqueo && r.motivo_bloqueo in motivoCounts) {
      motivoCounts[r.motivo_bloqueo as Motivo] += 1
    }
  }
  const psicologosActivos = personas.filter((p) => p.activo).length

  // Per psicólogo aggregates — una fila por persona, sumando todas sus fichas.
  const idAPersona = new Map<string, string>()
  for (const persona of personas) for (const id of persona.ids) idAPersona.set(id, persona.key)

  const perPsi: Record<string, PerPsicologoRow> = {}
  for (const persona of personas) {
    perPsi[persona.key] = {
      id: persona.id,
      nombre: persona.nombre,
      centro: centrosDePersona(persona),
      citas: 0,
      bloqueos: 0,
      vacaciones: 0,
      asuntos_propios: 0,
      baja_laboral: 0,
    }
  }
  for (const r of bloq) {
    const key = r.psicologo_id ? idAPersona.get(r.psicologo_id) : undefined
    if (!key) continue
    const row = perPsi[key]
    row.bloqueos += 1
    if (r.motivo_bloqueo === 'Vacaciones') row.vacaciones += 1
    if (r.motivo_bloqueo === 'Asuntos propios') row.asuntos_propios += 1
    if (r.motivo_bloqueo === 'Baja laboral') row.baja_laboral += 1
  }
  for (const r of cit) {
    const key = r.psicologo_id ? idAPersona.get(r.psicologo_id) : undefined
    if (!key) continue
    perPsi[key].citas += 1
  }
  const perPsicologoRows = Object.values(perPsi).sort((a, b) => b.bloqueos - a.bloqueos || b.citas - a.citas)

  // Top 10 by bloqueos for the bar chart
  const topBloqueosChart = perPsicologoRows
    .filter((r) => r.bloqueos > 0)
    .slice(0, 10)
    .map((r) => ({ nombre: r.nombre, count: r.bloqueos }))

  // Build psicólogo lite list for dropdown — una entrada por persona, ya acotada por
  // centro si hay uno seleccionado.
  const psicologosLite: PsicologoLite[] = personas
    .map((persona) => ({ id: persona.id, nombre: persona.nombre, centro: persona.centros.join(' · ') }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Build centro lite list for dropdown
  const centrosLite: CentroLite[] = centros
    .map((c) => ({ id: c.id, nombre: c.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Selected psicólogo detail card — la persona si está en el ámbito actual; si no
  // (enlace antiguo o ficha de un centro filtrado fuera), la ficha suelta.
  const selectedDetail = selectedPersona
    ? {
        id: selectedPersona.id,
        nombre: selectedPersona.nombre,
        centro: centrosDePersona(selectedPersona),
        calendar_id: selectedPersona.calendarId,
        activo: selectedPersona.activo,
      }
    : selectedRow
      ? {
          id: selectedRow.id,
          nombre: selectedRow.nombre,
          centro: selectedRow.centro_id ? centroMap[selectedRow.centro_id] ?? '—' : '—',
          calendar_id: selectedRow.calendar_id,
          activo: !!selectedRow.activo,
        }
      : null

  return (
    <StatsDashboard
      period={period}
      periodOptions={PERIOD_OPTIONS}
      psicologosLite={psicologosLite}
      centrosLite={centrosLite}
      selectedCentroId={selectedCentroId}
      selectedPsicologoId={selectedPsicologoId}
      selectedDetail={selectedDetail}
      kpis={{
        psicologosActivos,
        psicologosTotal: personas.length,
        bloqueosTotal,
        vacaciones: motivoCounts['Vacaciones'],
        asuntosPropios: motivoCounts['Asuntos propios'],
        bajaLaboral: motivoCounts['Baja laboral'],
        citasTotal,
      }}
      motivoCounts={motivoCounts}
      topBloqueosChart={topBloqueosChart}
      perPsicologoRows={perPsicologoRows}
      recentActions={recentActions}
    />
  )
}
