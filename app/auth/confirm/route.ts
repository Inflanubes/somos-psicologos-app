import { type NextRequest, NextResponse } from 'next/server'

// Punto de aterrizaje del enlace del email (invitación / recuperación).
//
// IMPORTANTE: aquí NO verificamos el token. Los escáneres de enlaces (Gmail,
// antivirus corporativos) abren la URL automáticamente antes de que la persona
// pulse, y como el token de Supabase es de un solo uso, lo gastarían y el
// usuario acabaría en /login. En su lugar reenviamos el token_hash a la página
// de crear contraseña, que lo canjea SOLO cuando la persona envía el formulario
// (un bot no rellena ni envía formularios), así el token sobrevive hasta el uso real.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/auth/cambiar-password'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=enlace_invalido', request.url))
  }

  // Reenviamos el token a la página de crear contraseña, sin verificarlo todavía.
  const dest = new URL(next, request.url)
  dest.searchParams.set('token_hash', token_hash)
  dest.searchParams.set('type', type)
  return NextResponse.redirect(dest)
}
