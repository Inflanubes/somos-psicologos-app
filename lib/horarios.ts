/**
 * Horarios semanales de los psicólogos (migración 012). Módulo puro: sin React
 * ni Supabase, para poder probarlo con Vitest y usarlo en cliente y servidor.
 */

/** Tramo de trabajo. dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM' o 'HH:MM:SS'. */
export type Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string }

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/** 'HH:MM' | 'HH:MM:SS' → minutos desde medianoche. NaN si no es una hora. */
export function aMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim())
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutos desde medianoche → 'HH:MM'. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 'HH:MM:SS' → 'HH:MM' (deja 'HH:MM' igual). */
export function normalizarHora(hora: string): string {
  return aHora(aMinutos(hora))
}

function tramosDelDia(tramos: Tramo[], dia: number): Array<readonly [number, number]> {
  return tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)] as const)
    .sort((a, b) => a[0] - b[0])
}

/**
 * Valida una lista de tramos. Devuelve el mensaje de error (en español) o null.
 * Reglas: día 1..7, horas válidas, fin posterior al inicio, sin solapamientos
 * dentro del mismo día (los tramos contiguos se permiten).
 */
export function validarTramos(tramos: Tramo[]): string | null {
  for (const t of tramos) {
    if (!Number.isInteger(t.dia_semana) || t.dia_semana < 1 || t.dia_semana > 7) {
      return 'Día de la semana no válido.'
    }
    const nombre = DIAS_SEMANA[t.dia_semana - 1]
    const ini = aMinutos(t.hora_inicio)
    const fin = aMinutos(t.hora_fin)
    if (Number.isNaN(ini) || Number.isNaN(fin)) return `Hora no válida en ${nombre}.`
    if (fin <= ini) return `En ${nombre} la hora de fin debe ser posterior a la de inicio.`
  }
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i][0] < delDia[i - 1][1]) return `Los tramos de ${DIAS_SEMANA[d - 1]} se solapan.`
    }
  }
  return null
}

/**
 * Resumen compacto para la tabla de Usuarios: 'L, X 09:00–14:00 · V 16:00–20:00'.
 * Los días con exactamente los mismos tramos se agrupan. '' si no hay tramos.
 */
export function resumenHorario(tramos: Tramo[]): string {
  const grupos: { dias: number[]; texto: string }[] = []
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    if (delDia.length === 0) continue
    const texto = delDia.map(([i, f]) => `${aHora(i)}–${aHora(f)}`).join(' y ')
    const grupo = grupos.find((g) => g.texto === texto)
    if (grupo) grupo.dias.push(d)
    else grupos.push({ dias: [d], texto })
  }
  return grupos.map((g) => `${g.dias.map((d) => DIAS_CORTOS[d - 1]).join(', ')} ${g.texto}`).join(' · ')
}
