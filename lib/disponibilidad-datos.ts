import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { ahoraMadrid } from '@/lib/fechas'
import type { Tramo } from '@/lib/horarios'
import type { Bloqueo, CitaOcupada } from '@/lib/disponibilidad'

export type PsicologoDisponibilidad = {
  id: string
  nombre: string
  calendar_id: string | null
  citas_media_hora: boolean | null
}

export type DatosDisponibilidad = {
  /** Tramos del psicólogo en el centro pedido. */
  tramos: Tramo[]
  citas: CitaOcupada[]
  bloqueos: Bloqueo[]
  mediaHora: boolean
  /** true si tiene alguna franja en cualquier centro (para el mensaje "sin horario"). */
  tieneAlgunHorario: boolean
  /** psicologos_centros.activo para ese centro; sin fila = false. */
  centroActivo: boolean
}

/**
 * Carga lo que hace falta para calcular los huecos de un psicólogo en un centro:
 * - todas sus franjas de horario (se filtran por `centroId`; el total dice si
 *   tiene algún horario);
 * - si recibe citas nuevas en ese centro (`psicologos_centros.activo`);
 * - sus citas activas futuras y sus bloqueos activos, de todos los centros
 *   (una cita en cualquier centro ocupa la hora en todos).
 * El cliente de Supabase se inyecta: el del navegador desde el formulario de
 * Citas y el de service role desde el endpoint de Dante (sin React ni módulos
 * del navegador aquí). Lanza el error de Supabase si alguna consulta falla.
 */
export async function cargarDatosDisponibilidad(
  cliente: SupabaseClient<Database>,
  p: PsicologoDisponibilidad,
  centroId: string,
): Promise<DatosDisponibilidad> {
  const hoy = ahoraMadrid().fecha

  const [tramosRes, centroRes, citasRes, bloqueosRes] = await Promise.all([
    cliente
      .from('horarios_psicologos')
      .select('dia_semana, hora_inicio, hora_fin, centro_id')
      .eq('psicologo_id', p.id)
      .order('dia_semana')
      .order('hora_inicio'),
    cliente
      .from('psicologos_centros')
      .select('activo')
      .eq('psicologo_id', p.id)
      .eq('centro_id', centroId)
      .maybeSingle(),
    cliente
      .from('acciones_psicologos')
      .select('id, fecha_cita, hora_cita')
      .eq('psicologo_id', p.id)
      .eq('accion', 'Agendar cita')
      .eq('activo', true)
      .gte('fecha_cita', hoy),
    cliente
      .from('acciones_psicologos')
      .select('fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
      .eq('psicologo_id', p.id)
      .eq('accion', 'Bloquear agenda')
      .eq('activo', true)
      .or(`fecha_bloqueo_fin.gte.${hoy},fecha_bloqueo_fin.is.null`),
  ])
  if (tramosRes.error) throw tramosRes.error
  if (centroRes.error) throw centroRes.error
  if (citasRes.error) throw citasRes.error
  if (bloqueosRes.error) throw bloqueosRes.error

  const todos = (tramosRes.data ?? []) as Tramo[]
  return {
    tramos: todos.filter((t) => t.centro_id === centroId),
    citas: (citasRes.data ?? [])
      .filter((c) => c.fecha_cita && c.hora_cita)
      .map((c) => ({ fecha: c.fecha_cita as string, hora: c.hora_cita as string, accionId: c.id })),
    bloqueos: (bloqueosRes.data ?? [])
      .filter((b) => b.fecha_bloqueo_inicio)
      .map((b) => ({ inicio: b.fecha_bloqueo_inicio as string, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo })),
    mediaHora: !!p.citas_media_hora,
    tieneAlgunHorario: todos.length > 0,
    centroActivo: centroRes.data?.activo === true,
  }
}
