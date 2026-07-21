'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  // Token del enlace del email. Se guarda al cargar pero se CANJEA al enviar el
  // formulario, no antes, para que el escaneo de enlaces de Gmail no lo gaste.
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [tokenType, setTokenType] = useState<EmailOtpType | null>(null)
  // null = comprobando, true = hay enlace o sesión válidos, false = nada válido
  const [listo, setListo] = useState<boolean | null>(null)

  useEffect(() => {
    // Leemos el token de la URL (viene reenviado desde /auth/confirm).
    const params = new URLSearchParams(window.location.search)
    const th = params.get('token_hash')
    const ty = params.get('type') as EmailOtpType | null
    if (th && ty) {
      setTokenHash(th)
      setTokenType(ty)
      setListo(true)
      return
    }
    // Sin token en la URL: solo es válido si ya hay una sesión abierta
    // (p. ej. un usuario que ya ha entrado y quiere cambiar su contraseña).
    supabase.auth.getSession().then(({ data }) => setListo(!!data.session))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)

    // Si venimos del email, canjeamos el token AHORA (al enviar), no al cargar.
    if (tokenHash && tokenType) {
      const { error: otpError } = await supabase.auth.verifyOtp({ type: tokenType, token_hash: tokenHash })
      if (otpError) {
        setError('El enlace no es válido o ha caducado. Pide a tu administrador que te envíe uno nuevo.')
        setLoading(false)
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('No se pudo guardar la contraseña. El enlace puede haber caducado; pide uno nuevo.')
      setLoading(false)
      return
    }
    setOk(true)
    setTimeout(() => router.push('/dashboard'), 1600)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8, border: '1.5px solid #dde1ea',
    fontSize: 14, color: '#272626', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Montserrat", system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '6px 6px 30px rgba(0,0,0,0.10)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #2f5aae 0%, #254d99 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(47,90,174,0.28)' }}>
            <svg width="20" height="18" fill="white" viewBox="0 0 20 18">
              <path d="M10 17S1 11 1 5a4.5 4.5 0 019-1 4.5 4.5 0 019 1c0 6-9 12-9 12z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#272626' }}>Somos Psicología</div>
            <div style={{ fontSize: 11, color: '#2f5aae', letterSpacing: '0.07em', fontWeight: 600 }}>Panel de Control</div>
          </div>
        </div>

        {listo === null && (
          <p style={{ fontSize: 14, color: '#667799' }}>Comprobando el enlace...</p>
        )}

        {listo === false && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#272626', marginBottom: 6 }}>Enlace no válido</h1>
            <p style={{ fontSize: 14, color: '#667799', marginBottom: 24 }}>
              Este enlace ha caducado o ya se ha usado. Pide a tu administrador que te envíe uno nuevo.
            </p>
            <button onClick={() => router.push('/login')} style={{ padding: '12px', width: '100%', borderRadius: 30, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Ir al inicio de sesión
            </button>
          </>
        )}

        {listo === true && !ok && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#272626', marginBottom: 6 }}>Crea tu contraseña</h1>
            <p style={{ fontSize: 14, color: '#667799', marginBottom: 28 }}>Elige una contraseña para acceder a tu cuenta.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3a4a6b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nueva contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3a4a6b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Repite la contraseña</label>
                <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required placeholder="••••••••" style={inputStyle} />
              </div>

              {error && (
                <div style={{ background: '#fdeaea', border: '1.5px solid #f5b7b1', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', fontWeight: 600 }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '13px', borderRadius: 30, border: 'none', background: loading ? '#a0b0cc' : '#2f5aae', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 14px rgba(47,90,174,0.30)' }}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}

        {ok && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e7d4f', marginBottom: 6 }}>¡Listo! ✅</h1>
            <p style={{ fontSize: 14, color: '#667799' }}>Contraseña guardada. Entrando al panel...</p>
          </>
        )}
      </div>
    </div>
  )
}
