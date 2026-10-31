/**
 * Indicadores de Resumen de pacientes y Actividad de citas (bloque B8). Módulo
 * puro: sin React ni Supabase; las páginas leen las tablas y llaman a esto.
 *
 * Reglas (spec B8): las citas se cuentan por `fecha_cita`; un hueco = una hora
 * de tramo de horario; los bloqueos son días completos y restan las horas de
 * los tramos de ese día; las tasas se redondean a entero y son null si no hay
 * con qué dividir.
 *
 * Diseño: docs/superpowers/specs/2026-10-27-b8-paneles-estadisticas-design.md
 */

import { aMinutos, type Tramo } from './horarios'
import { diasDelRango, enRango, type Rango } from './periodo'

export type CitaKpi = {
  id: string
  paciente_id: string | null
  psicologo_id: string | null
  centro_id: string | null
  fecha_cita: string | null
  tipo_cita: 'adulto' | 'pareja' | 'menor' | null
  anulada: boolean
}

export type PacienteKpi = {
  id: string
  fecha_incorporacion: string | null
  es_menor: boolean
  centro_id: string | null
  origen: string | null
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
  pareja_de: string | null
  estado: string
}

export type BloqueoKpi = {
  psicologo_id: string | null
  fecha_bloqueo_inicio: string | null
  fecha_bloqueo_fin: string | null
  motivo_bloqueo: string | null
  creado_en: string | null
}

export type TramoKpi = Tramo & { psicologo_id: string; centro_id: string }

export type Limites = { primero: string; ultimo: string }

export const ETIQUETA_ORIGEN: Record<string, string> = {
  dante: 'Dante',
  agente: 'Agentes',
  call_center: 'Call center',
  psicologo: 'Psicólogos',
  inspeccion: 'Agentes',
}

export const ETIQUETA_TIPO: Record<string, string> = {
  adulto: 'Adultos',
  pareja: 'Pareja',
  menor: 'Infantil',
}

/** Motivo de un bloqueo sin motivo guardado. */
export const MOTIVO_SIN_DATO = 'Otros'

/**
 * Una fila de acciones_psicologos es una cita anulada si su acción es 'Cancelar
 * cita', o si tiene activo = false Y el historial guarda su anulación. Sin esto
 * último, las citas pasadas que la migración 003 dejó en activo = false (sesiones
 * atendidas) contarían como anuladas.
 */
export function esAnulada(
  c: { id: string; accion: string; activo: boolean | null },
  idsConAnulacion: Set<string>,
): boolean {
  if (c.accion === 'Cancelar cita') return true
  return c.activo === false && idsConAnulacion.has(c.id)
}

export function citasDelPeriodo(citas: CitaKpi[], rango: Rango): { activas: CitaKpi[]; anuladas: CitaKpi[] } {
  const activas: CitaKpi[] = []
  const anuladas: CitaKpi[] = []
  for (const c of citas) {
    if (!enRango(c.fecha_cita, rango)) continue
    if (c.anulada) anuladas.push(c)
    else activas.push(c)
  }
  return { activas, anuladas }
}

/** Porcentaje entero; null si no hay total. */
export function tasa(parte: number, total: number): number | null {
  if (!total) return null
  return Math.round((parte / total) * 100)
}

/** Día ISO (1 = lunes … 7 = domingo) de 'YYYY-MM-DD'. */
function diaIso(fecha: string): number {
  const d = new Date(fecha.slice(0, 10) + 'T00:00:00Z').getUTCDay()
  return d === 0 ? 7 : d
}

function horasDeTramo(t: Tramo): number {
  const min = aMinutos(t.hora_fin) - aMinutos(t.hora_inicio)
  return Number.isFinite(min) && min > 0 ? min / 60 : 0
}

/** Horas de los tramos que caen en el día de la semana de `dia`. */
export function horasTramos(tramos: TramoKpi[], dia: string): number {
  const iso = diaIso(dia)
  let h = 0
  for (const t of tramos) if (t.dia_semana === iso) h += horasDeTramo(t)
  return h
}

