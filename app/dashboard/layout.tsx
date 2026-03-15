import type { ReactNode } from 'react'
import { DM_Sans, Lora } from 'next/font/google'
import SidebarNav from './_components/SidebarNav'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600'],
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
  weight: ['400', '600'],
})

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${dmSans.variable} ${lora.variable}`}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f7f4ef',
        fontFamily: 'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 252,
          flexShrink: 0,
          background: '#ffffff',
          borderRight: '1px solid rgba(58,140,140,0.12)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(58,140,140,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: 'linear-gradient(135deg, #3a8c8c 0%, #2a6b6b 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(58,140,140,0.28)',
              }}
            >
              <svg width="20" height="18" fill="white" viewBox="0 0 20 18">
                <path d="M10 17S1 11 1 5a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 6-9 12-9 12z" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: '#1a2e2e',
                  lineHeight: 1.2,
                }}
              >
                Somos Psicología
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#3a8c8c',
                  letterSpacing: '0.07em',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                Panel de Control
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav />

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(58,140,140,0.08)',
            fontSize: 11,
            color: '#c0caca',
          }}
        >
          © 2026 Somos Psicología
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowX: 'hidden', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
