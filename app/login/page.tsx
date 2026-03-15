'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f4ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '40px 36px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 4px 24px rgba(58,140,140,0.10)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #3a8c8c 0%, #2a6b6b 100%)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(58,140,140,0.28)',
            }}
          >
            <svg width="20" height="18" fill="white" viewBox="0 0 20 18">
              <path d="M10 17S1 11 1 5a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 6-9 12-9 12z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2e2e' }}>Somos Psicología</div>
            <div style={{ fontSize: 11, color: '#3a8c8c', letterSpacing: '0.07em', fontWeight: 500 }}>
              Panel de Control
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a2e2e', marginBottom: 6 }}>
          Iniciar sesión
        </h1>
        <p style={{ fontSize: 14, color: '#6b8080', marginBottom: 28 }}>
          Accede con tu cuenta de equipo
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2e2e', marginBottom: 6 }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid #d4e0e0',
                fontSize: 14,
                color: '#1a2e2e',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafcfc',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2e2e', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid #d4e0e0',
                fontSize: 14,
                color: '#1a2e2e',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafcfc',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: '#fff2f2',
                border: '1px solid #fcc',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#c0392b',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#a0c4c4' : '#3a8c8c',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
