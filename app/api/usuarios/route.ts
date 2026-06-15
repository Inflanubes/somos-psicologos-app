import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'

export async function GET() {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createSupabaseAdmin()
  const [psies, ags] = await Promise.all([
    admin.from('psicologos').select('id, nombre, email, telefono, centro_id, calendar_id, activo').order('nombre'),
    admin.from('agentes').select('id, nombre, email, telefono, centro_id, activo, auth_user_id').order('nombre'),
  ])
  if (psies.error) return NextResponse.json({ error: psies.error.message }, { status: 500 })
  if (ags.error) return NextResponse.json({ error: ags.error.message }, { status: 500 })

  return NextResponse.json({ psicologos: psies.data ?? [], agentes: ags.data ?? [] })
}

type CrearBody = {
  tipo: 'psicologo' | 'agente'
  nombre: string
  email: string
  telefono?: string | null
  centro_id?: string | null
  calendar_id?: string | null
}

export async function POST(req: NextRequest) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json()) as CrearBody
  const nombre = body.nombre?.trim()
  const email = body.email?.trim().toLowerCase()

  // Validación de servidor
  if (body.tipo !== 'psicologo' && body.tipo !== 'agente')
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (body.tipo === 'psicologo' && !body.calendar_id?.trim())
    return NextResponse.json({ error: 'El calendar_id es obligatorio para un psicólogo' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Paso 1: invitar (crea cuenta auth + envía email para fijar contraseña)
  const invite = await admin.auth.admin.inviteUserByEmail(email)
  if (invite.error || !invite.data?.user) {
    const msg = /already|registered|exists/i.test(invite.error?.message ?? '')
      ? 'Ya hay un usuario con ese email'
      : invite.error?.message ?? 'No se pudo crear la cuenta'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const userId = invite.data.user.id

  if (body.tipo === 'psicologo') {
    // Paso 2: registro en psicologos
    const psi = await admin
      .from('psicologos')
      .insert({
        nombre,
        email,
        telefono: body.telefono ?? null,
        centro_id: body.centro_id ?? null,
        calendar_id: body.calendar_id!.trim(),
        activo: true,
      })
      .select('id')
      .single()
    if (psi.error || !psi.data) {
      await admin.auth.admin.deleteUser(userId) // limpieza
      return NextResponse.json({ error: psi.error?.message ?? 'Error creando psicólogo' }, { status: 500 })
    }
    // Paso 3: perfil
    const perfil = await admin.from('perfiles').insert({
      id: userId,
      nombre,
      rol: 'psicologo',
      psicologo_id: psi.data.id,
      centro_id: body.centro_id ?? null,
    })
    if (perfil.error) {
      await admin.from('psicologos').delete().eq('id', psi.data.id) // limpieza
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: perfil.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: psi.data.id }, { status: 201 })
  }

  // tipo === 'agente'
  const ag = await admin
    .from('agentes')
    .insert({
      nombre,
      email,
      telefono: body.telefono ?? null,
      centro_id: body.centro_id ?? null,
      activo: true,
      auth_user_id: userId,
    })
    .select('id')
    .single()
  if (ag.error || !ag.data) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: ag.error?.message ?? 'Error creando agente' }, { status: 500 })
  }
  const perfil = await admin.from('perfiles').insert({
    id: userId,
    nombre,
    rol: 'agente',
    psicologo_id: null,
    centro_id: body.centro_id ?? null,
  })
  if (perfil.error) {
    await admin.from('agentes').delete().eq('id', ag.data.id)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: perfil.error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: ag.data.id }, { status: 201 })
}
