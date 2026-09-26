/**
 * Reglas de disponibilidad de un psicólogo para agendar citas. Módulo puro
 * (sin React ni Supabase): recibe tramos, citas y bloqueos ya cargados y
 * devuelve los huecos con su estado. Toda cita dura 60 minutos.
 */
import { aMinutos, aHora, DIAS_SEMANA, type Tramo } from './horarios'

export type { Tramo }

/** Cita activa que ocupa una hora. `hora` 'HH:MM' o 'HH:MM:SS'. */
export type CitaOcupada = { fecha: string; hora: string; accionId?: string }
/** Bloqueo de días completos, ambos incluidos. `fin` nulo = sin fin. */
export type Bloqueo = { inicio: string; fin: string | null; motivo?: string | null }

export type EstadoHueco = 'libre' | 'ocupado' | 'fuera_horario' | 'media_hora'
export type Hueco = { hora: string; estado: EstadoHueco }

export type ParamsHuecos = {
  /** Horario de la ficha. Vacío = sin restricción de horario. */
  tramos: Tramo[]
  /** Citas activas de la persona (todas sus fichas). */
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

/** true si trabaja ese día. Sin tramos = sin restricción = true. */
export function trabajaEseDia(tramos: Tramo[], fecha: string): boolean {
  if (tramos.length === 0) return true
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

  const huecos: Hueco[] = []
  for (let m = PRIMER_INICIO_MIN; m <= ULTIMO_INICIO_MIN; m += paso) {
    const fin = m + DURACION_CITA_MIN
    let estado: EstadoHueco = 'libre'
    if (bloqueado || iniciosOcupados.some((c) => c < fin && c + DURACION_CITA_MIN > m)) {
      estado = 'ocupado'
    } else if (p.tramos.length > 0 && !tramosDia.some(([ini, f]) => ini <= m && fin <= f)) {
      estado = 'fuera_horario'
    } else if (m % 60 !== 0 && !p.mediaHora) {
      estado = 'media_hora'
    }
    huecos.push({ hora: aHora(m), estado })
  }
  return huecos
}

export type ParamsAviso = ParamsHuecos & { hora: string; nombrePsicologo: string; nombreCentro: string }

/**
 * Motivo del aviso para agentes (modo aviso), sin "Aviso:" ni punto final.
 * null cuando la fecha y la hora elegidas son válidas.
 */
export function motivoAviso(p: ParamsAviso): string | null {
  if (!p.fecha) return null
  const bloqueo = diaBloqueado(p.bloqueos, p.fecha)
  if (bloqueo) return `la agenda de ${p.nombrePsicologo} está bloqueada ese día (${etiquetaMotivo(bloqueo.motivo)})`
  if (!trabajaEseDia(p.tramos, p.fecha)) return `${p.nombrePsicologo} no trabaja los ${nombreDia(p.fecha)} en ${p.nombreCentro}`
  if (!p.hora) return null
  const hueco = generarHuecos(p).find((h) => h.hora === p.hora)
  if (!hueco || hueco.estado === 'libre') return null
  if (hueco.estado === 'ocupado') return `${p.nombrePsicologo} ya tiene una cita a las ${p.hora}`
  if (hueco.estado === 'fuera_horario') return `las ${p.hora} quedan fuera del horario de ${p.nombrePsicologo} en ${p.nombreCentro}`
  return `${p.nombrePsicologo} no tiene activadas las citas a y media`
}
