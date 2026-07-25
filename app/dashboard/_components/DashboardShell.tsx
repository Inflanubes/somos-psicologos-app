'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import SidebarNav from './SidebarNav'
import RoleGate from './RoleGate'

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 44,
          height: 44,
          background: 'linear-gradient(135deg, #2f5aae 0%, #254d99 100%)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(47,90,174,0.28)',
        }}
      >
        <svg width="20" height="18" fill="white" viewBox="0 0 20 18">
          <path d="M10 17S1 11 1 5a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 6-9 12-9 12z" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-montserrat, "Montserrat", sans-serif)',
            fontSize: 15.5,
            fontWeight: 700,
            color: '#272626',
            lineHeight: 1.2,
          }}
        >
          Somos Psicología
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#2f5aae',
            letterSpacing: '0.07em',
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          Panel de Control
        </div>
      </div>
    </div>
  )
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Cierra el panel al navegar a otra sección.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <div className="dash-shell">
      {/* Fondo oscuro al abrir el menú en móvil */}
      <div
        className={`dash-backdrop${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />

      {/* Barra lateral (fija en escritorio, deslizante en móvil) */}
      <aside className={`dash-sidebar${menuOpen ? ' open' : ''}`}>
        {/* Marca */}
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(47,90,174,0.08)',
          }}
        >
          <Brand />
        </div>

        {/* Navegación */}
        <SidebarNav />

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(47,90,174,0.08)',
            fontSize: 11,
            color: '#a0b0cc',
          }}
        >
          © 2026 Somos Psicología
        </div>
      </aside>

      {/* Columna de contenido */}
      <div className="dash-main-col">
        {/* Barra superior (solo visible en móvil) */}
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <Brand />
        </header>

        <main style={{ flex: 1, minWidth: 0 }}>
          <RoleGate>{children}</RoleGate>
        </main>
      </div>
    </div>
  )
}
