/**
 * Utilidades puras de la agenda semanal (Calendario y Citas): fechas de la
 * semana, filas de media hora, filtros y colores por estado.
 */
import { aMinutos, type Tramo } from './horarios'
import { diaSemanaISO } from './disponibilidad'

export type TipoEvento = 'cita' | 'anulada' | 'bloqueo' | 'libre'

export type EventoCalendario = {
  id: string
  tipo: TipoEvento
  psicologoId: string
  psicologoNombre: string
  centroId: string | null
  /** Cita: día y hora de inicio ('HH:MM'). */
  fecha: string | null
  hora: string | null
  tipoCita: string | null
  iniciales: string | null
  /** Bloqueo: rango de días completos, ambos incluidos (fin nulo = sin fin). */
  inicio: string | null
  fin: string | null
  motivo: string | null
  /** Cita: el paciente no tiene ninguna otra cita anterior (activa ni en el histórico). */
  primera: boolean
  pacienteId: string | null
  /** Libre sin filtro de centro: todos los centros donde esa hora está libre (centroId queda nulo). */
  centros?: string[]
}

/** '' = todos. tipoCita admite 'sin_tipo' para las citas sin tipo. */
export type FiltrosCalendario = { centroId: string; tipoCita: string; psicologoId: string }

export const TIPOS_CITA_FILTRO: { value: string; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'adulto', label: 'Adulto' },
  { value: 'pareja', label: 'Pareja' },
  { value: 'menor', label: 'Menor' },
  { value: 'sin_tipo', label: 'Sin tipo' },
]

