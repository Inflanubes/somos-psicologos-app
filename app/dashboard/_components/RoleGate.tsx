'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getPerfilActual } from '@/lib/perfil'
import type { Rol } from '@/types/database'
import { HOME_POR_ROL, rutaPermitida } from '@/lib/roles'

/**
 * Keeps each role inside its allowed area. Users with no profile row default to
 * 'agente' (full access), so existing logins keep working.
 */
export default function RoleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [rol, setRol] = useState<Rol | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPerfilActual().then((p) => {
      if (cancelled) return
      setRol(p?.rol ?? 'agente')
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !rol) return
    if (!rutaPermitida(rol, pathname)) router.replace(HOME_POR_ROL[rol])
  }, [ready, rol, pathname, router])

  if (!ready) return null
  if (rol && !rutaPermitida(rol, pathname)) return null
  return <>{children}</>
}
