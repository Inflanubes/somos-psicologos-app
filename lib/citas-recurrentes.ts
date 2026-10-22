/**
 * Citas que se repiten (cada semana, cada 15 días o mensual) durante un tiempo, máximo un año.
 * Módulo puro: calcula las fechas de la serie y separa las que están libres de
 * las que no. Cada fecha libre se envía a Make como una cita normal.
 */
import { generarHuecos, type ParamsHuecos } from './disponibilidad'

export type FrecuenciaRepeticion = 'semanal' | 'quincenal' | 'mensual'

/** Mensual = cada 4 semanas, para que siempre caiga el mismo día de la semana. */
export const DIAS_ENTRE_CITAS: Record<FrecuenciaRepeticion, number> = { semanal: 7, quincenal: 14, mensual: 28 }
export const ETIQUETA_FRECUENCIA: Record<FrecuenciaRepeticion, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}
export const MESES_MAXIMO = 12
export const OPCIONES_MESES = [1, 2, 3, 6, 9, 12] as const

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function sumarMeses(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + meses)
  return d.toISOString().slice(0, 10)
}

/**
 * Fechas de la serie, empezando por `inicio` (incluida) y sin llegar al mismo
 * día `meses` meses después. `meses` se limita a 12.
 */
export function fechasSerie(inicio: string, frecuencia: FrecuenciaRepeticion, meses: number): string[] {
  if (!inicio) return []
  const fin = sumarMeses(inicio, Math.min(Math.max(meses, 0), MESES_MAXIMO))
  const paso = DIAS_ENTRE_CITAS[frecuencia]
  const fechas = [inicio]
  for (let f = sumarDias(inicio, paso); f < fin; f = sumarDias(f, paso)) fechas.push(f)
  return fechas
}

/**
 * Separa las fechas libres a esa hora de las que no. Una fecha con cita que se
 * solape o con la agenda bloqueada nunca vale. En modo restringido (psicólogo y
 * call center) además tiene que estar dentro del horario; el agente ya vio el
 * aviso de horario al elegir la primera fecha, así que eso no la descarta.
 */
export function comprobarSerie(
  fechas: string[],
  hora: string,
  disp: Omit<ParamsHuecos, 'fecha' | 'incluirMedias'>,
  restringido: boolean,
): { libres: string[]; noDisponibles: string[] } {
  const libres: string[] = []
  const noDisponibles: string[] = []
  for (const fecha of fechas) {
    const hueco = generarHuecos({ ...disp, fecha, incluirMedias: !restringido }).find((h) => h.hora === hora)
    const vale = restringido
      ? hueco?.estado === 'libre'
      : !!hueco && hueco.estado !== 'ocupado' && hueco.estado !== 'bloqueado'
    ;(vale ? libres : noDisponibles).push(fecha)
  }
  return { libres, noDisponibles }
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function formatoFechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

function listaFechas(fechas: string[]): string {
  const f = fechas.map(formatoFechaCorta)
  return f.length > 1 ? `${f.slice(0, -1).join(', ')} y ${f[f.length - 1]}` : f[0] ?? ''
}

/** Aviso para quien agenda con las fechas de la serie que no se han podido agendar. */
export function mensajeNoDisponibles(fechas: string[]): string {
  if (fechas.length === 1) {
    return `La fecha ${listaFechas(fechas)} no está disponible. Añádela por separado teniendo en cuenta la disponibilidad.`
  }
  return `Las fechas ${listaFechas(fechas)} no están disponibles. Añádelas por separado teniendo en cuenta la disponibilidad.`
}
