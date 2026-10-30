/**
 * Carga de Supabase de todo lo que la agenda semanal necesita para una semana:
 * citas y bloqueos activos, citas anuladas (opcional), histórico de "Agendar
 * cita" de los pacientes de la semana (para marcar la primera cita) y las
 * franjas de horario de los psicólogos pedidos (para calcular huecos libres y
 * pintar los bloqueos hora a hora). Sin React: lo usan los componentes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { Tramo } from './horarios'
import type { Bloqueo } from './disponibilidad'
import { sumarDias, type EventoCalendario } from './calendario'
import type { HistorialAgendar } from './calendario-huecos'

export type ParamsSemana = {
  /** 'YYYY-MM-DD', lunes de la semana visible. */
  lunes: string
  /** Psicólogos cuyas citas, bloqueos y franjas se cargan (el nombre va en cada evento). */
  psicologos: { id: string; nombre: string }[]
  /** Cargar también las citas anuladas de la semana (casilla "Ver anuladas"). */
  verAnuladas: boolean
}

export type SemanaCalendario = {
  citas: EventoCalendario[]
  bloqueos: EventoCalendario[]
  anuladas: EventoCalendario[]
  historial: HistorialAgendar[]
  tramosDe: Map<string, Tramo[]>
  bloqueosDe: Map<string, Bloqueo[]>
}

const VACIO = (): EventoCalendario => ({
  id: '', tipo: 'cita', psicologoId: '', psicologoNombre: '', centroId: null, fecha: null, hora: null,
  tipoCita: null, iniciales: null, inicio: null, fin: null, motivo: null, primera: false, pacienteId: null,
})

export async function cargarSemanaCalendario(
  cliente: SupabaseClient<Database>,
  p: ParamsSemana,
): Promise<SemanaCalendario> {
  const ids = p.psicologos.map((x) => x.id)
  const vacio: SemanaCalendario = {
    citas: [], bloqueos: [], anuladas: [], historial: [], tramosDe: new Map(), bloqueosDe: new Map(),
  }
  if (ids.length === 0) return vacio

  const domingo = sumarDias(p.lunes, 6)
  const nombreDe = new Map(p.psicologos.map((x) => [x.id, x.nombre]))
  const nombre = (id: string | null) => (id ? (nombreDe.get(id) ?? 'Psicólogo') : 'Psicólogo')

  const [citasRes, bloqueosRes, anuladasRes, tramosRes] = await Promise.all([
    cliente
      .from('acciones_psicologos')
      .select('id, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita, centro_id')
      .eq('accion', 'Agendar cita')
      .eq('activo', true)
      .in('psicologo_id', ids)
      .gte('fecha_cita', p.lunes)
      .lte('fecha_cita', domingo),
    cliente
      .from('acciones_psicologos')
      .select('id, psicologo_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
      .eq('accion', 'Bloquear agenda')
      .eq('activo', true)
      .in('psicologo_id', ids)
      .lte('fecha_bloqueo_inicio', domingo)
      .or(`fecha_bloqueo_fin.gte.${p.lunes},fecha_bloqueo_fin.is.null`),
    p.verAnuladas
      ? cliente
          .from('acciones_historial')
          .select('id, accion_id, psicologo_id, paciente_id, centro_id, fecha_cita, hora_cita, tipo_cita')
          .eq('accion', 'Cancelar cita')
          .in('psicologo_id', ids)
          .gte('fecha_cita', p.lunes)
          .lte('fecha_cita', domingo)
      : Promise.resolve({ data: [], error: null }),
    cliente
      .from('horarios_psicologos')
      .select('psicologo_id, dia_semana, hora_inicio, hora_fin, centro_id')
      .in('psicologo_id', ids),
  ])
  if (citasRes.error) throw citasRes.error
  if (bloqueosRes.error) throw bloqueosRes.error
  if (anuladasRes.error) throw anuladasRes.error
  if (tramosRes.error) throw tramosRes.error

  const filasCitas = citasRes.data ?? []
  const filasAnuladas = anuladasRes.data ?? []

  // Iniciales de los pacientes (citas y anuladas) e histórico de "Agendar cita" de los de la semana.
  const idsPacientes = Array.from(new Set(
    [...filasCitas, ...filasAnuladas].map((c) => c.paciente_id).filter((x): x is string => !!x),
  ))
  const iniciales = new Map<string, string | null>()
  let historial: HistorialAgendar[] = []
  if (idsPacientes.length > 0) {
    const [pacRes, histRes] = await Promise.all([
      cliente.from('pacientes').select('id, iniciales').in('id', idsPacientes),
      cliente
        .from('acciones_historial')
        .select('accion_id, paciente_id, fecha_cita, creado_en')
        .eq('accion', 'Agendar cita')
        .in('paciente_id', idsPacientes),
    ])
    if (pacRes.error) throw pacRes.error
    if (histRes.error) throw histRes.error
    for (const x of pacRes.data ?? []) iniciales.set(x.id, x.iniciales)
    historial = histRes.data ?? []
  }

  const citas: EventoCalendario[] = []
  for (const c of filasCitas) {
    if (!c.fecha_cita || !c.hora_cita || !c.psicologo_id) continue
    citas.push({
      ...VACIO(), id: c.id, tipo: 'cita', psicologoId: c.psicologo_id, psicologoNombre: nombre(c.psicologo_id),
      // Centro de la cita (migración 014); una cita antigua sin centro solo se ve en "Todos".
      centroId: c.centro_id ?? null, fecha: c.fecha_cita, hora: c.hora_cita.slice(0, 5), tipoCita: c.tipo_cita,
      iniciales: c.paciente_id ? (iniciales.get(c.paciente_id) ?? null) : null, pacienteId: c.paciente_id ?? null,
    })
  }

  const anuladas: EventoCalendario[] = []
  for (const c of filasAnuladas) {
    if (!c.fecha_cita || !c.hora_cita || !c.psicologo_id) continue
    anuladas.push({
      ...VACIO(), id: `anulada:${c.id}`, tipo: 'anulada', psicologoId: c.psicologo_id, psicologoNombre: nombre(c.psicologo_id),
      centroId: c.centro_id ?? null, fecha: c.fecha_cita, hora: c.hora_cita.slice(0, 5), tipoCita: c.tipo_cita,
      iniciales: c.paciente_id ? (iniciales.get(c.paciente_id) ?? null) : null, pacienteId: c.paciente_id ?? null,
    })
  }

  const bloqueos: EventoCalendario[] = []
  const bloqueosDe = new Map<string, Bloqueo[]>()
  for (const b of bloqueosRes.data ?? []) {
    if (!b.fecha_bloqueo_inicio || !b.psicologo_id) continue
    bloqueos.push({
      ...VACIO(), id: b.id, tipo: 'bloqueo', psicologoId: b.psicologo_id, psicologoNombre: nombre(b.psicologo_id),
      // Los bloqueos no tienen centro: afectan a toda la agenda del psicólogo.
      inicio: b.fecha_bloqueo_inicio, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo,
    })
    bloqueosDe.set(b.psicologo_id, [
      ...(bloqueosDe.get(b.psicologo_id) ?? []),
      { inicio: b.fecha_bloqueo_inicio, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo },
    ])
  }

  const tramosDe = new Map<string, Tramo[]>()
  for (const t of tramosRes.data ?? []) {
    tramosDe.set(t.psicologo_id, [
      ...(tramosDe.get(t.psicologo_id) ?? []),
      { dia_semana: t.dia_semana, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, centro_id: t.centro_id },
    ])
  }

  return { citas, bloqueos, anuladas, historial, tramosDe, bloqueosDe }
}
