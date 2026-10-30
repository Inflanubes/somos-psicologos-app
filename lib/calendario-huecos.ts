/**
 * Cálculo puro de lo que la agenda semanal pinta además de las citas: huecos
 * libres de cada psicólogo (misma lógica que el formulario, `generarHuecos`),
 * bloqueos de días completos convertidos en una celda por hora de su horario,
 * marca de "primera cita" y cambios locales tras agendar/cambiar/anular
 * (Make escribe segundos después del webhook).
 */
import { generarHuecos, diaSemanaISO, type Bloqueo, type CitaOcupada } from './disponibilidad'
import { aMinutos, aHora, type Tramo } from './horarios'
import type { Instante } from './fechas'
import { bloqueoCubreDia, type EventoCalendario } from './calendario'

export type PsicologoAgenda = {
  id: string
  nombre: string
  activo: boolean
  /** psicologos.citas_media_hora */
  mediaHora: boolean
  /** Todas sus franjas, con `centro_id`. */
  tramos: Tramo[]
  /** Citas activas (todos sus centros). */
  citas: CitaOcupada[]
  bloqueos: Bloqueo[]
}

/**
 * Huecos libres por psicólogo y día (solo días >= hoy). Con `centroId`, se usan
 * las franjas de ese centro; sin él, se calcula por cada centro con franjas ese
 * día y las horas libres en varios centros se unen en un solo evento con `centros`.
 */
export function calcularLibres(
  psicologos: PsicologoAgenda[],
  dias: string[],
  ahora: Instante,
  centroId: string | null,
): EventoCalendario[] {
  const libres: EventoCalendario[] = []
  for (const p of psicologos) {
    for (const fecha of dias) {
      if (fecha < ahora.fecha) continue
      const dia = diaSemanaISO(fecha)
      const tramosDia = p.tramos.filter((t) => t.dia_semana === dia && t.centro_id)
      const centros = centroId ? [centroId] : Array.from(new Set(tramosDia.map((t) => t.centro_id as string)))
      const porHora = new Map<string, string[]>()
      for (const c of centros) {
        const tramos = tramosDia.filter((t) => t.centro_id === c)
        if (tramos.length === 0) continue
        const huecos = generarHuecos({
          tramos, citas: p.citas, bloqueos: p.bloqueos, fecha, mediaHora: p.mediaHora, incluirMedias: false, ahora,
        })
        for (const h of huecos) {
          if (h.estado !== 'libre') continue
          const lista = porHora.get(h.hora) ?? []
          lista.push(c)
          porHora.set(h.hora, lista)
        }
      }
      const horas = Array.from(porHora.keys()).sort((a, b) => aMinutos(a) - aMinutos(b))
      for (const hora of horas) {
        const enCentros = porHora.get(hora) as string[]
        libres.push({
          id: `libre:${p.id}:${fecha}:${hora}`,
          tipo: 'libre',
          psicologoId: p.id,
          psicologoNombre: p.nombre,
          centroId: enCentros.length === 1 ? enCentros[0] : null,
          centros: enCentros.length > 1 ? enCentros : undefined,
          fecha,
          hora,
          tipoCita: null,
          iniciales: null,
          inicio: null,
          fin: null,
          motivo: null,
          primera: false,
          pacienteId: null,
        })
      }
    }
  }
  return libres
}

const PRIMERA_HORA_MIN = 8 * 60
const ULTIMA_HORA_MIN = 21 * 60

/**
 * Convierte cada bloqueo (rango de días) en un evento por hora en punto dentro
 * de las franjas del psicólogo ese día (cualquier centro). Sin franjas, nada.
 */
export function bloqueosPorHora(
  bloqueos: EventoCalendario[],
  tramosDe: Map<string, Tramo[]>,
  dias: string[],
): EventoCalendario[] {
  const salida: EventoCalendario[] = []
  for (const b of bloqueos) {
    const tramos = tramosDe.get(b.psicologoId) ?? []
    for (const fecha of dias) {
      if (!bloqueoCubreDia(b, fecha)) continue
      const dia = diaSemanaISO(fecha)
      const rangos = tramos.filter((t) => t.dia_semana === dia).map((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)] as const)
      for (let m = PRIMERA_HORA_MIN; m <= ULTIMA_HORA_MIN; m += 60) {
        if (!rangos.some(([ini, fin]) => ini <= m && m + 60 <= fin)) continue
        const hora = aHora(m)
        salida.push({ ...b, id: `${b.id}:${fecha}:${hora}`, fecha, hora })
      }
    }
  }
  return salida
}

export type HistorialAgendar = {
  accion_id: string | null
  paciente_id: string | null
  fecha_cita: string | null
  creado_en: string
}

/**
 * `primera = true` si el paciente no tiene en el histórico de "Agendar cita"
 * otra fila (accion_id distinto) con fecha anterior, o con la misma fecha y
 * creada antes que la fila de la propia cita. Sin fila propia (cita recién
 * creada), se compara solo por fecha.
 */
export function marcarPrimeras(citas: EventoCalendario[], historial: HistorialAgendar[]): EventoCalendario[] {
  return citas.map((c) => {
    if (c.tipo !== 'cita' || !c.pacienteId || !c.fecha) return { ...c, primera: false }
    const propia = historial.find((h) => h.accion_id === c.id)
    const hayAnterior = historial.some((h) => {
      if (h.paciente_id !== c.pacienteId || h.accion_id === c.id || !h.fecha_cita) return false
      if (h.fecha_cita < (c.fecha as string)) return true
      return h.fecha_cita === c.fecha && !!propia && h.creado_en < propia.creado_en
    })
    return { ...c, primera: !hayAnterior }
  })
}

export type AccionLocal =
  | { tipo: 'agendar'; cita: EventoCalendario }
  | { tipo: 'cambiar'; citaId: string; fecha: string; hora: string; centroId: string | null }
  | { tipo: 'anular'; citaId: string }

/**
 * Estado optimista de las citas tras un envío correcto. Los libres afectados
 * se recalculan fuera (quien llama vuelve a ejecutar `calcularLibres` con las
 * citas actualizadas). No muta la entrada.
 */
export function aplicarAccionLocal(eventos: EventoCalendario[], a: AccionLocal): EventoCalendario[] {
  if (a.tipo === 'agendar') return [...eventos, a.cita]
  return eventos.map((e) => {
    if (e.id !== a.citaId) return e
    if (a.tipo === 'anular') return { ...e, tipo: 'anulada' }
    return { ...e, fecha: a.fecha, hora: a.hora, centroId: a.centroId }
  })
}
