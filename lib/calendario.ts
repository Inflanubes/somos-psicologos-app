/**
 * Utilidades puras de la pestaña Calendario (agenda semanal): fechas de la
 * semana, filas de media hora, filtros y colores por centro.
 */
import { aMinutos, type Tramo } from './horarios'
import { diaSemanaISO } from './disponibilidad'

export type TipoEvento = 'cita' | 'bloqueo'

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

export function filtrarEventos(eventos: EventoCalendario[], f: FiltrosCalendario): EventoCalendario[] {
  return eventos.filter((e) => {
    if (f.centroId && e.centroId !== f.centroId) return false
    if (f.psicologoId && e.psicologoId !== f.psicologoId) return false
    if (f.tipoCita && e.tipo === 'cita') {
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

/** Un color suave por centro (fondo, borde izquierdo y texto). */
export const PALETA_CENTROS = [
  { fondo: '#e3edff', borde: '#2f5aae', texto: '#1f3f80' },
  { fondo: '#e6f6ec', borde: '#1e7d4f', texto: '#155f3b' },
  { fondo: '#fff1dc', borde: '#ed8f0c', texto: '#8a5200' },
  { fondo: '#f3e8ff', borde: '#7c3aed', texto: '#4c1d95' },
  { fondo: '#ffe4e6', borde: '#e11d48', texto: '#9f1239' },
  { fondo: '#e0f7fa', borde: '#0e7490', texto: '#155e75' },
  { fondo: '#fef9c3', borde: '#a16207', texto: '#713f12' },
  { fondo: '#e5e7eb', borde: '#4b5563', texto: '#1f2937' },
] as const

export function colorCentro(indice: number): { fondo: string; borde: string; texto: string } {
  return PALETA_CENTROS[((indice % PALETA_CENTROS.length) + PALETA_CENTROS.length) % PALETA_CENTROS.length]
}

export function etiquetaTipoCita(tipo: string | null): string {
  if (tipo === 'adulto') return 'Adulto'
  if (tipo === 'pareja') return 'Pareja'
  if (tipo === 'menor') return 'Menor'
  return 'Sin tipo'
}
