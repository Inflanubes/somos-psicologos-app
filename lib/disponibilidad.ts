/**
 * Reglas de disponibilidad de un psicólogo para agendar citas. Módulo puro
 * (sin React ni Supabase): recibe tramos, citas y bloqueos ya cargados y
 * devuelve los huecos con su estado. Toda cita dura 60 minutos.
 *
 * Desde B1 (octubre 2026): los tramos vienen ya filtrados por el centro de la
 * cita; sin tramos no hay citas (antes era "sin restricción"); nadie agenda en
 * el pasado ni, salvo el agente con aviso, con menos de 2 h de antelación; y
 * un centro apagado para citas nuevas se marca como `centro_inactivo`.
 */
import { aMinutos, aHora, DIAS_SEMANA, type Tramo } from './horarios'
import { ANTELACION_MIN, sumarMinutos, type Instante } from './fechas'

export type { Tramo }

/** Cita activa que ocupa una hora. `hora` 'HH:MM' o 'HH:MM:SS'. */
export type CitaOcupada = { fecha: string; hora: string; accionId?: string }
/** Bloqueo de días completos, ambos incluidos. `fin` nulo = sin fin. */
export type Bloqueo = { inicio: string; fin: string | null; motivo?: string | null }

/**
 * ocupado = ya hay una cita que se solapa; pasado = la hora ya ha pasado (ninguno
 * de los dos lo salta nadie, tampoco el agente). antelacion = hoy con menos de
 * 2 h; bloqueado = día con bloqueo de agenda; centro_inactivo = el psicólogo no
 * recibe citas nuevas en ese centro; fuera_horario / media_hora = fuera de las
 * reglas del psicólogo. Estos últimos se ocultan a psicólogo y call center y
 * avisan al agente.
 */
export type EstadoHueco =
  | 'libre'
  | 'ocupado'
  | 'pasado'
  | 'antelacion'
  | 'bloqueado'
  | 'fuera_horario'
  | 'centro_inactivo'
  | 'media_hora'
export type Hueco = { hora: string; estado: EstadoHueco }

/** Nadie puede agendar en estos estados, ni el agente. */
export const ESTADOS_VETO_DURO: EstadoHueco[] = ['ocupado', 'pasado']
/** Solo los ve el agente con la casilla "Citar fuera de horario". */
export const ESTADOS_FUERA_HORARIO: EstadoHueco[] = ['bloqueado', 'fuera_horario', 'centro_inactivo']

export type ParamsHuecos = {
  /** Tramos del psicólogo en el centro de la cita. Vacío = no se le pueden dar citas. */
  tramos: Tramo[]
  /** Citas activas de la persona (todos sus centros). */
  citas: CitaOcupada[]
  /** Bloqueos activos de la persona. */
  bloqueos: Bloqueo[]
  /** 'YYYY-MM-DD' */
  fecha: string
  /** psicologos.citas_media_hora */
  mediaHora: boolean
  /** Modo aviso (agente): lista las y media aunque no estén activas. */
  incluirMedias: boolean
  /** Al cambiar una cita, su propia fila no ocupa. */
  excluirAccionId?: string
  /** "Ahora" en Madrid. Si falta, no se evalúan `pasado` ni `antelacion`. */
  ahora?: Instante
  /** El psicólogo no recibe citas nuevas en este centro (solo en "Agendar cita"). */
  centroInactivo?: boolean
}

export const DURACION_CITA_MIN = 60
export const PRIMER_INICIO_MIN = 8 * 60 // 08:00
export const ULTIMO_INICIO_MIN = 21 * 60 + 30 // 21:30 (con paso 60 el último es 21:00)

