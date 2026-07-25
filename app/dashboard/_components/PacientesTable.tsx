'use client'

import { useState, useMemo } from 'react'
import { ESTADOS_PACIENTE, type EstadoPaciente } from '@/types/database'

export interface PacienteRow {
  id: string
  nombre: string
  telefono: string
  estado: EstadoPaciente
  psicologo_nombre: string
  fecha_cita: string | null
  hora_cita: string | null
  es_menor: boolean
  edad: number | null
  fecha_nacimiento: string | null
  consentimiento: boolean | null
  fecha_incorporacion: string | null
}

// La edad actual se calcula de fecha_nacimiento; los pacientes antiguos solo
// tienen la edad registrada en su día (columna edad).
export function edadActual(p: Pick<PacienteRow, 'edad' | 'fecha_nacimiento'>): number | null {
  if (!p.fecha_nacimiento) return p.edad
  const hoy = new Date()
  const nac = new Date(p.fecha_nacimiento + 'T00:00:00')
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

interface Props {
  pacientes: PacienteRow[]
}

const ESTADO_STYLE: Record<EstadoPaciente, { bg: string; color: string }> = {
  'Nuevo paciente':              { bg: '#eef2fb', color: '#254d99' },
  'Agendado':                    { bg: '#d1fae5', color: '#065f46' },
  'Anulado':                     { bg: '#fee2e2', color: '#991b1b' },
  'Sin disponibilidad':          { bg: '#f3f4f6', color: '#6b7280' },
  'En espera':                   { bg: '#fef3c7', color: '#92400e' },
  'Cambio solicitado':           { bg: '#e0e7ff', color: '#3730a3' },
  'Dudoso':                      { bg: '#ffedd5', color: '#9a3412' },
  'Dudoso contactado':           { bg: '#fff7ed', color: '#c2410c' },
  'Revisar recomendado':         { bg: '#f3e8ff', color: '#6b21a8' },
  'Psicólogo sin disponibilidad':{ bg: '#fce7f3', color: '#9d174d' },
  'Psicólogo':                   { bg: '#e0f2fe', color: '#075985' },
  'Inactivo':                    { bg: '#f1f5f9', color: '#475569' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    // Date-only strings ("YYYY-MM-DD") are parsed as UTC by `new Date`, which
    // shifts the day back in timezones ahead of UTC (e.g. Europe/Madrid).
    // Append a local midnight so the day is preserved.
    const d = dateStr.length === 10 ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function PacientesTable({ pacientes }: Props) {
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')

  const filtered = useMemo(() => {
    return pacientes.filter((p) => {
      const matchSearch =
        search === '' ||
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        p.psicologo_nombre.toLowerCase().includes(search.toLowerCase())
      const matchEstado = estadoFilter === 'todos' || p.estado === estadoFilter
      return matchSearch && matchEstado
    })
  }, [pacientes, search, estadoFilter])

  return (
    <div>
      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#667799"
            strokeWidth={2.5}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar paciente o psicólogo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              border: '1px solid rgba(47,90,174,0.2)',
              background: '#f4f5f7',
              fontSize: 13,
              color: '#272626',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(47,90,174,0.2)',
            background: '#f4f5f7',
            fontSize: 13,
            color: '#272626',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_PACIENTE.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: '#667799', marginLeft: 'auto' }}>
          {filtered.length} pacientes
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(47,90,174,0.12)' }}>
              {['Nombre', 'Estado', 'Psicólogo', 'Fecha Cita', 'Edad', 'Consent.', 'Teléfono'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#667799',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: '#a0b0cc', fontSize: 14 }}>
                  No se encontraron pacientes
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => {
                const badge = ESTADO_STYLE[p.estado] ?? { bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid rgba(47,90,174,0.07)',
                      transition: 'background 0.12s',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(47,90,174,0.018)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(47,90,174,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(47,90,174,0.018)')}
                  >
                    <td data-label="Nombre" style={{ padding: '12px', fontSize: 13.5, fontWeight: 500, color: '#272626', whiteSpace: 'nowrap' }}>
                      {p.nombre}
                      {p.es_menor && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '1px 5px',
                            borderRadius: 4,
                            fontWeight: 600,
                            letterSpacing: '0.03em',
                          }}
                        >
                          MENOR
                        </span>
                      )}
                    </td>
                    <td data-label="Estado" style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: badge.bg,
                          color: badge.color,
                          padding: '3px 9px',
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.estado}
                      </span>
                    </td>
                    <td data-label="Psicólogo" style={{ padding: '12px', fontSize: 13, color: '#4a5870' }}>
                      {p.psicologo_nombre || '—'}
                    </td>
                    <td data-label="Fecha Cita" style={{ padding: '12px', fontSize: 13, color: '#4a5870', whiteSpace: 'nowrap' }}>
                      {p.fecha_cita ? `${formatDate(p.fecha_cita)} ${p.hora_cita ?? ''}`.trim() : '—'}
                    </td>
                    <td data-label="Edad" style={{ padding: '12px', fontSize: 13, color: '#4a5870' }}>
                      {edadActual(p) ?? '—'}
                    </td>
                    <td data-label="Consent." style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                      <span
                        title={p.consentimiento ? 'Consentimiento firmado' : 'Consentimiento pendiente'}
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: p.consentimiento ? '#d1fae5' : '#fef3c7',
                          color: p.consentimiento ? '#065f46' : '#92400e',
                        }}
                      >
                        {p.consentimiento ? '✓' : 'Pendiente'}
                      </span>
                    </td>
                    <td data-label="Teléfono" style={{ padding: '12px', fontSize: 13, color: '#667799', whiteSpace: 'nowrap' }}>
                      {p.telefono || '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
