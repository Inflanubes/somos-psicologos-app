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

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [telefonoNuevo, setTelefonoNuevo] = useState('')

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

  // Edita el teléfono del agente con la misma API que Accesos (va por el id de
  // agentes, así que funciona aunque el agente no tenga cuenta de acceso).
  async function guardarTelefono(a: Agente, telefono: string) {
    const valor = telefono.trim() || null
    setBusy(a.id); setError(null); setAviso(null)
    try {
      const res = await fetch(`/api/usuarios/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'agente', telefono: valor }),
      })
      if (!res.ok) { setError('No se pudo guardar el teléfono.'); return }
      setAgentes(prev => prev.map(x => (x.id === a.id ? { ...x, telefono: valor } : x)))
      setEditando(null)
      setAviso('Teléfono guardado.')
    } catch {
      setError('No se pudo guardar el teléfono.')
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
          Gestiona el estado y el teléfono de cada agente. Las cuentas y contraseñas están en Accesos
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {aviso && (
        <div style={{ background: '#eafaf1', color: '#155f3b', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {aviso}
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
                      {editando === a.id ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="tel"
                            value={telefonoNuevo}
                            onChange={e => setTelefonoNuevo(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') guardarTelefono(a, telefonoNuevo); if (e.key === 'Escape') setEditando(null) }}
                            autoFocus
                            disabled={ocupado}
                            aria-label={`Teléfono de ${a.nombre}`}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(47,90,174,0.3)', fontSize: 13, fontFamily: 'inherit', width: 150 }}
                          />
                          <ActionButton onClick={() => guardarTelefono(a, telefonoNuevo)} disabled={ocupado} variant="success">
                            {ocupado ? '...' : 'Guardar'}
                          </ActionButton>
                          <ActionButton onClick={() => setEditando(null)} disabled={ocupado}>
                            Cancelar
                          </ActionButton>
                        </div>
                      ) : (
                        a.telefono ?? '—'
                      )}
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
                          onClick={() => { setEditando(a.id); setTelefonoNuevo(a.telefono ?? ''); setAviso(null) }}
                          disabled={ocupado || editando === a.id}
                        >
                          Editar teléfono
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