/** Días del bloqueo (inicio..fin; sin fin = un día) recortados al rango. */
function diasBloqueo(b: BloqueoKpi, rango: Rango, limites: Limites): string[] {
  if (!b.fecha_bloqueo_inicio) return []
  const inicio = b.fecha_bloqueo_inicio.slice(0, 10)
  const fin = (b.fecha_bloqueo_fin ?? b.fecha_bloqueo_inicio).slice(0, 10)
  const desde = rango.desde && rango.desde > inicio ? rango.desde : inicio
  const hasta = rango.hasta && rango.hasta < fin ? rango.hasta : fin
  // El bloqueo ya trae sus dos extremos: los límites solo sirven si faltara alguno.
  return diasDelRango({ desde, hasta }, limites)
}

/** Horas de horario del psicólogo que el bloqueo tapa dentro del rango. */
export function horasBloqueo(b: BloqueoKpi, tramos: TramoKpi[], rango: Rango, limites: Limites): number {
  const suyos = tramos.filter((t) => t.psicologo_id === b.psicologo_id)
  if (!suyos.length) return 0
  let h = 0
  for (const dia of diasBloqueo(b, rango, limites)) h += horasTramos(suyos, dia)
  return h
}

function bloqueado(psicologoId: string, dia: string, bloqueos: BloqueoKpi[]): boolean {
  return bloqueos.some((b) => {
    if (b.psicologo_id !== psicologoId || !b.fecha_bloqueo_inicio) return false
    const inicio = b.fecha_bloqueo_inicio.slice(0, 10)
    const fin = (b.fecha_bloqueo_fin ?? b.fecha_bloqueo_inicio).slice(0, 10)
    return dia >= inicio && dia <= fin
  })
}

/** Huecos (horas) de los tramos en los días dados, sin los días bloqueados de cada psicólogo. */
export function horasAbiertas(tramos: TramoKpi[], dias: string[], bloqueos: BloqueoKpi[]): number {
  const porPsicologo = new Map<string, TramoKpi[]>()
  for (const t of tramos) porPsicologo.set(t.psicologo_id, [...(porPsicologo.get(t.psicologo_id) ?? []), t])
  let h = 0
  porPsicologo.forEach((suyos, psi) => {
    for (const dia of dias) {
      if (bloqueado(psi, dia, bloqueos)) continue
      h += horasTramos(suyos, dia)
    }
  })
  return h
}

/** Fichas de pareja nuevas; dos fichas enlazadas por `pareja_de` (en cualquier sentido) son una pareja. */
export function parejasNuevas(nuevos: PacienteKpi[]): number {
  const deParejas = nuevos.filter((p) => p.psicologo_pareja_id)
  const ids = new Set(deParejas.map((p) => p.id))
  const contadas = new Set<string>()
  let n = 0
  for (const p of deParejas) {
    if (contadas.has(p.id)) continue
    contadas.add(p.id)
    // Su pareja, si también es nueva: la que apunta a ella o a la que ella apunta.
    const otra = (p.pareja_de && ids.has(p.pareja_de) ? p.pareja_de : null) ??
      deParejas.find((q) => q.pareja_de === p.id && !contadas.has(q.id))?.id ?? null
    if (otra) contadas.add(otra)
    n++
  }
  return n
}

export function kpisResumen(d: {
  citas: CitaKpi[]
  pacientes: PacienteKpi[]
  bloqueos: BloqueoKpi[]
  tramos: TramoKpi[]
  /** Psicólogos con la ficha activa: solo sus tramos cuentan como huecos. */
  psicologosActivos: string[]
  rango: Rango
  limites: Limites
}) {
  const { activas, anuladas } = citasDelPeriodo(d.citas, d.rango)
  const nuevos = d.pacientes.filter((p) => enRango(p.fecha_incorporacion, d.rango))
  const activos = new Set(d.psicologosActivos)
  const huecos = horasAbiertas(
    d.tramos.filter((t) => activos.has(t.psicologo_id)),
    diasDelRango(d.rango, d.limites),
    d.bloqueos,
  )
  return {
    pacientesCitados: new Set(activas.map((c) => c.paciente_id).filter(Boolean)).size,
    citasAgendadas: activas.length,
    pacientesNuevos: nuevos.length,
    tasaAnulacion: tasa(anuladas.length, activas.length + anuladas.length),
    menoresNuevos: nuevos.filter((p) => p.es_menor).length,
    psicologosActivos: new Set(activas.map((c) => c.psicologo_id).filter(Boolean)).size,
    parejasNuevas: parejasNuevas(nuevos),
    ocupacion: tasa(activas.length, huecos),
    huecos,
  }
}

