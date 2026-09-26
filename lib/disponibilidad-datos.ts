import { supabase } from '@/lib/supabase'
import { todayISODate } from '@/lib/eventos-activos'
import type { Tramo } from '@/lib/horarios'
import type { Bloqueo, CitaOcupada } from '@/lib/disponibilidad'

export type PsicologoDisponibilidad = {
  id: string
  nombre: string
  calendar_id: string | null
  citas_media_hora: boolean | null
}

export type DatosDisponibilidad = {
  tramos: Tramo[]
  citas: CitaOcupada[]
  bloqueos: Bloqueo[]
  mediaHora: boolean
}

/**
 * Carga lo que hace falta para calcular los huecos de una ficha de psicólogo:
 * - sus tramos de horario (solo de ESTA ficha: cada centro tiene su horario);
 * - las citas activas futuras y los bloqueos activos de TODAS las fichas de la
 *   misma persona (mismo calendar_id), porque comparten calendario y una cita
 *   en un centro la ocupa también en los demás.
 * Lanza el error de Supabase si alguna consulta falla (el hook lo traduce a
 * "sin restricción" + mensaje).
 */
export async function cargarDatosDisponibilidad(p: PsicologoDisponibilidad): Promise<DatosDisponibilidad> {
  const hoy = todayISODate()

  let fichas = [p.id]
  if (p.calendar_id) {
    const { data, error } = await supabase.from('psicologos').select('id').eq('calendar_id', p.calendar_id)
    if (error) throw error
    fichas = Array.from(new Set([p.id, ...(data ?? []).map((r) => r.id)]))
  }

  const [tramosRes, citasRes, bloqueosRes] = await Promise.all([
    supabase
      .from('horarios_psicologos')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('psicologo_id', p.id)
      .order('dia_semana')
      .order('hora_inicio'),
    supabase
      .from('acciones_psicologos')
      .select('id, fecha_cita, hora_cita')
      .in('psicologo_id', fichas)
      .eq('accion', 'Agendar cita')
      .eq('activo', true)
      .gte('fecha_cita', hoy),
    supabase
      .from('acciones_psicologos')
      .select('fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
      .in('psicologo_id', fichas)
      .eq('accion', 'Bloquear agenda')
      .eq('activo', true)
      .or(`fecha_bloqueo_fin.gte.${hoy},fecha_bloqueo_fin.is.null`),
  ])
  if (tramosRes.error) throw tramosRes.error
  if (citasRes.error) throw citasRes.error
  if (bloqueosRes.error) throw bloqueosRes.error

  return {
    tramos: (tramosRes.data ?? []) as Tramo[],
    citas: (citasRes.data ?? [])
      .filter((c) => c.fecha_cita && c.hora_cita)
      .map((c) => ({ fecha: c.fecha_cita as string, hora: c.hora_cita as string, accionId: c.id })),
    bloqueos: (bloqueosRes.data ?? [])
      .filter((b) => b.fecha_bloqueo_inicio)
      .map((b) => ({ inicio: b.fecha_bloqueo_inicio as string, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo })),
    mediaHora: !!p.citas_media_hora,
  }
}
