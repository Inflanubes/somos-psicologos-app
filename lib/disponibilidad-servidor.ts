/**
 * Disponibilidad para Dante, lado servidor: orquesta las consultas con el
 * cliente admin (service role) y aplica la misma lógica que el formulario de
 * Citas (`cargarDatosDisponibilidad` + `huecos-dante`). Sin tests unitarios:
 * la lógica está testeada en lib/disponibilidad y lib/huecos-dante.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TipoCita } from '@/types/database'
import { cargarDatosDisponibilidad, type PsicologoDisponibilidad } from './disponibilidad-datos'
import { proximosHuecos, motivoSinHuecos, elegirMasProximo, comprobarHueco, type HuecoFecha, type MotivoSinHuecos } from './huecos-dante'
import type { Instante } from './fechas'

export type PeticionDisponibilidad =
  | { tipo: 'psicologo'; centro_id: string; psicologo_id: string; fecha_deseada?: string; tipo_consulta?: TipoCita }
  | { tipo: 'centro'; centro_id: string; fecha_deseada?: string; tipo_consulta?: TipoCita }
  | { tipo: 'comprobar'; psicologo_id: string; centro_id: string; fecha: string; hora: string; excluir_accion_id?: string }

export type RespuestaHuecos = {
  psicologo_id: string | null
  psicologo_nombre: string | null
  huecos: HuecoFecha[]
  motivo?: MotivoSinHuecos
  centros_alternativos?: { centro_id: string; nombre: string; primer_hueco: HuecoFecha }[]
}

export type RespuestaComprobar = { ok: true } | { ok: false; motivo: string }

type Admin = SupabaseClient<Database>
type PsicologoFila = PsicologoDisponibilidad & { activo: boolean; tipos_consulta: TipoCita[] }

async function leerPsicologo(admin: Admin, id: string): Promise<PsicologoFila | null> {
  const r = await admin
    .from('psicologos')
    .select('id, nombre, activo, calendar_id, citas_media_hora, tipos_consulta')
    .eq('id', id)
    .maybeSingle()
  if (r.error) throw r.error
  if (!r.data) return null
  return { ...r.data, tipos_consulta: (r.data.tipos_consulta ?? []) as TipoCita[] }
}

export async function resolverDisponibilidad(
  admin: Admin,
  req: PeticionDisponibilidad,
  ahora: Instante,
): Promise<RespuestaHuecos | RespuestaComprobar> {
  if (req.tipo === 'comprobar') {
    const p = await leerPsicologo(admin, req.psicologo_id)
    if (!p || !p.activo) return { ok: false, motivo: 'psicologo_inactivo' }
    const datos = await cargarDatosDisponibilidad(admin, p, req.centro_id)
    return comprobarHueco(datos, ahora, req.fecha, req.hora, req.excluir_accion_id || undefined)
  }

  if (req.tipo === 'psicologo') {
    const p = await leerPsicologo(admin, req.psicologo_id)
    if (!p || !p.activo) return { psicologo_id: req.psicologo_id, psicologo_nombre: p?.nombre ?? null, huecos: [], motivo: 'psicologo_inactivo' }
    const datos = await cargarDatosDisponibilidad(admin, p, req.centro_id)
    const huecos = proximosHuecos(datos, ahora, req.fecha_deseada)
    if (huecos.length > 0) return { psicologo_id: p.id, psicologo_nombre: p.nombre, huecos }

    // Sin huecos en ese centro: motivo y, si los hay, otros centros del psicólogo con hueco.
    const otros = await admin
      .from('psicologos_por_centro')
      .select('centro_id, centro, centro_activo')
      .eq('id', p.id)
      .eq('centro_activo', true)
      .neq('centro_id', req.centro_id)
      .order('centro')
    if (otros.error) throw otros.error
    const alternativas: NonNullable<RespuestaHuecos['centros_alternativos']> = []
    for (const o of otros.data ?? []) {
      const d = await cargarDatosDisponibilidad(admin, p, o.centro_id)
      if (d.tramos.length === 0) continue
      const [primero] = proximosHuecos(d, ahora, req.fecha_deseada, 1)
      if (primero) alternativas.push({ centro_id: o.centro_id, nombre: o.centro, primer_hueco: primero })
    }
    return {
      psicologo_id: p.id,
      psicologo_nombre: p.nombre,
      huecos: [],
      motivo: motivoSinHuecos(datos),
      ...(alternativas.length > 0 ? { centros_alternativos: alternativas } : {}),
    }
  }

  // tipo === 'centro': el psicólogo del centro con el hueco más próximo.
  const filas = await admin
    .from('psicologos_por_centro')
    .select('id, nombre, activo, calendar_id, citas_media_hora, tipos_consulta, centro_activo')
    .eq('centro_id', req.centro_id)
    .eq('activo', true)
    .eq('centro_activo', true)
    .order('nombre')
  if (filas.error) throw filas.error
  const candidatos: { id: string; nombre: string; huecos: HuecoFecha[] }[] = []
  for (const f of filas.data ?? []) {
    const tipos = (f.tipos_consulta ?? []) as TipoCita[]
    if (req.tipo_consulta && !tipos.includes(req.tipo_consulta)) continue
    const datos = await cargarDatosDisponibilidad(admin, f, req.centro_id)
    candidatos.push({ id: f.id, nombre: f.nombre, huecos: proximosHuecos(datos, ahora, req.fecha_deseada) })
  }
  const mejor = elegirMasProximo(candidatos)
  if (!mejor) return { psicologo_id: null, psicologo_nombre: null, huecos: [], motivo: 'sin_huecos' }
  return { psicologo_id: mejor.id, psicologo_nombre: mejor.nombre, huecos: mejor.huecos }
}
