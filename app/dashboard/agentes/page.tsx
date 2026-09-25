'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agente } from '@/types/database'

// Botones de acción con aspecto de botón real y transición al pasar el ratón.
const btnBase: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  fontFamily: 'inherit', border: '1.5px solid', whiteSpace: 'nowrap',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
}
const btnVariants = {
  default: {
    normal: { borderColor: 'rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae' },
    hover:  { borderColor: '#2f5aae', background: '#eef2fb', color: '#254d99' },
  },
  success: {
    normal: { borderColor: 'rgba(30,125,79,0.4)', background: '#fff', color: '#1e7d4f' },
    hover:  { borderColor: '#1e7d4f', background: '#eafaf1', color: '#155f3b' },
  },
  danger: {
    normal: { borderColor: 'rgba(185,28,28,0.3)', background: '#fff', color: '#b91c1c' },
    hover:  { borderColor: '#b91c1c', background: '#fef2f2', color: '#991b1b' },
  },
} as const

function ActionButton({ children, onClick, disabled, variant = 'default', title }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: keyof typeof btnVariants
  title?: string
}) {
  const [hover, setHover] = useState(false)
  const v = btnVariants[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnBase,
        ...(hover && !disabled ? v.hover : v.normal),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

type Resultado = { nombre: string; email: string; password?: string; emailSent: boolean }

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agentes')
        .select('*')
        .order('nombre')
      setAgentes((data ?? []) as Agente[])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleActivo(id: string, activo: boolean) {
    setBusy(id); setError(null)
    const { error } = await supabase
      .from('agentes')
      .update({ activo: !activo })
      .eq('id', id)
    if (error) {
      setError('No se pudo cambiar el estado del agente')
    } else {
      setAgentes(prev =>
        prev.map(a => (a.id === id ? { ...a, activo: !activo } : a))
      )
    }
    setBusy(null)
  }

  // Restablece el acceso de un agente usando la misma API que el panel de Usuarios:
  // - 'email': Supabase le envía un enlace para crear una contraseña nueva.
  // - 'generar': se crea una contraseña temporal que hay que entregarle a mano.
  async function restablecer(a: Agente, metodo: 'email' | 'generar') {
    const confirmMsg = metodo === 'email'
      ? `¿Enviar a ${a.nombre} un email para que cree una contraseña nueva?`
      : `¿Generar una contraseña temporal para ${a.nombre}? La anterior dejará de funcionar y tendrás que entregársela tú.`
    if (!window.confirm(confirmMsg)) return
    setBusy(a.id); setError(null); setResultado(null)
    try {
      const res = await fetch(`/api/usuarios/${a.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'agente', metodo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo restablecer el acceso'); return }
      setResultado({ nombre: a.nombre, email: data.email, password: data.password, emailSent: metodo === 'email' })
    } catch {
      setError('Error de conexión al restablecer el acceso')
    } finally {
      setBusy(null)
    }
  }

  const activos = agentes.filter(a => a.activo).length

  return (
    <div className="page-pad" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
          fontSize: 26,
          fontWeight: 600,
          color: '#272626',
          margin: 0,
          marginBottom: 6,
        }}>
          Agentes
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Gestiona el estado y el acceso de cada agente de call center
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {resultado && (
        <div style={{ background: '#eef2fb', border: '1.5px solid #2f5aae', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#254d99', marginBottom: 8 }}>
                Acceso restablecido · {resultado.nombre}
              </div>
              <div style={{ fontSize: 13, color: '#3a4a6b', marginBottom: 6 }}>
                <strong>Email:</strong> <span style={{ fontFamily: 'monospace' }}>{resultado.email}</span>
              </div>

              {resultado.emailSent && (
                <div style={{ fontSize: 13, color: '#1e7d4f', fontWeight: 600, marginBottom: 6 }}>
                  📧 Le hemos enviado un email para que cree su propia contraseña.
                </div>
              )}

              {resultado.password && (
                <div style={{ fontSize: 13, color: '#3a4a6b' }}>
                  <strong>Contraseña temporal:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(47,90,174,0.25)' }}>
                    {resultado.password}
                  </span>
                  <div style={{ fontSize: 12, color: '#667799', marginTop: 6 }}>
                    Entrégasela al agente. No volverá a mostrarse.
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {resultado.password && (
                <button
                  onClick={() => navigator.clipboard?.writeText(`Email: ${resultado.email}\nContraseña: ${resultado.password}`)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #2f5aae', background: '#fff', color: '#254d99', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Copiar
                </button>
              )}
              <button
                onClick={() => setResultado(null)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Hecho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <p style={{ fontSize: 13, color: '#667799', marginBottom: 16 }}>
          {activos} activo{activos !== 1 ? 's' : ''} de {agentes.length} agente{agentes.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid rgba(47,90,174,0.13)',
        boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8899bb', fontSize: 14 }}>
            Cargando...
          </div>
        ) : agentes.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8899bb', fontSize: 14 }}>
            No hay agentes registrados
          </div>
        ) : (
          <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#667799',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentes.map((a, i) => {
                const ocupado = busy === a.id
                const sinCuenta = !a.auth_user_id
                return (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: i < agentes.length - 1 ? '1px solid rgba(47,90,174,0.07)' : 'none',
                      background: i % 2 === 0 ? '#fff' : '#fafcfc',
                    }}
                  >
                    <td data-label="Nombre" style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500, color: '#272626' }}>
                      {a.nombre}
                    </td>
                    <td data-label="Email" style={{ padding: '14px 20px', fontSize: 13, color: '#4a5870' }}>
                      {a.email ?? '—'}
                    </td>
                    <td data-label="Teléfono" style={{ padding: '14px 20px', fontSize: 13, color: '#4a5870' }}>
                      {a.telefono ?? '—'}
                    </td>
                    <td data-label="Estado" style={{ padding: '14px 20px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: a.activo ? '#d1fae5' : '#f3f4f6',
                        color: a.activo ? '#065f46' : '#6b7280',
                      }}>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="" style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <ActionButton
                          onClick={() => restablecer(a, 'email')}
                          disabled={ocupado || sinCuenta}
                          title={sinCuenta ? 'Este agente no tiene cuenta de acceso; créala desde Usuarios' : 'Enviar email para que el agente cree una contraseña nueva'}
                        >
                          Enviar acceso
                        </ActionButton>
                        <ActionButton
                          onClick={() => restablecer(a, 'generar')}
                          disabled={ocupado || sinCuenta}
                          title={sinCuenta ? 'Este agente no tiene cuenta de acceso; créala desde Usuarios' : 'Generar una contraseña temporal para entregar tú'}
                        >
                          Generar contraseña
                        </ActionButton>
                        <ActionButton
                          onClick={() => toggleActivo(a.id, a.activo)}
                          disabled={ocupado}
                          variant={a.activo ? 'danger' : 'success'}
                        >
                          {ocupado ? '...' : a.activo ? 'Desactivar' : 'Activar'}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