/** 1 = lunes … 7 = domingo. */
export function diaSemanaISO(fecha: string): number {
  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** 'lunes', 'martes'… */
export function nombreDia(fecha: string): string {
  return DIAS_SEMANA[diaSemanaISO(fecha) - 1].toLowerCase()
}

export function diaBloqueado(bloqueos: Bloqueo[], fecha: string): Bloqueo | null {
  return bloqueos.find((b) => b.inicio <= fecha && (b.fin == null || fecha <= b.fin)) ?? null
}

/** true si tiene algún tramo ese día de la semana. Sin tramos = false. */
export function trabajaEseDia(tramos: Tramo[], fecha: string): boolean {
  const dia = diaSemanaISO(fecha)
  return tramos.some((t) => t.dia_semana === dia)
}

/** 'Otros' y nulo se muestran como "Bloqueo"; los motivos con nombre, tal cual. */
export function etiquetaMotivo(motivo: string | null | undefined): string {
  return !motivo || motivo === 'Otros' ? 'Bloqueo' : motivo
}

export function generarHuecos(p: ParamsHuecos): Hueco[] {
  const paso = p.mediaHora || p.incluirMedias ? 30 : 60
  const dia = diaSemanaISO(p.fecha)
  const tramosDia = p.tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)] as const)
  const bloqueado = diaBloqueado(p.bloqueos, p.fecha) !== null
  const iniciosOcupados = p.citas
    .filter((c) => c.fecha === p.fecha && !(p.excluirAccionId && c.accionId === p.excluirAccionId))
    .map((c) => aMinutos(c.hora))
    .filter((m) => !Number.isNaN(m))
  // Límites de "pasado" y "antelación", solo si se conoce "ahora".
  const diaPasado = !!p.ahora && p.fecha < p.ahora.fecha
  const esHoy = !!p.ahora && p.fecha === p.ahora.fecha
  const minAhora = p.ahora?.minutos ?? -1
  const minAntelacion = p.ahora ? sumarMinutos(p.ahora, ANTELACION_MIN).minutos : -1

  const huecos: Hueco[] = []
  for (let m = PRIMER_INICIO_MIN; m <= ULTIMO_INICIO_MIN; m += paso) {
    const fin = m + DURACION_CITA_MIN
    let estado: EstadoHueco = 'libre'
    if (iniciosOcupados.some((c) => c < fin && c + DURACION_CITA_MIN > m)) {
      estado = 'ocupado'
    } else if (diaPasado || (esHoy && m <= minAhora)) {
      estado = 'pasado'
    } else if (esHoy && m < minAntelacion) {
      estado = 'antelacion'
    } else if (bloqueado) {
      estado = 'bloqueado'
    } else if (!tramosDia.some(([ini, f]) => ini <= m && fin <= f)) {
      estado = 'fuera_horario'
    } else if (p.centroInactivo) {
      estado = 'centro_inactivo'
    } else if (m % 60 !== 0 && !p.mediaHora) {
      estado = 'media_hora'
    }
    huecos.push({ hora: aHora(m), estado })
  }
  return huecos
}

/**
 * Estado optimista tras agendar o cambiar una cita: Make escribe la fila en
 * `acciones_psicologos` segundos después del webhook, así que la recarga
 * inmediata no la ve. Se añade la cita nueva en local y, al cambiar, se quita
 * la fila cambiada (su hora antigua queda libre). No muta la entrada.
 */
export function aplicarCitaLocal<T extends { citas: CitaOcupada[] }>(
  datos: T,
  cita: { fecha: string; hora: string },
  excluirAccionId?: string,
): T {
  const restantes = datos.citas.filter((c) => !(excluirAccionId && c.accionId === excluirAccionId))
  return { ...datos, citas: [...restantes, { fecha: cita.fecha, hora: cita.hora }] }
}

export type ParamsAviso = ParamsHuecos & {
  hora: string
  nombrePsicologo: string
  nombreCentro: string
  /** false = sin franjas en ningún centro (no solo en este). Por defecto true. */
  tieneAlgunHorario?: boolean
}

/**
 * Motivo del aviso para agentes (modo aviso), sin "Aviso:" ni punto final.
 * null cuando la fecha y la hora elegidas son válidas.
 */
export function motivoAviso(p: ParamsAviso): string | null {
  if (!p.fecha) return null
  const bloqueo = diaBloqueado(p.bloqueos, p.fecha)
  if (bloqueo) return `la agenda de ${p.nombrePsicologo} está bloqueada ese día (${etiquetaMotivo(bloqueo.motivo)})`
  if (p.tieneAlgunHorario === false) return `${p.nombrePsicologo} no tiene horario definido`
  if (!trabajaEseDia(p.tramos, p.fecha)) return `${p.nombrePsicologo} no trabaja los ${nombreDia(p.fecha)} en ${p.nombreCentro}`
  if (!p.hora) return null
  const hueco = generarHuecos(p).find((h) => h.hora === p.hora)
  if (!hueco || hueco.estado === 'libre') return null
  if (hueco.estado === 'ocupado') return `${p.nombrePsicologo} ya tiene una cita a las ${p.hora}`
  if (hueco.estado === 'pasado') return 'esa hora ya ha pasado'
  if (hueco.estado === 'antelacion') return 'quedan menos de 2 horas para esa cita'
  if (hueco.estado === 'bloqueado') return `la agenda de ${p.nombrePsicologo} está bloqueada ese día`
  if (hueco.estado === 'centro_inactivo') return `${p.nombrePsicologo} no recibe citas nuevas en ${p.nombreCentro}`
  if (hueco.estado === 'fuera_horario') return `las ${p.hora} quedan fuera del horario de ${p.nombrePsicologo} en ${p.nombreCentro}`
  return `${p.nombrePsicologo} no tiene activadas las citas a y media`
}
