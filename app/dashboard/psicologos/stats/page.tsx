import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Psicologo, PsicologoCentro, Centro, AccionHistorial, Paciente, Rol } from '@/types/database'
import { HOME_POR_ROL } from '@/lib/roles'
import { enRango, fechaMadrid, rangoDeParams, sumarDias } from '@/lib/periodo'
import { leerTodas } from '@/lib/leer-todas'
import { horasBloqueo, MOTIVO_SIN_DATO, serieBarras, type BloqueoKpi, type TramoKpi } from '@/lib/kpis'
import StatsDashboard from './_components/StatsDashboard'
import type {
  BarraActividadKey,
  PsicologoLite,
  CentroLite,
  PerPsicologoRow,
  MotivoHoras,
  AccionRecent,
} from './_components/StatsDashboard'
import type { DatoBarra } from '@/lib/kpis'

// ─── Actividad de citas (B8) ─────────────────────────────────────────────────
// El periodo filtra por el día (en Madrid) en que se HIZO la acción. Los bloqueos
// se cuentan en horas de horario: las horas de los tramos del psicólogo en los
// días del bloqueo entero (spec B8, objetivo 4).

const MOTIVOS = ['Asuntos propios', 'Vacaciones', 'Baja médica', 'Otros'] as const

type SearchParams = Promise<{ desde?: string; hasta?: string; periodo?: string; psi?: string; centro?: string }>

type BloqueoFila = BloqueoKpi & { id: string }