/** Suma días a 'YYYY-MM-DD' (aritmética en UTC, sin efectos de zona). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana (ISO) que contiene la fecha. */
export function lunesDeSemana(fecha: string): string {
  return sumarDias(fecha, -(diaSemanaISO(fecha) - 1))
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

function fmt(fecha: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-ES', { ...opciones, timeZone: 'UTC' }).format(new Date(`${fecha}T00:00:00Z`))
}

/** '28 sept – 4 oct 2026' */
export function etiquetaRangoSemana(lunes: string): string {
  return `${fmt(lunes, { day: 'numeric', month: 'short' })} – ${fmt(sumarDias(lunes, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** 'lun 28' */
export function etiquetaDia(fecha: string): string {
  return fmt(fecha, { weekday: 'short', day: 'numeric' })
}

/** Filas de la rejilla: de 08:00 a 21:30 cada 30 minutos (28 filas). */
export const FILAS_HORA: string[] = []
for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) {
  FILAS_HORA.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}

/** Índice de fila de una hora ('HH:MM' o 'HH:MM:SS'); -1 si queda fuera de la franja. */
export function filaDeHora(hora: string): number {
  const m = aMinutos(hora)
  if (Number.isNaN(m) || m < 8 * 60 || m > 21 * 60 + 30) return -1
  return Math.floor((m - 8 * 60) / 30)
}

/** true cuando no hay filtro de centro ni de psicólogo: la rejilla muestra contadores "N libres" en vez de bloques. */
export function modoContador(f: FiltrosCalendario): boolean {
  return !f.centroId && !f.psicologoId
}

export function textoChip(n: number): string {
  return n === 1 ? '1 libre' : `${n} libres`
}

export function filtrarEventos(eventos: EventoCalendario[], f: FiltrosCalendario): EventoCalendario[] {
  return eventos.filter((e) => {
    if (f.centroId) {
      if (e.tipo === 'libre') {
        if (!(e.centros ? e.centros.includes(f.centroId) : e.centroId === f.centroId)) return false
      } else if (!(e.tipo === 'bloqueo' && e.centroId === null) && e.centroId !== f.centroId) {
        // Los bloqueos no tienen centro (afectan a la agenda entera): se ven con cualquier filtro.
        return false
      }
    }
    if (f.psicologoId && e.psicologoId !== f.psicologoId) return false
    if (f.tipoCita && (e.tipo === 'cita' || e.tipo === 'anulada')) {
      if (f.tipoCita === 'sin_tipo' ? e.tipoCita !== null : e.tipoCita !== f.tipoCita) return false
    }
    return true
  })
}

export function bloqueoCubreDia(e: EventoCalendario, fecha: string): boolean {
  return e.tipo === 'bloqueo' && !!e.inicio && e.inicio <= fecha && (e.fin == null || fecha <= e.fin)
}

/** true si la media hora [filaHora, filaHora + 30) cae dentro de un tramo del día. */
export function tramoCubreCelda(tramos: Tramo[], fecha: string, filaHora: string): boolean {
  const dia = diaSemanaISO(fecha)
  const m = aMinutos(filaHora)
  return tramos.some((t) => t.dia_semana === dia && aMinutos(t.hora_inicio) <= m && m + 30 <= aMinutos(t.hora_fin))
}

/** Filas de media hora que ocupa una cita (60 minutos). */
export const FILAS_POR_CITA = 2

/**
 * Reparte en columnas los bloques de un mismo día que se solapan en el tiempo
 * (cada uno ocupa `filas` filas desde `fila`; por defecto FILAS_POR_CITA).
 * Devuelve, por id, la columna asignada y el total de columnas de su grupo de
 * solapamiento, para pintarlos lado a lado a ancho `1/total` como hace un calendario.
 */
export function distribuirColumnas(
  citas: { id: string; fila: number; filas?: number }[],
  filasPorCita = FILAS_POR_CITA,
): Map<string, { col: number; total: number }> {
  const resultado = new Map<string, { col: number; total: number }>()
  const orden = [...citas].sort((a, b) => a.fila - b.fila || a.id.localeCompare(b.id))
  let finColumnas: number[] = [] // fila en la que queda libre cada columna del grupo actual
  let grupo: { id: string; col: number }[] = []
  let finGrupo = -Infinity

  const cerrarGrupo = () => {
    for (const g of grupo) resultado.set(g.id, { col: g.col, total: finColumnas.length })
    grupo = []
    finColumnas = []
  }

  for (const c of orden) {
    if (c.fila >= finGrupo) cerrarGrupo()
    let col = finColumnas.findIndex((fin) => fin <= c.fila)
    if (col === -1) {
      col = finColumnas.length
      finColumnas.push(0)
    }
    const fin = c.fila + (c.filas ?? filasPorCita)
    finColumnas[col] = fin
    finGrupo = Math.max(finGrupo, fin)
    grupo.push({ id: c.id, col })
  }
  cerrarGrupo()
  return resultado
}

/** Estado que decide el color de un bloque de la agenda. */
export type EstadoVisual = 'libre' | 'ocupada' | 'primera' | 'anulada' | 'bloqueo'

export type ColorEstado = { fondo: string; borde: string; texto: string; bordeEstilo?: 'dashed'; tachado?: true }

/** Colores por estado (fondo, borde izquierdo y texto). Tabla de la especificación de B2. */
export const COLORES_ESTADO: Record<EstadoVisual, ColorEstado> = {
  libre: { fondo: '#e3edff', borde: '#2f5aae', texto: '#1f3f80' },
  ocupada: { fondo: '#fee2e2', borde: '#dc2626', texto: '#7f1d1d' },
  primera: { fondo: '#fff1dc', borde: '#ed8f0c', texto: '#8a5200' },
  anulada: { fondo: '#ffffff', borde: '#dc2626', texto: '#991b1b', bordeEstilo: 'dashed', tachado: true },
  bloqueo: { fondo: '#e5e7eb', borde: '#4b5563', texto: '#1f2937' },
}

export function estadoVisual(e: EventoCalendario): EstadoVisual {
  if (e.tipo === 'libre') return 'libre'
  if (e.tipo === 'bloqueo') return 'bloqueo'
  if (e.tipo === 'anulada') return 'anulada'
  return e.primera ? 'primera' : 'ocupada'
}

export const LEYENDA: { estado: EstadoVisual; etiqueta: string }[] = [
  { estado: 'libre', etiqueta: 'Libre' },
  { estado: 'ocupada', etiqueta: 'Ocupada' },
  { estado: 'primera', etiqueta: 'Primera cita' },
  { estado: 'anulada', etiqueta: 'Anulada' },
  { estado: 'bloqueo', etiqueta: 'Bloqueada' },
]

export function etiquetaTipoCita(tipo: string | null): string {
  if (tipo === 'adulto') return 'Adulto'
  if (tipo === 'pareja') return 'Pareja'
  if (tipo === 'menor') return 'Menor'
  return 'Sin tipo'
}
