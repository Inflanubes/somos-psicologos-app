import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Centro, EstadoPaciente, Paciente, Psicologo } from '@/types/database'
import type { PacienteRow } from './_components/PacientesTable'
import PanelCallCenter from './_components/PanelCallCenter'
import ResumenDashboard, { type BarraKey, type QuesitoKey } from './_components/ResumenDashboard'
import type { DatoQuesito } from './_components/GraficaQuesito'
import { diasDelRango, enRango, etiquetaRango, fechaMadrid, rangoDeParams } from '@/lib/periodo'
import { leerTodas } from '@/lib/leer-todas'
import {
  anulacionPor, citasDelPeriodo, contarPor, ETIQUETA_ORIGEN, ETIQUETA_TIPO, kpisResumen, ocupacionPor, serieBarras,
  type BloqueoKpi, type CitaKpi, type DatoBarra, type PacienteKpi, type TramoKpi,
} from '@/lib/kpis'

// ─── Resumen de pacientes (B8) ───────────────────────────────────────────────
// Página servidor: lee citas, pacientes, horarios y bloqueos del periodo y del
// centro elegidos, y calcula todo con lib/kpis. Diseño:
// docs/superpowers/specs/2026-10-27-b8-paneles-estadisticas-design.md

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

type CitaFila = {
  id: string
  accion: string
  activo: boolean | null
  paciente_id: string | null
  psicologo_id: string | null
  centro_id: string | null
  fecha_cita: string | null
  tipo_cita: CitaKpi['tipo_cita']
}

