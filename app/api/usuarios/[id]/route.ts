import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'
import { generateTempPassword } from '@/lib/temp-password'
import { validarTramos, type Tramo, type CentroHorario } from '@/lib/horarios'
import { TIPOS_CONSULTA } from '@/lib/pacientes-tipos'
import type { TipoCita } from '@/types/database'

type EditarBody = {
  tipo: 'psicologo' | 'agente' | 'call_center'
  nombre?: string
  telefono?: string | null
  email?: string | null     // email de contacto del registro, NO el de login
  centro_id?: string | null      // agentes y call center (un solo centro)
  centro_ids?: string[]          // psicólogos: sustituye sus filas de psicologos_centros
  tipos_consulta?: TipoCita[]    // psicólogos: tipos de consulta que pasa
  calendar_id?: string | null
  activo?: boolean
  puede_bloquear?: boolean   // permiso para bloquear/desbloquear la agenda
  citas_media_hora?: boolean // permite citas a y media
  horarios?: (Tramo & { centro_id?: string })[]  // horario semanal del psicólogo, cada franja con su centro; sustituye todas sus filas
  centro_activo?: { centro_id: string; activo: boolean } // interruptor "recibe citas nuevas" de un centro (migración 016)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await ctx.params
  const body = (await req.json()) as EditarBody
  const admin = createSupabaseAdmin()

  if (body.tipo === 'psicologo') {
    const campos: Record<string, unknown> = {}
    if (body.nombre !== undefined) campos.nombre = body.nombre.trim()
    if (body.telefono !== undefined) campos.telefono = body.telefono
    if (body.email !== undefined) campos.email = body.email
    if (body.calendar_id !== undefined) campos.calendar_id = body.calendar_id
    if (body.activo !== undefined) campos.activo = body.activo
    if (body.puede_bloquear !== undefined) campos.puede_bloquear = body.puede_bloquear
    if (body.citas_media_hora !== undefined) campos.citas_media_hora = body.citas_media_hora
    if (body.tipos_consulta !== undefined) {
      if (!Array.isArray(body.tipos_consulta)) return NextResponse.json({ error: 'Tipos de consulta no válidos' }, { status: 400 })
      const tipos = Array.from(new Set(body.tipos_consulta.filter((t) => TIPOS_CONSULTA.includes(t))))
      if (tipos.length === 0) return NextResponse.json({ error: 'Un psicólogo necesita al menos un tipo de consulta' }, { status: 400 })
      campos.tipos_consulta = tipos
    }

    if (Object.keys(campos).length > 0) {
      const upd = await admin.from('psicologos').update(campos).eq('id', id)
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }

    // Centros del psicólogo (migración 014): se sustituyen sus filas de psicologos_centros.
    if (body.centro_ids !== undefined) {
      if (!Array.isArray(body.centro_ids)) return NextResponse.json({ error: 'Centros no válidos' }, { status: 400 })
      const ids = Array.from(new Set(body.centro_ids.filter(Boolean)))
      if (ids.length === 0) return NextResponse.json({ error: 'Un psicólogo necesita al menos un centro' }, { status: 400 })
      const cs = await admin.from('centros').select('id').in('id', ids)
      if (cs.error) return NextResponse.json({ error: cs.error.message }, { status: 500 })
      if ((cs.data ?? []).length !== ids.length)
        return NextResponse.json({ error: 'Alguno de los centros seleccionados no existe' }, { status: 400 })
      // Se conserva el interruptor "recibe citas nuevas" de los centros que ya estaban.
      const actuales = await admin.from('psicologos_centros').select('centro_id, activo').eq('psicologo_id', id)
      if (actuales.error) return NextResponse.json({ error: actuales.error.message }, { status: 500 })
      const activoDe = new Map((actuales.data ?? []).map((pc) => [pc.centro_id, pc.activo]))
      const del = await admin.from('psicologos_centros').delete().eq('psicologo_id', id)
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
      const ins = await admin
        .from('psicologos_centros')
        .insert(ids.map((centro_id) => ({ psicologo_id: id, centro_id, activo: activoDe.get(centro_id) ?? true })))
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
      // Las franjas de horario de un centro que se quita se van con él.
      const delHorarios = await admin
        .from('horarios_psicologos')
        .delete()
        .eq('psicologo_id', id)
        .not('centro_id', 'in', `(${ids.join(',')})`)
      if (delHorarios.error) return NextResponse.json({ error: delHorarios.error.message }, { status: 500 })
    }

    // Interruptor "recibe citas nuevas" de un centro (psicologos_centros.activo).
    if (body.centro_activo !== undefined) {
      const { centro_id, activo } = body.centro_activo ?? {}
      if (typeof centro_id !== 'string' || typeof activo !== 'boolean') {
        return NextResponse.json({ error: 'Centro no válido' }, { status: 400 })
      }
      const upd = await admin
        .from('psicologos_centros')
        .update({ activo })
        .eq('psicologo_id', id)
        .eq('centro_id', centro_id)
        .select('centro_id')
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
      if ((upd.data ?? []).length === 0) {
        return NextResponse.json({ error: 'El psicólogo no trabaja en ese centro' }, { status: 400 })
      }
    }

    // Horario semanal del psicólogo, cada franja en un centro: se sustituyen
    // todas sus filas. Si el insert falla, se reponen las anteriores.
    if (body.horarios !== undefined) {
      if (!Array.isArray(body.horarios)) {
        return NextResponse.json({ error: 'Horario no válido' }, { status: 400 })
      }
      const nuevos: (Tramo & { centro_id: string })[] = body.horarios.map((h) => ({
        dia_semana: Number(h.dia_semana),
        hora_inicio: String(h.hora_inicio),
        hora_fin: String(h.hora_fin),
        centro_id: String(h.centro_id ?? ''),
      }))
      // Cada franja tiene que ser de un centro del psicólogo.
      const pcs = await admin.from('psicologos_centros').select('centro_id').eq('psicologo_id', id)
      if (pcs.error) return NextResponse.json({ error: pcs.error.message }, { status: 500 })
      const idsCentros = (pcs.data ?? []).map((pc) => pc.centro_id)
      if (nuevos.some((h) => !idsCentros.includes(h.centro_id))) {
        return NextResponse.json({ error: 'Cada franja necesita un centro del psicólogo' }, { status: 400 })
      }
      const centrosRes = idsCentros.length
        ? await admin.from('centros').select('id, nombre, es_online').in('id', idsCentros)
        : { data: [], error: null }
      if (centrosRes.error) return NextResponse.json({ error: centrosRes.error.message }, { status: 500 })
      const errorValidacion = validarTramos(nuevos, (centrosRes.data ?? []) as CentroHorario[])
      if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

      const previos = await admin
        .from('horarios_psicologos')
        .select('dia_semana, hora_inicio, hora_fin, centro_id, revisar')
        .eq('psicologo_id', id)
      if (previos.error) return NextResponse.json({ error: previos.error.message }, { status: 500 })

      const del = await admin.from('horarios_psicologos').delete().eq('psicologo_id', id)
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })

      if (nuevos.length > 0) {
        const ins = await admin
          .from('horarios_psicologos')
          .insert(nuevos.map((h) => ({ ...h, psicologo_id: id, revisar: false })))
        if (ins.error) {
          const anteriores = previos.data ?? []
          if (anteriores.length > 0) {
            await admin.from('horarios_psicologos').insert(anteriores.map((h) => ({ ...h, psicologo_id: id })))
          }
          return NextResponse.json({ error: 'No se pudo guardar el horario: ' + ins.error.message }, { status: 500 })
        }
      }
    }

    // Sincronizar nombre en perfiles (atribución coherente)
    if (body.nombre !== undefined) {
      await admin.from('perfiles').update({ nombre: body.nombre.trim() }).eq('psicologo_id', id)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.tipo === 'agente' || body.tipo === 'call_center') {
    const campos: Record<string, unknown> = {}
    if (body.nombre !== undefined) campos.nombre = body.nombre.trim()
    if (body.telefono !== undefined) campos.telefono = body.telefono
    if (body.centro_id !== undefined) campos.centro_id = body.centro_id
    if (body.activo !== undefined) campos.activo = body.activo

    const ag = await admin.from('agentes').update(campos).eq('id', id).select('auth_user_id').maybeSingle()
    if (ag.error) return NextResponse.json({ error: ag.error.message }, { status: 500 })

    if (body.nombre !== undefined && ag.data?.auth_user_id) {
      await admin.from('perfiles').update({ nombre: body.nombre.trim() }).eq('id', ag.data.auth_user_id)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}

// Restablecer acceso. Dos métodos:
//  - 'email'   → envía al usuario un email para que fije su propia contraseña (seguro).
//  - 'generar' → asigna una contraseña temporal que el agente entrega (respaldo).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await ctx.params
  const body = (await req.json()) as { tipo: 'psicologo' | 'agente' | 'call_center'; metodo?: 'email' | 'generar' }
  const metodo = body.metodo ?? 'email'
  const admin = createSupabaseAdmin()

  // Resolver la cuenta auth (id + email) del registro
  let userId: string | null = null
  if (body.tipo === 'psicologo') {
    const perfil = await admin.from('perfiles').select('id').eq('psicologo_id', id).maybeSingle()
    userId = perfil.data?.id ?? null
  } else {
    const ag = await admin.from('agentes').select('auth_user_id').eq('id', id).maybeSingle()
    userId = ag.data?.auth_user_id ?? null
  }
  if (!userId) return NextResponse.json({ error: 'No se encontró la cuenta de acceso' }, { status: 404 })

  const u = await admin.auth.admin.getUserById(userId)
  const email = u.data?.user?.email ?? null
  if (!email) return NextResponse.json({ error: 'La cuenta no tiene email de acceso' }, { status: 404 })

  if (metodo === 'generar') {
    const password = generateTempPassword()
    const upd = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, metodo: 'generar', email, password })
  }

  // metodo === 'email'
  const reset = await admin.auth.resetPasswordForEmail(email)
  if (reset.error) return NextResponse.json({ error: reset.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, metodo: 'email', email })
}
