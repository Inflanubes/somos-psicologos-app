import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'

type EditarBody = {
  tipo: 'psicologo' | 'agente'
  nombre?: string
  telefono?: string | null
  email?: string | null     // email de contacto del registro, NO el de login
  centro_id?: string | null
  calendar_id?: string | null
  activo?: boolean
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
    if (body.centro_id !== undefined) campos.centro_id = body.centro_id
    if (body.calendar_id !== undefined) campos.calendar_id = body.calendar_id
    if (body.activo !== undefined) campos.activo = body.activo

    const upd = await admin.from('psicologos').update(campos).eq('id', id)
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

    // Sincronizar nombre en perfiles (atribución coherente)
    if (body.nombre !== undefined) {
      await admin.from('perfiles').update({ nombre: body.nombre.trim() }).eq('psicologo_id', id)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.tipo === 'agente') {
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

// Reenviar acceso: envía email de recuperación de contraseña.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await ctx.params
  const body = (await req.json()) as { tipo: 'psicologo' | 'agente' }
  const admin = createSupabaseAdmin()

  // Resolver el email de login del registro
  let email: string | null = null
  if (body.tipo === 'psicologo') {
    const perfil = await admin.from('perfiles').select('id').eq('psicologo_id', id).maybeSingle()
    if (perfil.data?.id) {
      const u = await admin.auth.admin.getUserById(perfil.data.id)
      email = u.data?.user?.email ?? null
    }
  } else {
    const ag = await admin.from('agentes').select('auth_user_id').eq('id', id).maybeSingle()
    if (ag.data?.auth_user_id) {
      const u = await admin.auth.admin.getUserById(ag.data.auth_user_id)
      email = u.data?.user?.email ?? null
    }
  }
  if (!email) return NextResponse.json({ error: 'No se encontró la cuenta de acceso' }, { status: 404 })

  const reset = await admin.auth.resetPasswordForEmail(email)
  if (reset.error) return NextResponse.json({ error: reset.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
