import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ahoraMadrid } from '@/lib/fechas'
import { TIPOS_CONSULTA } from '@/lib/pacientes-tipos'
import { resolverDisponibilidad, type PeticionDisponibilidad } from '@/lib/disponibilidad-servidor'
import type { TipoCita } from '@/types/database'

// Endpoint para Dante (n8n): huecos de un psicólogo o de un centro, y
// comprobación de una hora concreta antes de mandarla a Make. Sin sesión:
// se autentica con `Authorization: Bearer <DANTE_API_TOKEN>`.
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{1,2}:\d{2}(:\d{2})?$/

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function validar(body: Record<string, unknown>): { req: PeticionDisponibilidad } | { error: string } {
  const tipo = body.tipo
  const centro_id = texto(body.centro_id)
  if (!centro_id || !UUID.test(centro_id)) return { error: 'centro_id obligatorio' }
  const tipoConsultaTxt = texto(body.tipo_consulta)
  if (tipoConsultaTxt && !TIPOS_CONSULTA.includes(tipoConsultaTxt as TipoCita)) return { error: 'tipo_consulta no válido' }
  const tipo_consulta = tipoConsultaTxt as TipoCita | undefined
  const fecha_deseada = texto(body.fecha_deseada)
  if (fecha_deseada && !FECHA.test(fecha_deseada)) return { error: 'fecha_deseada debe ser YYYY-MM-DD' }

  if (tipo === 'centro') return { req: { tipo, centro_id, fecha_deseada, tipo_consulta } }

  const psicologo_id = texto(body.psicologo_id)
  if (!psicologo_id || !UUID.test(psicologo_id)) return { error: 'psicologo_id obligatorio' }
  if (tipo === 'psicologo') return { req: { tipo, centro_id, psicologo_id, fecha_deseada, tipo_consulta } }

  if (tipo === 'comprobar') {
    const fecha = texto(body.fecha)
    const hora = texto(body.hora)
    if (!fecha || !FECHA.test(fecha)) return { error: 'fecha obligatoria (YYYY-MM-DD)' }
    if (!hora || !HORA.test(hora)) return { error: 'hora obligatoria (HH:MM)' }
    const excluir_accion_id = texto(body.excluir_accion_id)
    return { req: { tipo, centro_id, psicologo_id, fecha, hora, excluir_accion_id } }
  }
  return { error: 'tipo debe ser psicologo, centro o comprobar' }
}

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
  const v = validar(body as Record<string, unknown>)
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
