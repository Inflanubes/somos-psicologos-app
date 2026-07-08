'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getPerfilActual } from '@/lib/perfil'
import type { Rol } from '@/types/database'

const HOME: Record<Rol, string> = {
  agente: '/dashboard',
  psicologo: '/dashboard/psicologos',
  // El formulario de call center se eliminó; su home pasa a ser el panel general.
  call_center: '/dashboard',
}

function isAllowed(rol: Rol, path: string): boolean {
  if (rol === 'agente') return true
  if (rol === 'psicologo') return path === '/dashboard/psicologos'
  if (rol === 'call_center') return path === '/dashboard'
  return false
}

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
    if (!isAllowed(rol, pathname)) router.replace(HOME[rol])
  }, [ready, rol, pathname, router])

  if (!ready) return null
  if (rol && !isAllowed(rol, pathname)) return null
  return <>{children}</>
}
