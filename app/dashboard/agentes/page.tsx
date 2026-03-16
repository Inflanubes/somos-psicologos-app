'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agente } from '@/types/database'

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

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
    setToggling(id)
    const { error } = await supabase
      .from('agentes')
      .update({ activo: !activo })
      .eq('id', id)
    if (!error) {
      setAgentes(prev =>
        prev.map(a => (a.id === id ? { ...a, activo: !activo } : a))
      )
    }
    setToggling(null)
  }

  const activos = agentes.filter(a => a.activo).length

  return (
    <div style={{ padding: '36px 40px', maxWidth: 800 }}>
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
          Gestiona el estado activo de cada agente de call center
        </p>
      </div>

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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Teléfono', 'Estado', 'Acción'].map(h => (
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
              {agentes.map((a, i) => (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: i < agentes.length - 1 ? '1px solid rgba(47,90,174,0.07)' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#fafcfc',
                  }}
                >
                  <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500, color: '#272626' }}>
                    {a.nombre}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#4a5870' }}>
                    {a.telefono ?? '—'}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
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
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => toggleActivo(a.id, a.activo)}
                      disabled={toggling === a.id}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 8,
                        border: '1.5px solid',
                        borderColor: a.activo ? '#fca5a5' : '#2f5aae',
                        background: a.activo ? '#fff' : '#eef2fb',
                        color: a.activo ? '#dc2626' : '#254d99',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: toggling === a.id ? 'not-allowed' : 'pointer',
                        opacity: toggling === a.id ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {toggling === a.id ? '...' : a.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
