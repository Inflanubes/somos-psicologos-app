import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const url = process.env.MAKE_CALL_CENTER_WEBHOOK
  if (!url) {
    return NextResponse.json({ error: 'Webhook URL no configurada.' }, { status: 500 })
  }

  const body = await req.json()

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
