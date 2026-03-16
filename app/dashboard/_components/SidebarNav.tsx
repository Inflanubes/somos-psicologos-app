'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
function PhoneIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.62 5.09 2 2 0 0 1 3.6 2.87h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.5a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.62 17z" />
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

const navItems = [
  { href: '/dashboard', label: 'Panel General', Icon: GridIcon, exact: true },
  { href: '/dashboard/pacientes', label: 'Pacientes', Icon: PeopleIcon },
  { href: '/dashboard/equipo', label: 'Psicólogos', Icon: PersonIcon },
  { href: '/dashboard/psicologos', label: 'Citas', Icon: PersonIcon },
  { href: '/dashboard/call-center', label: 'Gestiones', Icon: PhoneIcon },
  { href: '/dashboard/mensajes', label: 'Comunicaciones', Icon: ChatIcon },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav style={{ padding: '16px 10px', flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#b0bcbc',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '0 10px',
          marginBottom: 8,
        }}
      >
        Principal
      </div>
      {navItems.map(({ href, label, Icon, exact }) => {
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
              color: isActive ? '#3a8c8c' : '#4a5870',
              background: isActive ? '#e8f4f4' : 'transparent',
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              marginBottom: 2,
              transition: 'background 0.15s, color 0.15s',
              borderLeft: isActive ? '3px solid #3a8c8c' : '3px solid transparent',
            }}
          >
            <span style={{ color: isActive ? '#3a8c8c' : '#7a9090', lineHeight: 1 }}>
              <Icon />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
