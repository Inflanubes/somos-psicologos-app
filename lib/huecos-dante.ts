/**
 * Huecos para Dante (módulo puro, con tests): próximos huecos libres de un
 * psicólogo en un centro, motivo cuando no hay, elección del psicólogo con el
 * hueco más próximo y comprobación de una hora concreta antes de mandarla a
 * Make. Usa las mismas reglas que el formulario de Citas (`generarHuecos`).
 */
import { generarHuecos, type EstadoHueco } from './disponibilidad'
import type { DatosDisponibilidad } from './disponibilidad-datos'
import { aMinutos, normalizarHora } from './horarios'
import type { Instante } from './fechas'

/** Días vista al buscar huecos. */
export const DIAS_VISTA = 14
/** Huecos como máximo en una respuesta. */
export const MAX_HUECOS = 10

export type HuecoFecha = { fecha: string; hora: string }

export type MotivoSinHuecos = 'sin_horario_en_centro' | 'centro_inactivo' | 'sin_huecos' | 'psicologo_inactivo'

/** Suma días a 'YYYY-MM-DD' (aritmética en UTC, como diaSemanaISO). */
export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Próximos huecos libres desde `desde` (o desde hoy si falta o ya ha pasado),
 * durante `dias` días, como mucho `max`. Solo horas en punto (o y media si el
 * psicólogo las tiene activas), con más de 2 h de antelación y dentro de franja.
 */
export function proximosHuecos(
  datos: DatosDisponibilidad,
  ahora: Instante,
  desde?: string,
  max = MAX_HUECOS,
  dias = DIAS_VISTA,
): HuecoFecha[] {
  const inicio = desde && desde > ahora.fecha ? desde : ahora.fecha
  const huecos: HuecoFecha[] = []
  for (let i = 0; i < dias && huecos.length < max; i++) {
    const fecha = sumarDias(inicio, i)
    const delDia = generarHuecos({ ...datos, fecha, incluirMedias: false, ahora, centroInactivo: !datos.centroActivo })
    for (const h of delDia) {
      if (h.estado !== 'libre') continue
      huecos.push({ fecha, hora: h.hora })
      if (huecos.length >= max) break
    }
  }
  return huecos
}

/** Por qué no hay huecos: lo más grave primero. */
export function motivoSinHuecos(datos: DatosDisponibilidad): MotivoSinHuecos {
  if (!datos.centroActivo) return 'centro_inactivo'
  if (datos.tramos.length === 0) return 'sin_horario_en_centro'
  return 'sin_huecos'
}

/**
 * El candidato cuyo primer hueco es más temprano (fecha y luego hora); empate
 * por nombre. null si ninguno tiene huecos.
 */
export function elegirMasProximo<T extends { nombre: string; huecos: HuecoFecha[] }>(candidatos: T[]): T | null {
  let mejor: T | null = null
  for (const c of candidatos) {
    const h = c.huecos[0]
    if (!h) continue
    if (!mejor) { mejor = c; continue }
    const m = mejor.huecos[0]
    const cmp = h.fecha.localeCompare(m.fecha) || h.hora.localeCompare(m.hora) || c.nombre.localeCompare(mejor.nombre, 'es')
    if (cmp < 0) mejor = c
  }
  return mejor
}

/**
 * ¿Se puede agendar (o cambiar, con `excluirAccionId`) a esa fecha y hora?
 * Aplica todas las reglas sin límite de días ni de huecos. Con `excluirAccionId`
 * (cambiar cita) el centro apagado no bloquea: solo veta citas nuevas.
 */
export function comprobarHueco(
  datos: DatosDisponibilidad,
  ahora: Instante,
  fecha: string,
  hora: string,
  excluirAccionId?: string,
): { ok: true } | { ok: false; motivo: EstadoHueco | 'hora_no_valida' } {
  if (Number.isNaN(aMinutos(hora))) return { ok: false, motivo: 'hora_no_valida' }
  const horaNorm = normalizarHora(hora)
  const hueco = generarHuecos({
    ...datos,
    fecha,
    incluirMedias: true,
    ahora,
    excluirAccionId,
    centroInactivo: !datos.centroActivo && !excluirAccionId,
  }).find((h) => h.hora === horaNorm)
  if (!hueco) return { ok: false, motivo: 'hora_no_valida' }
  if (hueco.estado === 'libre') return { ok: true }
  return { ok: false, motivo: hueco.estado }
}
