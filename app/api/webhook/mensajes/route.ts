import { NextRequest, NextResponse } from 'next/server'
import { conPie, llevaPie } from '@/lib/mensajes-pie'

export async function POST(req: NextRequest) {
  const url = process.env.MAKE_MENSAJES_WEBHOOK
  if (!url) {
    return NextResponse.json({ error: 'Webhook URL no configurada.' }, { status: 500 })
  }

  const body = await req.json()
  // Todo mensaje a pacientes lleva el pie informativo; un cuerpo sin texto o el aviso al psicólogo van tal cual.
  if (typeof body?.mensaje === 'string' && llevaPie(body.tipo)) body.mensaje = conPie(body.mensaje)

  const makeRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!makeRes.ok) {
    return NextResponse.json({ error: 'Error en webhook: ' + makeRes.status }, { status: makeRes.status })
  }

  return NextResponse.json({ ok: true })
}
