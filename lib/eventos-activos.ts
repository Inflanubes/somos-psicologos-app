import { supabase } from '@/lib/supabase'

// The helper is parametrised by table name (acciones_psicologos now,
// acciones_call_center / agentes later), so we use a relaxed view of the client
// rather than the per-table typed `from`. Rows are cast explicitly below.
const sb = supabase as unknown as {
  from: (table: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Normalised option for the event selector dropdown.
 * Reusable across apps (psicólogos, call center, agentes) — only the source
 * table changes.
 */
export type EventoActivo = {
  /** Row id in the acciones_* table (used as the <select> value). */
  id: string
  /** Google Calendar event id — sent to the webhook so Make acts on the exact event. */
  gcalEventId: string | null
  /** Human-readable label already formatted for display. */
  label: string
  tipo: 'cita' | 'bloqueo'
}

/**
 * `accion` is a Postgres enum. Blocks are stored as 'Bloquear agenda' (a valid
 * enum value); the kind of block (Vacaciones / Baja laboral / Asuntos propios)
 * lives in `motivo_bloqueo`, NOT in `accion`.
 */
export const ACCION_BLOQUEO = 'Bloquear agenda'

/** Today's date as `YYYY-MM-DD` in the clinic's timezone (Europe/Madrid). */
export function todayISODate(): string {
  // 'en-CA' yields YYYY-MM-DD; timeZone keeps the day correct around midnight.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** "lun 16 jun 2026 · 17:00" */
export function formatCitaLabel(fecha: string | null, hora: string | null): string {
  let fechaTxt = fecha ?? ''
  if (fecha) {
    const d = new Date(`${fecha}T00:00:00`)
    if (!Number.isNaN(d.getTime())) {
      fechaTxt = new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d)
    }
  }
  const horaTxt = hora ? hora.slice(0, 5) : ''
  return [fechaTxt, horaTxt].filter(Boolean).join(' · ')
}

/** "1 jul – 15 jul 2026" (or a single date if inicio === fin). */
function formatRangoFechas(inicio: string | null, fin: string | null): string {
  const fmt = (s: string) => {
    const d = new Date(`${s}T00:00:00`)
    if (Number.isNaN(d.getTime())) return s
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  }
  if (inicio && fin && inicio !== fin) return `${fmt(inicio)} – ${fmt(fin)}`
  if (inicio) return fmt(inicio)
  if (fin) return fmt(fin)
  return ''
}

/** "Vacaciones · 1 jul – 15 jul 2026" */
export function formatBloqueoLabel(
  motivo: string | null,
  accion: string,
  inicio: string | null,
  fin: string | null,
): string {
  const etiquetaMotivo = motivo || accion || 'Bloqueo'
  const rango = formatRangoFechas(inicio, fin)
  return [etiquetaMotivo, rango].filter(Boolean).join(' · ')
}

/**
 * Active, upcoming appointments of a patient.
 * An appointment lives as an `Agendar cita` row; Make keeps it `activo=true`
 * and updates its date on "Cambiar cita".
 */
export async function fetchCitasActivas(params: {
  tabla: string
  psicologoId: string
  pacienteId: string
}): Promise<EventoActivo[]> {
  const { tabla, psicologoId, pacienteId } = params
  const hoy = todayISODate()

  const { data, error } = await sb
    .from(tabla)
    .select('id, gcal_event_id, fecha_cita, hora_cita')
    .eq('psicologo_id', psicologoId)
    .eq('paciente_id', pacienteId)
    .eq('accion', 'Agendar cita')
    .eq('activo', true)
    .gte('fecha_cita', hoy)
    .order('fecha_cita', { ascending: true })
    .order('hora_cita', { ascending: true })

  if (error) throw error

  type CitaRow = {
    id: string
    gcal_event_id: string | null
    fecha_cita: string | null
    hora_cita: string | null
  }
  return ((data ?? []) as CitaRow[]).map((r) => ({
    id: r.id,
    gcalEventId: r.gcal_event_id,
    label: formatCitaLabel(r.fecha_cita, r.hora_cita),
    tipo: 'cita' as const,
  }))
}

/**
 * Active, still-valid blocks of a psychologist (any motivo).
 * A block stays valid while its `fecha_bloqueo_fin` has not passed; rows with a
 * null end date are kept (we can't tell they expired).
 */
export async function fetchBloqueosActivos(params: {
  tabla: string
  psicologoId: string
  /**
   * true  → only blocks WITH a motivo (Vacaciones/Asuntos propios/Baja laboral) — "Modificar bloqueo"
   * false → only generic blocks (no motivo) — "Desbloquear agenda"
   * undefined → all blocks
   */
  conMotivo?: boolean
}): Promise<EventoActivo[]> {
  const { tabla, psicologoId, conMotivo } = params
  const hoy = todayISODate()

  let query = sb
    .from(tabla)
    .select('id, gcal_event_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, accion, motivo_bloqueo')
    .eq('psicologo_id', psicologoId)
    .eq('accion', ACCION_BLOQUEO)
    .eq('activo', true)
    .or(`fecha_bloqueo_fin.gte.${hoy},fecha_bloqueo_fin.is.null`)

  if (conMotivo === true) query = query.not('motivo_bloqueo', 'is', null)
  else if (conMotivo === false) query = query.is('motivo_bloqueo', null)

  const { data, error } = await query.order('fecha_bloqueo_inicio', { ascending: true })

  if (error) throw error

  type BloqueoRow = {
    id: string
    gcal_event_id: string | null
    fecha_bloqueo_inicio: string | null
    fecha_bloqueo_fin: string | null
    accion: string
    motivo_bloqueo: string | null
  }
  return ((data ?? []) as BloqueoRow[]).map((r) => ({
    id: r.id,
    gcalEventId: r.gcal_event_id,
    label: formatBloqueoLabel(r.motivo_bloqueo, r.accion, r.fecha_bloqueo_inicio, r.fecha_bloqueo_fin),
    tipo: 'bloqueo' as const,
  }))
}
