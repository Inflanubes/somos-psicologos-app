import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Psicologo, PsicologoCentro, Centro, AccionPsicologo, AccionHistorial, Paciente } from '@/types/database'
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

  // Centros de cada psicólogo (migración 014: una ficha por persona, N centros).
  const { data: psicologosCentrosRaw } = await supabase.from('psicologos_centros').select('psicologo_id, centro_id')
  const centrosDe = new Map<string, string[]>()
  for (const pc of (psicologosCentrosRaw ?? []) as PsicologoCentro[]) {
    centrosDe.set(pc.psicologo_id, [...(centrosDe.get(pc.psicologo_id) ?? []), pc.centro_id])
  }
  const centrosDePsicologo = (id: string) =>
    (centrosDe.get(id) ?? [])
      .map((cid) => centroMap[cid])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(' · ') || '—'

  // Apply centro filter — narrows the psicólogo set used for KPIs, per-psi table, and dropdown.
  const psicologos = selectedCentroId
    ? allPsicologos.filter((p) => (centrosDe.get(p.id) ?? []).includes(selectedCentroId))
    : allPsicologos

  // La URL lleva el id del psicólogo. Se resuelve sobre la lista completa para que
  // un enlace de otro centro siga identificando a la persona.
  const selectedRow = selectedPsicologoId
    ? allPsicologos.find((p) => p.id === selectedPsicologoId) ?? null
    : null
  const idsSeleccionados = selectedRow ? [selectedRow.id] : null

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

  // KEY QUERY 2: acciones sobre citas en el periodo (agendar / cambiar / anular),
  // leídas del historial para que una cita anulada siga contando como agendada
  // y la anulación se atribuya a quien la hizo y a la fecha real.
  let citasQ = supabase
    .from('acciones_historial')
    .select('*')
    .in('accion', ['Agendar cita', 'Cambiar cita', 'Cancelar cita'])
  if (periodStart) citasQ = citasQ.gte('creado_en', periodStart)
  if (idsFiltro)
    citasQ =
      idsFiltro.length > 0
        ? citasQ.in('psicologo_id', idsFiltro)
        : citasQ.eq('psicologo_id', SIN_RESULTADOS)
  const { data: citasRows } = await citasQ

  // KEY QUERY 3: last 10 actions for selected psicólogo (only when one is picked).
  let recentActions: AccionRecent[] = []
  if (idsSeleccionados) {
    const { data: recentRows } = await supabase
      .from('acciones_historial')
      .select('*')
      .in('psicologo_id', idsSeleccionados)
      .order('creado_en', { ascending: false })
      .limit(10)
    const rows = (recentRows ?? []) as AccionHistorial[]

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
  const cit = (citasRows ?? []) as AccionHistorial[]

  // KPI counts
  const bloqueosTotal = bloq.length
  const citasTotal = cit.filter((r) => r.accion === 'Agendar cita').length
  const citasCambiadas = cit.filter((r) => r.accion === 'Cambiar cita').length
  const citasCanceladas = cit.filter((r) => r.accion === 'Cancelar cita').length
  const motivoCounts: MotivoCounts = { 'Asuntos propios': 0, Vacaciones: 0, 'Baja laboral': 0, Otros: 0 }
  for (const r of bloq) {
    if (r.motivo_bloqueo && r.motivo_bloqueo in motivoCounts) {
      motivoCounts[r.motivo_bloqueo as Motivo] += 1
    }
  }
  const psicologosActivos = psicologos.filter((p) => p.activo).length

  // Per psicólogo aggregates — una fila por psicólogo (ficha única desde la 014).
  const perPsi: Record<string, PerPsicologoRow> = {}
  for (const p of psicologos) {
    perPsi[p.id] = {
      id: p.id,
      nombre: p.nombre,
      centro: centrosDePsicologo(p.id),
      citas: 0,
      cambiadas: 0,
      canceladas: 0,
      bloqueos: 0,
      vacaciones: 0,
      asuntos_propios: 0,
      baja_laboral: 0,
    }
  }
  for (const r of bloq) {
    const key = r.psicologo_id ?? undefined
    if (!key || !perPsi[key]) continue
    const row = perPsi[key]
    row.bloqueos += 1
    if (r.motivo_bloqueo === 'Vacaciones') row.vacaciones += 1
    if (r.motivo_bloqueo === 'Asuntos propios') row.asuntos_propios += 1
    if (r.motivo_bloqueo === 'Baja laboral') row.baja_laboral += 1
  }
  for (const r of cit) {
    const key = r.psicologo_id ?? undefined
    if (!key || !perPsi[key]) continue
    if (r.accion === 'Agendar cita') perPsi[key].citas += 1
    if (r.accion === 'Cambiar cita') perPsi[key].cambiadas += 1
    if (r.accion === 'Cancelar cita') perPsi[key].canceladas += 1
  }
  const perPsicologoRows = Object.values(perPsi).sort((a, b) => b.bloqueos - a.bloqueos || b.citas - a.citas)

  // Top 10 by bloqueos for the bar chart
  const topBloqueosChart = perPsicologoRows
    .filter((r) => r.bloqueos > 0)
    .slice(0, 10)
    .map((r) => ({ nombre: r.nombre, count: r.bloqueos }))

  // Build psicólogo lite list for dropdown — ya acotada por centro si hay uno seleccionado.
  const psicologosLite: PsicologoLite[] = psicologos
    .map((p) => ({ id: p.id, nombre: p.nombre, centro: centrosDePsicologo(p.id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Build centro lite list for dropdown
  const centrosLite: CentroLite[] = centros
    .map((c) => ({ id: c.id, nombre: c.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Selected psicólogo detail card.
  const selectedDetail = selectedRow
    ? {
        id: selectedRow.id,
        nombre: selectedRow.nombre,
        centro: centrosDePsicologo(selectedRow.id),
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
        psicologosTotal: psicologos.length,
        bloqueosTotal,
        vacaciones: motivoCounts['Vacaciones'],
        asuntosPropios: motivoCounts['Asuntos propios'],
        bajaLaboral: motivoCounts['Baja laboral'],
        citasTotal,
        citasCambiadas,
        citasCanceladas,
      }}
      motivoCounts={motivoCounts}
      topBloqueosChart={topBloqueosChart}
      perPsicologoRows={perPsicologoRows}
      recentActions={recentActions}
    />
  )
}
