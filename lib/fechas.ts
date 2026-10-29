/**
 * "Ahora" en la zona horaria de la clínica (Europe/Madrid). Módulo puro, sin
 * React ni Supabase: el instante se inyecta como parámetro para poder testear.
 */

/** Fecha 'YYYY-MM-DD' en Madrid y minutos desde la medianoche de Madrid. */
export type Instante = { fecha: string; minutos: number }

/** Antelación mínima para una cita nueva (minutos). Bloqueante salvo para agentes. */
export const ANTELACION_MIN = 120

const FORMATO_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Convierte un Date (instante absoluto) a fecha y minutos de Madrid. */
export function ahoraMadrid(d: Date = new Date()): Instante {
  const partes: Record<string, string> = {}
  for (const p of FORMATO_MADRID.formatToParts(d)) {
    if (p.type !== 'literal') partes[p.type] = p.value
  }
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  }
}

/**
 * Suma minutos sin pasar de medianoche: si se sale del día devuelve 23:59 de la
 * misma fecha. Basta para "ahora + 2 h" porque los huecos acaban a las 21:30.
 */
export function sumarMinutos(i: Instante, min: number): Instante {
  const total = i.minutos + min
  return { fecha: i.fecha, minutos: total >= 1440 ? 1439 : total }
}
