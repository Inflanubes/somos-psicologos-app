/**
 * Periodo compartido por Resumen de pacientes, Actividad de citas y el panel del
 * call center (bloque B8). Módulo puro: fechas 'YYYY-MM-DD' como texto, en hora
 * de Madrid, inclusivas. Un lado vacío ('') = sin límite por ese lado.
 *
 * Diseño: docs/superpowers/specs/2026-10-27-b8-paneles-estadisticas-design.md
 */

export type Rango = { desde: string; hasta: string }
export type AtajoKey = 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'ultimos_90' | 'siempre'

export const ATAJOS: { key: AtajoKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes pasado' },
  { key: 'ultimos_90', label: 'Últimos 90 días' },
  { key: 'siempre', label: 'Desde siempre' },
]

const TZ = 'Europe/Madrid'
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
/** Nada antes de esto: protege de años a medio teclear (0002…) y de datos basura. */
const PRIMER_DIA = '2000-01-01'
const ULTIMO_DIA = '2100-12-31'

/** 'YYYY-MM-DD' de un instante en hora de Madrid. */
export function fechaMadrid(d: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(d)
  )
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética en UTC, sin efectos de zona). */
export function sumarDias(fecha: string, n: number): string {
  const d = new Date(fecha + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function esFecha(f: string | undefined): f is string {
  if (!f || !FECHA_RE.test(f)) return false
  const d = new Date(f + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f && f >= PRIMER_DIA && f <= ULTIMO_DIA
}

/** Último día del mes de 'YYYY-MM-DD'. */
function finDeMes(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function rangoDeAtajo(key: AtajoKey, hoy: string): Rango {
  switch (key) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }
    case 'semana': {
      const dia = new Date(hoy + 'T00:00:00Z').getUTCDay() // 0 = domingo
      const lunes = sumarDias(hoy, -((dia + 6) % 7))
      return { desde: lunes, hasta: sumarDias(lunes, 6) }
    }
    case 'mes':
      return { desde: hoy.slice(0, 7) + '-01', hasta: finDeMes(hoy) }
    case 'mes_anterior': {
      const finAnterior = sumarDias(hoy.slice(0, 7) + '-01', -1)
      return { desde: finAnterior.slice(0, 7) + '-01', hasta: finAnterior }
    }
    case 'ultimos_90':
      return { desde: sumarDias(hoy, -89), hasta: hoy }
    case 'siempre':
      return { desde: '', hasta: '' }
  }
}

function esAtajo(k: string | undefined): k is AtajoKey {
  return ATAJOS.some((a) => a.key === k)
}

/**
 * Rango a partir de la URL. Prioridad: fechas válidas (basta una) → atajo válido
 * → este mes. Si `desde > hasta` se intercambian.
 */
export function rangoDeParams(params: { desde?: string; hasta?: string; periodo?: string }, hoy: string): Rango {
  const desde = esFecha(params.desde) ? params.desde : ''
  const hasta = esFecha(params.hasta) ? params.hasta : ''
  if (desde || hasta) {
    if (desde && hasta && desde > hasta) return { desde: hasta, hasta: desde }
    return { desde, hasta }
  }
  if (esAtajo(params.periodo)) return rangoDeAtajo(params.periodo, hoy)
  return rangoDeAtajo('mes', hoy)
}

/** Atajo que coincide exactamente con el rango (para marcarlo activo), o null. */
export function atajoDeRango(rango: Rango, hoy: string): AtajoKey | null {
  for (const a of ATAJOS) {
    const r = rangoDeAtajo(a.key, hoy)
    if (r.desde === rango.desde && r.hasta === rango.hasta) return a.key
  }
  return null
}

export function enRango(fecha: string | null | undefined, rango: Rango): boolean {
  if (!fecha) return false
  const f = fecha.slice(0, 10)
  if (rango.desde && f < rango.desde) return false
  if (rango.hasta && f > rango.hasta) return false
  return true
}

/**
 * Lista de días del rango. Los lados abiertos se acotan con `limites` (primer y
 * último dato disponibles, que pasa la página), así "Desde siempre" no itera
 * desde el año 0. Sin límites utilizables → lista vacía.
 */
export function diasDelRango(rango: Rango, limites: { primero: string; ultimo: string }): string[] {
  const desde = rango.desde || (limites.primero && limites.primero < PRIMER_DIA ? PRIMER_DIA : limites.primero)
  const hasta = rango.hasta || limites.ultimo
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) return []
  const dias: string[] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d)
  return dias
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

function fechaLarga(f: string, conAnio: boolean): string {
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES[m - 1]}${conAnio ? ' ' + y : ''}`
}

/** '1 oct – 31 oct 2026', 'Desde siempre', 'Desde 5 oct 2026', 'Hasta 31 oct 2026'. */
export function etiquetaRango(rango: Rango): string {
  const { desde, hasta } = rango
  if (!desde && !hasta) return 'Desde siempre'
  if (!hasta) return `Desde ${fechaLarga(desde, true)}`
  if (!desde) return `Hasta ${fechaLarga(hasta, true)}`
  if (desde === hasta) return fechaLarga(desde, true)
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  return `${fechaLarga(desde, !mismoAnio)} – ${fechaLarga(hasta, true)}`
}
