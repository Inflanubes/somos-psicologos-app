import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'
import { generateTempPassword } from '@/lib/temp-password'

export async function GET() {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createSupabaseAdmin()
  const [psies, ags, centros] = await Promise.all([
    admin.from('psicologos').select('id, nombre, email, telefono, centro_id, calendar_id, activo').order('nombre'),
    admin.from('agentes').select('id, nombre, email, telefono, centro_id, activo, auth_user_id').order('nombre'),
    admin.from('centros').select('id, nombre').order('nombre'),
  ])
  if (psies.error) return NextResponse.json({ error: psies.error.message }, { status: 500 })
  if (ags.error) return NextResponse.json({ error: ags.error.message }, { status: 500 })
  if (centros.error) return NextResponse.json({ error: centros.error.message }, { status: 500 })

  return NextResponse.json({ psicologos: psies.data ?? [], agentes: ags.data ?? [], centros: centros.data ?? [] })
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

  // Paso 1: crear cuenta auth con email confirmado y una contraseña temporal.
  // La temporal es un RESPALDO (el agente la ve y puede entregarla si el email
  // no llega); el flujo normal es que el usuario reciba el email y elija la suya.
  const password = generateTempPassword()
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error || !created.data?.user) {
    const msg = /already|registered|exists/i.test(created.error?.message ?? '')
      ? 'Ya hay un usuario con ese email'
      : created.error?.message ?? 'No se pudo crear la cuenta'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const userId = created.data.user.id

  // Paso 2: enviar email para que el usuario fije su propia contraseña.
  // Si el SMTP no está configurado o se supera el límite, emailSent = false y
  // el agente puede usar la contraseña temporal como alternativa.
  const { error: mailError } = await admin.auth.resetPasswordForEmail(email)
  const emailSent = !mailError

  if (body.tipo === 'psicologo') {
    // El nombre del centro en texto es obligatorio: las automatizaciones (Make)
    // buscan al psicólogo en `psicologos` por el campo `centro`, no por centro_id.
    let centroNombre: string | null = null
    if (body.centro_id) {
      const c = await admin.from('centros').select('nombre').eq('id', body.centro_id).maybeSingle()
      centroNombre = c.data?.nombre ?? null
    }
    // Paso 3: registro en psicologos
    const psi = await admin
      .from('psicologos')
      .insert({
        nombre,
        email,
        telefono: body.telefono ?? null,
        centro_id: body.centro_id ?? null,
        centro: centroNombre,
        calendar_id: body.calendar_id!.trim(),
        activo: true,
      })
      .select('id')
      .single()
    if (psi.error || !psi.data) {
      await admin.auth.admin.deleteUser(userId) // limpieza
      return NextResponse.json({ error: psi.error?.message ?? 'Error creando psicólogo' }, { status: 500 })
    }
    // Paso 4: perfil
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
    return NextResponse.json({ ok: true, id: psi.data.id, email, password, emailSent }, { status: 201 })
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
  return NextResponse.json({ ok: true, id: ag.data.id, email, password, emailSent }, { status: 201 })
}