export type KpisResumen = ReturnType<typeof kpisResumen>

export type DatoBarra = { etiqueta: string; valor: number | null }

/**
 * Serie para las barras: todos los `ids` (los que no tienen valor salen con
 * `faltante`, 0 por defecto) más los que tienen valor aunque no estén en la lista.
 * De mayor a menor, null al final.
 */
export function serieBarras(
  valores: Map<string, number | null>,
  nombres: Map<string, string>,
  ids: string[],
  faltante: number | null = 0,
): DatoBarra[] {
  const claves = Array.from(new Set([...ids, ...Array.from(valores.keys())]))
  return claves
    .map((k) => ({ etiqueta: nombres.get(k) ?? k, valor: valores.has(k) ? (valores.get(k) as number | null) : faltante }))
    .sort((a, b) => {
      if (a.valor === null && b.valor === null) return a.etiqueta.localeCompare(b.etiqueta, 'es')
      if (a.valor === null) return 1
      if (b.valor === null) return -1
      return b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es')
    })
}

export function contarPor<T>(items: T[], clave: (t: T) => string | null, sinDato: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = clave(it) ?? sinDato
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/** Ocupación (%) por psicólogo o centro; null donde no hay huecos. */
export function ocupacionPor(
  citasActivas: CitaKpi[],
  tramos: TramoKpi[],
  dias: string[],
  bloqueos: BloqueoKpi[],
  por: 'psicologo' | 'centro',
): Map<string, number | null> {
  const campo = por === 'psicologo' ? 'psicologo_id' : 'centro_id'
  const citasPor = contarPor(citasActivas.filter((c) => c[campo]), (c) => c[campo], '')
  const tramosPor = new Map<string, TramoKpi[]>()
  for (const t of tramos) tramosPor.set(t[campo], [...(tramosPor.get(t[campo]) ?? []), t])
  const claves = new Set([...Array.from(citasPor.keys()), ...Array.from(tramosPor.keys())])
  const m = new Map<string, number | null>()
  claves.forEach((k) => {
    m.set(k, tasa(citasPor.get(k) ?? 0, horasAbiertas(tramosPor.get(k) ?? [], dias, bloqueos)))
  })
  return m
}

/** Anulación (%) por psicólogo o centro: anuladas / total de citas de cada uno. */
export function anulacionPor(citas: CitaKpi[], por: 'psicologo' | 'centro'): Map<string, number | null> {
  const campo = por === 'psicologo' ? 'psicologo_id' : 'centro_id'
  const total = contarPor(citas.filter((c) => c[campo]), (c) => c[campo], '')
  const anuladas = contarPor(citas.filter((c) => c[campo] && c.anulada), (c) => c[campo], '')
  const m = new Map<string, number | null>()
  total.forEach((n, k) => m.set(k, tasa(anuladas.get(k) ?? 0, n)))
  return m
}

/** Horas bloqueadas agrupadas por psicólogo o por motivo. */
export function horasBloqueoPor(
  bloqueos: BloqueoKpi[],
  tramos: TramoKpi[],
  rango: Rango,
  limites: Limites,
  por: 'psicologo' | 'motivo',
): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of bloqueos) {
    const k = por === 'psicologo' ? b.psicologo_id : b.motivo_bloqueo || MOTIVO_SIN_DATO
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + horasBloqueo(b, tramos, rango, limites))
  }
  return m
}
