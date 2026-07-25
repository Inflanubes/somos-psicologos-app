import type { ReactNode } from 'react'
import { Montserrat } from 'next/font/google'
import DashboardShell from './_components/DashboardShell'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={montserrat.variable}
      style={{
        minHeight: '100vh',
        background: '#f4f5f7',
        fontFamily: 'var(--font-montserrat, "Montserrat", system-ui, sans-serif)',
      }}
    >
      <DashboardShell>{children}</DashboardShell>
    </div>
  )
}
