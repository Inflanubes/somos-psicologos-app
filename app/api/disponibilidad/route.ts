import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ahoraMadrid } from '@/lib/fechas'
import { resolverDisponibilidad, validarPeticion } from '@/lib/disponibilidad-servidor'

// Endpoint para Dante (n8n): huecos de un psicólogo o de un centro, y
// comprobación de una hora concreta antes de mandarla a Make. Sin sesión:
// se autentica con `Authorization: Bearer <DANTE_API_TOKEN>`.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = process.env.DANTE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'DANTE_API_TOKEN no configurado' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON no válido' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Cuerpo JSON no válido' }, { status: 400 })
  const v = validarPeticion(body as Record<string, unknown>)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  try {
    const admin = createSupabaseAdmin()
    const respuesta = await resolverDisponibilidad(admin, v.req, ahoraMadrid())
    return NextResponse.json(respuesta)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error consultando la disponibilidad'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
