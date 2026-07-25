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
        background: '#f4f5f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: '"Montserrat", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '36px 28px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '6px 6px 30px rgba(0,0,0,0.10)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #2f5aae 0%, #254d99 100%)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(47,90,174,0.28)',
            }}
          >
            <svg width="20" height="18" fill="white" viewBox="0 0 20 18">
              <path d="M10 17S1 11 1 5a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 6-9 12-9 12z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#272626' }}>Somos Psicología</div>
            <div style={{ fontSize: 11, color: '#2f5aae', letterSpacing: '0.07em', fontWeight: 600 }}>
              Panel de Control
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#272626', marginBottom: 6 }}>
          Iniciar sesión
        </h1>
        <p style={{ fontSize: 14, color: '#667799', marginBottom: 28 }}>
          Accede con tu cuenta de equipo
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3a4a6b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                padding: '11px 14px',
                borderRadius: 8,
                border: '1.5px solid #dde1ea',
                fontSize: 16,
                color: '#272626',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3a4a6b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                padding: '11px 14px',
                borderRadius: 8,
                border: '1.5px solid #dde1ea',
                fontSize: 16,
                color: '#272626',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: '#fdeaea',
                border: '1.5px solid #f5b7b1',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#c0392b',
                fontWeight: 600,
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
              padding: '13px',
              borderRadius: 30,
              border: 'none',
              background: loading ? '#a0b0cc' : '#2f5aae',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: '"Varela Round", sans-serif',
              transition: 'background 0.2s, box-shadow 0.2s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(47,90,174,0.30)',
              letterSpacing: '0.3px',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