export default async function PsicologosStatsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const hoy = fechaMadrid(new Date())
  const rango = rangoDeParams(params, hoy)
  const selectedCentroId = params.centro && params.centro !== 'all' ? params.centro : null
  const selectedPsicologoId = params.psi && params.psi !== 'all' ? params.psi : null

  const supabase = await createSupabaseServerClient()

  // Solo agentes: el resto de roles no ve la actividad de citas (RoleGate lo hace en
  // el cliente; aquí se corta antes de consultar).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: perfil } = user
    ? await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle()
    : { data: null }
  if (perfil && perfil.rol !== 'agente') redirect(HOME_POR_ROL[perfil.rol as Rol] ?? '/dashboard/calendario')

  // Filas por creado_en con un día de margen (UTC/Madrid); luego se filtra por el día real en Madrid.
  const creadoDesde = rango.desde ? sumarDias(rango.desde, -1) + 'T00:00:00Z' : null
  const creadoHasta = rango.hasta ? sumarDias(rango.hasta, 2) + 'T00:00:00Z' : null
  const hechoEnPeriodo = (r: { creado_en: string | null }) => !!r.creado_en && enRango(fechaMadrid(r.creado_en), rango)

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

  // Restringe una consulta a los psicólogos del filtro.
  const porPsicologos = <Q extends { in: (c: string, v: string[]) => Q; eq: (c: string, v: string) => Q }>(q: Q): Q =>
    idsFiltro ? (idsFiltro.length > 0 ? q.in('psicologo_id', idsFiltro) : q.eq('psicologo_id', SIN_RESULTADOS)) : q

  const [bloqueosRes, citasRes, horariosRes, activasRes] = await Promise.all([
    // 1: bloqueos hechos en el periodo (KPIs, quesito de motivos, tabla, barras).
    leerTodas<BloqueoFila>((a, b) => {
      let q = supabase
        .from('acciones_psicologos')
        .select('id, psicologo_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo, creado_en')
        .eq('accion', 'Bloquear agenda')
      if (creadoDesde) q = q.gte('creado_en', creadoDesde)
      if (creadoHasta) q = q.lt('creado_en', creadoHasta)
      return porPsicologos(q).order('id').range(a, b)
    }),
    // 2: acciones sobre citas en el periodo (agendar / cambiar / anular), leídas del
    // historial para que una cita anulada siga contando como agendada y la anulación
    // se atribuya a quien la hizo y a la fecha real.
    leerTodas<AccionHistorial>((a, b) => {
      let q = supabase
        .from('acciones_historial')
        .select('*')
        .in('accion', ['Agendar cita', 'Cambiar cita', 'Cancelar cita'])
      if (creadoDesde) q = q.gte('creado_en', creadoDesde)
      if (creadoHasta) q = q.lt('creado_en', creadoHasta)
      return porPsicologos(q).order('id').range(a, b)
    }),
    // Horario de cada psicólogo (con centro elegido, solo sus tramos en ese centro).
    (() => {
      let q = supabase.from('horarios_psicologos').select('psicologo_id, centro_id, dia_semana, hora_inicio, hora_fin')
      if (selectedCentroId) q = q.eq('centro_id', selectedCentroId)
      return porPsicologos(q)
    })(),
    // Psicólogos activos = con alguna cita no anulada cuya fecha de sesión cae en el periodo.
    leerTodas<{ psicologo_id: string | null }>((a, b) => {
      let q = supabase
        .from('acciones_psicologos')
        .select('id, psicologo_id')
        .eq('accion', 'Agendar cita')
        .eq('activo', true)
      if (rango.desde) q = q.gte('fecha_cita', rango.desde)
      if (rango.hasta) q = q.lte('fecha_cita', rango.hasta)
      if (selectedCentroId) q = q.eq('centro_id', selectedCentroId)
      return porPsicologos(q).order('id').range(a, b)
    }),
  ])

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

  // ── Agregación (servidor) ──
  const tramos = ((horariosRes.data ?? []) as TramoKpi[]).filter((t) => t.centro_id)
  const tramosDe = new Map<string, TramoKpi[]>()
  for (const t of tramos) tramosDe.set(t.psicologo_id, [...(tramosDe.get(t.psicologo_id) ?? []), t])
  // Las horas son las del bloqueo entero: sin recorte por periodo (el periodo dice cuándo se hizo).
  const sinRecorte = { desde: '', hasta: '' }
  const limites = { primero: hoy, ultimo: hoy }
  const bloq = bloqueosRes.data
    .filter(hechoEnPeriodo)
    .map((b) => ({ ...b, horas: horasBloqueo(b, tramosDe.get(b.psicologo_id ?? '') ?? [], sinRecorte, limites) }))
  const cit = citasRes.data.filter(hechoEnPeriodo)

  // KPIs
  const motivoDe = (b: BloqueoKpi) => b.motivo_bloqueo || MOTIVO_SIN_DATO
  const horasMotivo = (m: string) => bloq.filter((b) => motivoDe(b) === m).reduce((s, b) => s + b.horas, 0)
  const horasTotal = bloq.reduce((s, b) => s + b.horas, 0)
  const citasTotal = cit.filter((r) => r.accion === 'Agendar cita').length
  const citasCambiadas = cit.filter((r) => r.accion === 'Cambiar cita').length
  const citasCanceladas = cit.filter((r) => r.accion === 'Cancelar cita').length
  const motivoHoras: MotivoHoras = MOTIVOS.map((m) => ({ etiqueta: m, valor: horasMotivo(m) }))
  const psicologosActivos = new Set(activasRes.data.map((c) => c.psicologo_id).filter(Boolean)).size

  // Por psicólogo — una fila por psicólogo (ficha única desde la 014).
  const perPsi: Record<string, PerPsicologoRow> = {}
  for (const p of psicologos) {
    perPsi[p.id] = {
      id: p.id,
      nombre: p.nombre,
      centro: centrosDePsicologo(p.id),
      citas: 0,
      cambiadas: 0,
      canceladas: 0,
      horas_bloqueo: 0,
      horas_vacaciones: 0,
      horas_asuntos: 0,
      horas_baja: 0,
    }
  }
  for (const b of bloq) {
    const row = b.psicologo_id ? perPsi[b.psicologo_id] : undefined
    if (!row) continue
    row.horas_bloqueo += b.horas
    if (b.motivo_bloqueo === 'Vacaciones') row.horas_vacaciones += b.horas
    if (b.motivo_bloqueo === 'Asuntos propios') row.horas_asuntos += b.horas
    if (b.motivo_bloqueo === 'Baja médica') row.horas_baja += b.horas
  }
  for (const r of cit) {
    const row = r.psicologo_id ? perPsi[r.psicologo_id] : undefined
    if (!row) continue
    if (r.accion === 'Agendar cita') row.citas += 1
    if (r.accion === 'Cambiar cita') row.cambiadas += 1
    if (r.accion === 'Cancelar cita') row.canceladas += 1
  }
  const perPsicologoRows = Object.values(perPsi).sort((a, b) => b.horas_bloqueo - a.horas_bloqueo || b.citas - a.citas)

  // Barras: todos los psicólogos activos (del centro elegido), de mayor a menor.
  const idsActivos = psicologos.filter((p) => p.activo).map((p) => p.id)
  const nombres = new Map(psicologos.map((p) => [p.id, p.nombre]))
  const serie = (valor: (r: PerPsicologoRow) => number): DatoBarra[] =>
    serieBarras(
      new Map(perPsicologoRows.filter((r) => valor(r) > 0).map((r) => [r.id, valor(r)])),
      nombres,
      idsActivos,
    )
  const barras: Record<BarraActividadKey, DatoBarra[]> = {
    bloqueos: serie((r) => r.horas_bloqueo),
    vacaciones: serie((r) => r.horas_vacaciones),
    asuntos: serie((r) => r.horas_asuntos),
    baja: serie((r) => r.horas_baja),
    agendadas: serie((r) => r.citas),
    anuladas: serie((r) => r.canceladas),
  }

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
      rango={rango}
      hoy={hoy}
      psicologosLite={psicologosLite}
      centrosLite={centrosLite}
      selectedCentroId={selectedCentroId}
      selectedPsicologoId={selectedPsicologoId}
      selectedDetail={selectedDetail}
      kpis={{
        psicologosActivos,
        psicologosTotal: psicologos.length,
        horasBloqueo: horasTotal,
        horasVacaciones: horasMotivo('Vacaciones'),
        horasAsuntos: horasMotivo('Asuntos propios'),
        horasBaja: horasMotivo('Baja médica'),
        citasTotal,
        citasCambiadas,
        citasCanceladas,
      }}
      motivoHoras={motivoHoras}
      barras={barras}
      perPsicologoRows={perPsicologoRows}
      recentActions={recentActions}
    />
  )
}
