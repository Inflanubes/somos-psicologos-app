'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPerfilActual } from '@/lib/perfil'
import type { Perfil, Rol } from '@/types/database'

function GridIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

type NavItem = {
  href: string
  label: string
  Icon: () => React.ReactElement
  exact?: boolean
  roles: Rol[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Panel General', Icon: GridIcon, exact: true, roles: ['agente'] },
  { href: '/dashboard/psicologos/stats', label: 'Estadísticas', Icon: GridIcon, roles: ['agente'] },
  { href: '/dashboard/pacientes', label: 'Pacientes', Icon: PeopleIcon, roles: ['agente', 'psicologo'] },
  { href: '/dashboard/equipo', label: 'Psicólogos', Icon: PersonIcon, roles: ['agente'] },
  { href: '/dashboard/agentes', label: 'Agentes', Icon: PeopleIcon, roles: ['agente'] },
  { href: '/dashboard/usuarios', label: 'Usuarios', Icon: PeopleIcon, roles: ['agente'] },
  { href: '/dashboard/psicologos', label: 'Citas', Icon: PersonIcon, exact: true, roles: ['agente', 'psicologo'] },
  { href: '/dashboard/mensajes', label: 'Comunicaciones', Icon: ChatIcon, roles: ['agente'] },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    getPerfilActual()
      .then(setPerfil)
      .finally(() => setCargado(true))
  }, [])

  // No profile row → treat as full-access agent (keeps current logins working).
  const rol: Rol = perfil?.rol ?? 'agente'
  const visibleItems = navItems.filter((item) => item.roles.includes(rol))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#a0b0cc',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '0 10px',
          marginBottom: 8,
        }}
      >
        Principal
      </div>
      {visibleItems.map(({ href, label, Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 8,
              color: isActive ? '#2f5aae' : '#4a5870',
              background: isActive ? '#eef2fb' : 'transparent',
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              marginBottom: 2,
              transition: 'background 0.15s, color 0.15s',
              borderLeft: isActive ? '3px solid #2f5aae' : '3px solid transparent',
            }}
          >
            <span style={{ color: isActive ? '#2f5aae' : '#8899bb', lineHeight: 1 }}>
              <Icon />
            </span>
            {label}
          </Link>
        )
      })}

      {/* User + logout */}
      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(47,90,174,0.08)' }}>
        {cargado && perfil && (
          <div style={{ padding: '0 10px 8px', fontSize: 12, color: '#4a5870' }}>
            <div style={{ fontWeight: 700 }}>{perfil.nombre}</div>
            <div style={{ fontSize: 10.5, color: '#a0b0cc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {perfil.rol === 'call_center' ? 'Call center' : perfil.rol}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '9px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#c0392b',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
