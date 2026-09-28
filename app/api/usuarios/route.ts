import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'
import { generateTempPassword } from '@/lib/temp-password'
import { TIPOS_CONSULTA } from '@/lib/pacientes-tipos'
import type { TipoCita } from '@/types/database'

export async function GET() {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createSupabaseAdmin()
  const [psies, psicologosCentros, ags, centros, horarios] = await Promise.all([
    admin
      .from('psicologos')
      .select('id, nombre, email, telefono, calendar_id, activo, puede_bloquear, citas_media_hora, tipos_consulta')
      .order('nombre'),
    admin.from('psicologos_centros').select('psicologo_id, centro_id'),
    admin.from('agentes').select('id, nombre, email, telefono, centro_id, activo, auth_user_id').order('nombre'),
    admin.from('centros').select('id, nombre').order('nombre'),
    admin
      .from('horarios_psicologos')
      .select('psicologo_id, dia_semana, hora_inicio, hora_fin')
      .order('dia_semana')
      .order('hora_inicio'),
  ])
  if (psies.error) return NextResponse.json({ error: psies.error.message }, { status: 500 })
  if (psicologosCentros.error) return NextResponse.json({ error: psicologosCentros.error.message }, { status: 500 })
  if (ags.error) return NextResponse.json({ error: ags.error.message }, { status: 500 })
  if (centros.error) return NextResponse.json({ error: centros.error.message }, { status: 500 })

  let avisoHorarios: string | null = null
  const horariosPorPsicologo = new Map<string, { dia_semana: number; hora_inicio: string; hora_fin: string }[]>()
  if (horarios.error) {
    avisoHorarios = 'No se pudieron leer los horarios: ' + horarios.error.message
  } else {
    for (const h of horarios.data ?? []) {
      const lista = horariosPorPsicologo.get(h.psicologo_id) ?? []
      lista.push({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin })
      horariosPorPsicologo.set(h.psicologo_id, lista)
    }
  }

  // Centros de cada psicólogo (migración 014: una ficha, N centros en psicologos_centros).
  const centrosDe = new Map<string, string[]>()
  for (const pc of psicologosCentros.data ?? []) {
    const l = centrosDe.get(pc.psicologo_id) ?? []
    l.push(pc.centro_id)
    centrosDe.set(pc.psicologo_id, l)
  }
  const centroNombre = new Map((centros.data ?? []).map((c) => [c.id, c.nombre]))

  // Agentes y call center comparten la tabla `agentes`; el rol lo da `perfiles`.
  const staff = ags.data ?? []
  const authIds = staff.map((a) => a.auth_user_id).filter((id): id is string => !!id)
  const rolPorAuthId = new Map<string, string>()
  if (authIds.length) {
    const perfiles = await admin.from('perfiles').select('id, rol').in('id', authIds)
    if (perfiles.error) return NextResponse.json({ error: perfiles.error.message }, { status: 500 })
    for (const p of perfiles.data ?? []) rolPorAuthId.set(p.id, p.rol)
  }
  const esCallCenter = (a: { auth_user_id: string | null }) =>
    !!a.auth_user_id && rolPorAuthId.get(a.auth_user_id) === 'call_center'

  return NextResponse.json({
    psicologos: (psies.data ?? []).map((p) => ({
      ...p,
      centro_ids: centrosDe.get(p.id) ?? [],
      centros_nombres: (centrosDe.get(p.id) ?? []).map((id) => centroNombre.get(id) ?? '—'),
      tipos_consulta: (p.tipos_consulta ?? []) as TipoCita[],
      horarios: horariosPorPsicologo.get(p.id) ?? [],
    })),
    agentes: staff.filter((a) => !esCallCenter(a)),
    call_center: staff.filter(esCallCenter),
    centros: centros.data ?? [],
    aviso_horarios: avisoHorarios,
  })
}

type CrearBody = {
  tipo: 'psicologo' | 'agente' | 'call_center'
  nombre: string
  email: string
  telefono?: string | null
  centro_id?: string | null
  // Un psicólogo es UNA fila en `psicologos` (migración 014); sus centros van a
  // `psicologos_centros`. `centro_id` lo usan los agentes, que solo tienen un centro.
  centro_ids?: string[] | null
  calendar_id?: string | null
  tipos_consulta?: TipoCita[] | null
}

export async function POST(req: NextRequest) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json()) as CrearBody
  const nombre = body.nombre?.trim()
  const email = body.email?.trim().toLowerCase()

  // Validación de servidor
  if (body.tipo !== 'psicologo' && body.tipo !== 'agente' && body.tipo !== 'call_center')
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (body.tipo === 'psicologo' && !body.calendar_id?.trim())
    return NextResponse.json({ error: 'El calendar_id es obligatorio para un psicólogo' }, { status: 400 })

  // Centros del psicólogo: se acepta la lista nueva o el campo antiguo, sin duplicados.
  const centroIds = Array.from(
    new Set(((body.centro_ids?.length ? body.centro_ids : [body.centro_id]) ?? []).filter((c): c is string => !!c))
  )
  if (body.tipo === 'psicologo' && centroIds.length === 0)
    return NextResponse.json({ error: 'Selecciona al menos un centro para el psicólogo' }, { status: 400 })
  const tiposConsulta = Array.from(
    new Set((body.tipos_consulta ?? []).filter((t): t is TipoCita => TIPOS_CONSULTA.includes(t)))
  )
  if (body.tipo === 'psicologo' && tiposConsulta.length === 0)
    return NextResponse.json({ error: 'Selecciona al menos un tipo de consulta para el psicólogo' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Los centros deben existir antes de crear nada.
  if (body.tipo === 'psicologo') {
    const cs = await admin.from('centros').select('id').in('id', centroIds)
    if (cs.error) return NextResponse.json({ error: cs.error.message }, { status: 500 })
    if ((cs.data ?? []).length !== centroIds.length)
      return NextResponse.json({ error: 'Alguno de los centros seleccionados no existe' }, { status: 400 })
  }

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
    // Paso 3: UNA fila en `psicologos`, sus centros en `psicologos_centros` y el perfil.
    const psi = await admin
      .from('psicologos')
      .insert({
        nombre,
        email,
        telefono: body.telefono ?? null,
        calendar_id: body.calendar_id!.trim(),
        activo: true,
        tipos_consulta: tiposConsulta,
      })
      .select('id')
      .single()
    if (psi.error || !psi.data) {
      await admin.auth.admin.deleteUser(userId) // limpieza
      return NextResponse.json({ error: psi.error?.message ?? 'Error creando psicólogo' }, { status: 500 })
    }
    const psicologoId = psi.data.id
    const pcs = await admin
      .from('psicologos_centros')
      .insert(centroIds.map((centroId) => ({ psicologo_id: psicologoId, centro_id: centroId })))
    if (pcs.error) {
      await admin.from('psicologos').delete().eq('id', psicologoId)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: pcs.error.message }, { status: 500 })
    }
    // Paso 4: perfil (centro_id = primer centro marcado, solo informativo)
    const perfil = await admin.from('perfiles').insert({
      id: userId,
      nombre,
      rol: 'psicologo',
      psicologo_id: psicologoId,
      centro_id: centroIds[0],
    })
    if (perfil.error) {
      await admin.from('psicologos').delete().eq('id', psicologoId) // borra también psicologos_centros (cascade)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: perfil.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: psicologoId, email, password, emailSent }, { status: 201 })
  }

  // tipo === 'agente' | 'call_center': ambos son personal interno con ficha en
  // `agentes`; solo cambia el rol del perfil, que es lo que limita el acceso.
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
    rol: body.tipo,
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
