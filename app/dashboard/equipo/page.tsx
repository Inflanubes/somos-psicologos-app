'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Psicologo, Centro } from '@/types/database'

type PsicologoConCentro = Psicologo & { centro_nombre: string }

export default function EquipoPage() {
  const [psicologos, setPsicologos] = useState<PsicologoConCentro[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: psi }, { data: cen }] = await Promise.all([
        supabase.from('psicologos').select('*').order('nombre'),
        supabase.from('centros').select('*').order('nombre'),
      ])
      const centrosList = (cen ?? []) as Centro[]
      const centroMap = Object.fromEntries(centrosList.map(c => [c.id, c.nombre]))
      const lista: PsicologoConCentro[] = (psi ?? []).map(p => ({
        ...(p as Psicologo),
        centro_nombre: centroMap[p.centro_id] ?? '—',
      }))
      setPsicologos(lista)
      setCentros(centrosList)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleActivo(id: string, activo: boolean) {
    setToggling(id)
    const { error } = await supabase
      .from('psicologos')
      .update({ activo: !activo })
      .eq('id', id)
    if (!error) {
      setPsicologos(prev =>
        prev.map(p => (p.id === id ? { ...p, activo: !activo } : p))
      )
    }
    setToggling(null)
  }

  const filtrados = filtroCentro === 'todos'
    ? psicologos
    : psicologos.filter(p => p.centro_id === filtroCentro)

  const activos = filtrados.filter(p => p.activo).length

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
          fontSize: 26,
          fontWeight: 600,
          color: '#1a2e2e',
          margin: 0,
          marginBottom: 6,
        }}>
          Psicólogos
        </h1>
        <p style={{ fontSize: 13.5, color: '#7a9090', margin: 0 }}>
          Gestiona el estado activo de cada psicólogo
        </p>
      </div>

      {/* Filtro centros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setFiltroCentro('todos')}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: '1.5px solid',
            borderColor: filtroCentro === 'todos' ? '#3a8c8c' : 'rgba(58,140,140,0.2)',
            background: filtroCentro === 'todos' ? '#e8f4f4' : '#fff',
            color: filtroCentro === 'todos' ? '#2a6b6b' : '#5a7070',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Todos los centros
        </button>
        {centros.map(c => (
          <button
            key={c.id}
            onClick={() => setFiltroCentro(c.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1.5px solid',
              borderColor: filtroCentro === c.id ? '#3a8c8c' : 'rgba(58,140,140,0.2)',
              background: filtroCentro === c.id ? '#e8f4f4' : '#fff',
              color: filtroCentro === c.id ? '#2a6b6b' : '#5a7070',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!loading && (
        <p style={{ fontSize: 13, color: '#7a9090', marginBottom: 16 }}>
          {activos} activo{activos !== 1 ? 's' : ''} de {filtrados.length} psicólogo{filtrados.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid rgba(58,140,140,0.13)',
        boxShadow: '0 2px 8px rgba(58,140,140,0.06)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ab0b0', fontSize: 14 }}>
            Cargando...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ab0b0', fontSize: 14 }}>
            No hay psicólogos en este centro
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(58,140,140,0.1)' }}>
                {['Nombre', 'Centro', 'Estado', 'Acción'].map(h => (
                  <th key={h} style={{
                    padding: '12px 20px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#7a9090',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < filtrados.length - 1 ? '1px solid rgba(58,140,140,0.07)' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#fafcfc',
                  }}
                >
                  <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500, color: '#1a2e2e' }}>
                    {p.nombre}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#5a7070' }}>
                    {p.centro_nombre}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: p.activo ? '#d1fae5' : '#f3f4f6',
                      color: p.activo ? '#065f46' : '#6b7280',
                    }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => toggleActivo(p.id, p.activo)}
                      disabled={toggling === p.id}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 8,
                        border: '1.5px solid',
                        borderColor: p.activo ? '#fca5a5' : '#3a8c8c',
                        background: p.activo ? '#fff' : '#e8f4f4',
                        color: p.activo ? '#dc2626' : '#2a6b6b',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: toggling === p.id ? 'not-allowed' : 'pointer',
                        opacity: toggling === p.id ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {toggling === p.id ? '...' : p.activo ? 'Desactivar' : 'Activar'}
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
