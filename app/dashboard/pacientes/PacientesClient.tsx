'use client'

import { useState, useMemo } from 'react'
import { ESTADOS_PACIENTE, type EstadoPaciente } from '@/types/database'

export interface PacienteTableRow {
  id: string
  nombre: string
  telefono: string
  email: string
  centro_nombre: string
  psicologo_nombre: string
  estado: EstadoPaciente
  fecha_cita: string | null
  hora_cita: string | null
  es_menor: boolean
  edad: number | null
  consentimiento: boolean | null
  fecha_incorporacion: string | null
}

function estadoBadgeStyle(estado: EstadoPaciente): React.CSSProperties {
  switch (estado) {
    case 'Agendado':
      return { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }
    case 'Nuevo paciente':
      return { background: '#eef2fb', color: '#1a5f5f', border: '1px solid #b2dede' }
    case 'Anulado':
      return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
    case 'En espera':
      return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }
    case 'Sin disponibilidad':
      return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }
    case 'Inactivo':
      return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }
    default:
      return { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }
  }
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PacientesClient({ pacientes }: { pacientes: PacienteTableRow[] }) {
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoPaciente | ''>('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return pacientes.filter((p) => {
      const matchSearch =
        !q ||
        (p.nombre ?? '').toLowerCase().includes(q) ||
        (p.telefono ?? '').includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.psicologo_nombre ?? '').toLowerCase().includes(q) ||
        (p.centro_nombre ?? '').toLowerCase().includes(q)
      const matchEstado = !estadoFilter || p.estado === estadoFilter
      return matchSearch && matchEstado
    })
  }, [pacientes, search, estadoFilter])

  const inputStyle: React.CSSProperties = {
    padding: '9px 14px',
    border: '1px solid rgba(47,90,174,0.25)',
    borderRadius: 8,
    fontSize: 13.5,
    color: '#272626',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono, email o psicólogo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 320 }}
        />
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EstadoPaciente | '')}
          style={{ ...inputStyle, minWidth: 200, cursor: 'pointer' }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_PACIENTE.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {(search || estadoFilter) && (
          <button
            onClick={() => { setSearch(''); setEstadoFilter('') }}
            style={{
              padding: '9px 16px',
              border: '1px solid rgba(47,90,174,0.25)',
              borderRadius: 8,
              fontSize: 13,
              color: '#4a5870',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Limpiar
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#8899bb', alignSelf: 'center' }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['Nombre', 'Teléfono', 'Centro', 'Psicólogo', 'Estado', 'Consentimiento', 'Fecha cita'].map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#667799',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    borderBottom: '1px solid rgba(47,90,174,0.1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '48px 0', color: '#8899bb', fontSize: 14 }}
                >
                  No se encontraron pacientes
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? '1px solid rgba(47,90,174,0.07)' : 'none',
                  }}
                >
                  <td style={{ padding: '13px 14px', color: '#272626', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.nombre}
                      {p.es_menor && (
                        <span
                          style={{
                            fontSize: 10,
                            background: '#f3e8ff',
                            color: '#6d28d9',
                            border: '1px solid #ddd6fe',
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontWeight: 600,
                          }}
                        >
                          MENOR
                        </span>
                      )}
                    </div>
                    {p.email && (
                      <div style={{ fontSize: 12, color: '#8899bb', marginTop: 2 }}>{p.email}</div>
                    )}
                  </td>
                  <td style={{ padding: '13px 14px', color: '#4a5870' }}>{p.telefono || '—'}</td>
                  <td style={{ padding: '13px 14px', color: '#4a5870' }}>{p.centro_nombre || '—'}</td>
                  <td style={{ padding: '13px 14px', color: '#4a5870' }}>{p.psicologo_nombre}</td>
                  <td style={{ padding: '13px 14px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        ...estadoBadgeStyle(p.estado),
                      }}
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: p.consentimiento ? '#dcfce7' : '#fef3c7',
                        color: p.consentimiento ? '#166534' : '#92400e',
                        border: `1px solid ${p.consentimiento ? '#bbf7d0' : '#fde68a'}`,
                      }}
                    >
                      {p.consentimiento ? '✓ Firmado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 14px', color: '#4a5870', whiteSpace: 'nowrap' }}>
                    {formatFecha(p.fecha_cita)}
                    {p.hora_cita && (
                      <span style={{ marginLeft: 6, color: '#8899bb', fontSize: 12 }}>
                        {p.hora_cita}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