/** Mapa → datos de quesito con etiquetas legibles, de mayor a menor. */
function aQuesito(m: Map<string, number>, etiqueta: (k: string) => string): DatoQuesito[] {
  const juntos = new Map<string, number>()
  m.forEach((v, k) => juntos.set(etiqueta(k), (juntos.get(etiqueta(k)) ?? 0) + v))
  return Array.from(juntos, ([e, valor]) => ({ etiqueta: e, valor })).sort((a, b) => b.valor - a.valor)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; periodo?: string; centro?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const params = await searchParams
  const hoy = fechaMadrid(new Date())
  const rango = rangoDeParams(params, hoy)

  // El call center no ve los datos globales de la clínica: solo su actividad.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: perfil } = user
    ? await supabase.from('perfiles').select('nombre, rol').eq('id', user.id).maybeSingle()
    : { data: null }
  // Inspección no ve los paneles de estadísticas: se le manda al Calendario antes de consultar nada.
  if (perfil?.rol === 'inspeccion') redirect('/dashboard/calendario')
  if (user && perfil?.rol === 'call_center') {
    return <PanelCallCenter userId={user.id} nombre={perfil.nombre} rango={rango} hoy={hoy} />
  }

  const centroId = params.centro && params.centro !== 'all' ? params.centro : null

  const [centrosRes, psicologosRes, pcRes, citasRes, pacientesRes, horariosRes, bloqueosRes] = await Promise.all([
    supabase.from('centros').select('id, nombre').order('nombre'),
    supabase.from('psicologos').select('id, nombre, activo'),
    supabase.from('psicologos_centros').select('psicologo_id, centro_id'),
    leerTodas<CitaFila>((a, b) => {
      let q = supabase
        .from('acciones_psicologos')
        .select('id, accion, activo, paciente_id, psicologo_id, centro_id, fecha_cita, tipo_cita')
        .in('accion', ['Agendar cita', 'Cancelar cita'])
      if (rango.desde) q = q.gte('fecha_cita', rango.desde)
      if (rango.hasta) q = q.lte('fecha_cita', rango.hasta)
      if (centroId) q = q.eq('centro_id', centroId)
      return q.order('id').range(a, b)
    }),
    leerTodas<Paciente>((a, b) => {
      let q = supabase.from('pacientes').select('*')
      if (centroId) q = q.eq('centro_id', centroId)
      return q.order('fecha_incorporacion', { ascending: false, nullsFirst: false }).order('id').range(a, b)
    }),
    (() => {
      let q = supabase.from('horarios_psicologos').select('psicologo_id, centro_id, dia_semana, hora_inicio, hora_fin')
      if (centroId) q = q.eq('centro_id', centroId)
      return q
    })(),
    (() => {
      let q = supabase
        .from('acciones_psicologos')
        .select('psicologo_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo, creado_en')
        .eq('accion', 'Bloquear agenda')
        .eq('activo', true)
      if (rango.hasta) q = q.lte('fecha_bloqueo_inicio', rango.hasta)
      if (rango.desde) q = q.or(`fecha_bloqueo_fin.gte.${rango.desde},fecha_bloqueo_fin.is.null`)
      return q
    })(),
  ])

  const centros = (centrosRes.data ?? []) as Pick<Centro, 'id' | 'nombre'>[]
  const psicologos = (psicologosRes.data ?? []) as Pick<Psicologo, 'id' | 'nombre' | 'activo'>[]
  const pacientes = pacientesRes.data
  const tramos = ((horariosRes.data ?? []) as TramoKpi[]).filter((t) => t.centro_id)
  const bloqueos = (bloqueosRes.data ?? []) as BloqueoKpi[]
  const citas: CitaKpi[] = citasRes.data.map((c) => ({
    id: c.id,
    paciente_id: c.paciente_id,
    psicologo_id: c.psicologo_id,
    centro_id: c.centro_id,
    fecha_cita: c.fecha_cita,
    tipo_cita: c.tipo_cita,
    anulada: c.accion === 'Cancelar cita' || c.activo === false,
  }))
  const pacientesKpi: PacienteKpi[] = pacientes.map((p) => ({
    id: p.id,
    fecha_incorporacion: p.fecha_incorporacion,
    es_menor: !!p.es_menor,
    centro_id: p.centro_id,
    origen: p.origen ?? null,
    psicologo_adultos_id: p.psicologo_adultos_id,
    psicologo_pareja_id: p.psicologo_pareja_id,
    psicologo_infantil_id: p.psicologo_infantil_id,
    pareja_de: p.pareja_de ?? null,
    estado: p.estado,
  }))

  // Psicólogos activos (de la ficha); con centro, solo los que trabajan en él.
  const enCentro = new Set(
    (pcRes.data ?? []).filter((pc) => !centroId || pc.centro_id === centroId).map((pc) => pc.psicologo_id as string),
  )
  const idsActivos = psicologos.filter((p) => p.activo && (!centroId || enCentro.has(p.id))).map((p) => p.id)
  const idsCentros = centros.filter((c) => !centroId || c.id === centroId).map((c) => c.id)
  const nombrePsi = new Map(psicologos.map((p) => [p.id, p.nombre]))
  const nombreCentro = new Map(centros.map((c) => [c.id, c.nombre]))

  // "Desde siempre" (o un lado abierto) se acota al primer y último dato.
  const fechas = [
    ...citas.map((c) => c.fecha_cita),
    ...pacientesKpi.map((p) => p.fecha_incorporacion),
  ].filter((f): f is string => !!f).map((f) => f.slice(0, 10)).sort()
  const limites = { primero: fechas[0] ?? hoy, ultimo: fechas[fechas.length - 1] > hoy ? fechas[fechas.length - 1] : hoy }

  const kpis = kpisResumen({ citas, pacientes: pacientesKpi, bloqueos, tramos, psicologosActivos: idsActivos, rango, limites })

  // ── Gráficas ──
  const { activas, anuladas } = citasDelPeriodo(citas, rango)
  const nuevos = pacientesKpi.filter((p) => enRango(p.fecha_incorporacion, rango))
  const dias = diasDelRango(rango, limites)
  const activosSet = new Set(idsActivos)
  const tramosActivos = tramos.filter((t) => activosSet.has(t.psicologo_id))

  const quesitos: Record<QuesitoKey, DatoQuesito[]> = {
    tipo: aQuesito(contarPor(activas, (c) => c.tipo_cita, ''), (k) => ETIQUETA_TIPO[k] ?? 'Sin tipo'),
    nuevos_centro: aQuesito(contarPor(nuevos, (p) => p.centro_id, ''), (k) => nombreCentro.get(k) ?? 'Sin centro'),
    nuevos_canal: aQuesito(contarPor(nuevos, (p) => p.origen, ''), (k) => ETIQUETA_ORIGEN[k] ?? 'Sin dato'),
    // El estado es la foto de hoy de las fichas (del centro elegido), no depende del periodo.
    estado: ESTADOS.map((e) => ({ etiqueta: e, valor: pacientesKpi.filter((p) => p.estado === e).length })),
  }

  // Un paciente nuevo cuenta para cada psicólogo que tiene asignado (una vez por psicólogo).
  const nuevosPorPsi = new Map<string, number>()
  for (const p of nuevos) {
    const suyos = new Set([p.psicologo_adultos_id, p.psicologo_pareja_id, p.psicologo_infantil_id].filter(Boolean) as string[])
    suyos.forEach((id) => nuevosPorPsi.set(id, (nuevosPorPsi.get(id) ?? 0) + 1))
  }
  const sinNulos = (m: Map<string, number>) => {
    m.delete('')
    return m
  }

  const barras: Record<BarraKey, DatoBarra[]> = {
    nuevos_psi: serieBarras(nuevosPorPsi, nombrePsi, idsActivos),
    nuevos_centro: serieBarras(sinNulos(contarPor(nuevos, (p) => p.centro_id, '')), nombreCentro, idsCentros),
    citas_psi: serieBarras(sinNulos(contarPor(activas, (c) => c.psicologo_id, '')), nombrePsi, idsActivos),
    citas_centro: serieBarras(sinNulos(contarPor(activas, (c) => c.centro_id, '')), nombreCentro, idsCentros),
    ocupacion_psi: serieBarras(ocupacionPor(activas, tramosActivos, dias, bloqueos, 'psicologo'), nombrePsi, idsActivos, null),
    ocupacion_centro: serieBarras(ocupacionPor(activas, tramosActivos, dias, bloqueos, 'centro'), nombreCentro, idsCentros, null),
    anulacion_psi: serieBarras(anulacionPor([...activas, ...anuladas], 'psicologo'), nombrePsi, idsActivos),
    anulacion_centro: serieBarras(anulacionPor([...activas, ...anuladas], 'centro'), nombreCentro, idsCentros),
  }

  // ── Pacientes recientes (filtrada por centro, no por periodo) ──
  const pacientesRecientes: PacienteRow[] = pacientes.slice(0, 50).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono,
    estado: p.estado,
    psicologo_nombre:
      nombrePsi.get(p.psicologo_adultos_id ?? p.psicologo_pareja_id ?? p.psicologo_infantil_id ?? '') ?? 'Sin asignar',
    fecha_cita: p.fecha_cita,
    hora_cita: p.hora_cita,
    es_menor: p.es_menor,
    edad: p.edad,
    fecha_nacimiento: p.fecha_nacimiento,
    consentimiento: p.consentimiento,
    fecha_incorporacion: p.fecha_incorporacion,
  }))

  return (
    <ResumenDashboard
      rango={rango}
      hoy={hoy}
      etiquetaPeriodo={etiquetaRango(rango)}
      centros={centros}
      centroId={centroId}
      kpis={kpis}
      quesitos={quesitos}
      barras={barras}
      pacientesRecientes={pacientesRecientes}
      avisoHorario={tramos.length === 0}
    />
  )
}
