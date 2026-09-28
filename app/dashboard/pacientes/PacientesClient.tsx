'use client'

import { useState, useMemo } from 'react'
import { ESTADOS_PACIENTE, type EstadoPaciente, type TipoCita } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { TIPOS_CONSULTA, COLUMNA_PSICOLOGO, ETIQUETA_TIPO, type ColumnaPsicologo } from '@/lib/pacientes-tipos'

export interface PacienteTableRow {
  id: string
  nombre: string
  telefono: string
  email: string
  centro_nombre: string
  psicologo_nombre: string
  /** Psicólogo por tipo de consulta (migración 014); al menos uno relleno. */
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
  anadido_por: string | null
  origen: string | null
  estado: EstadoPaciente
  fecha_cita: string | null
  hora_cita: string | null
  es_menor: boolean
  edad: number | null
  consentimiento: boolean | null
  dni: string | null
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

export type PsicologoOpcion = { id: string; nombre: string; activo: boolean; tipos_consulta: TipoCita[] }

export default function PacientesClient({
  pacientes: pacientesIniciales,
  psicologos = [],
  puedeEditarPsicologos = false,
}: {
  pacientes: PacienteTableRow[]
  psicologos?: PsicologoOpcion[]
  puedeEditarPsicologos?: boolean
}) {
  const [pacientes, setPacientes] = useState(pacientesIniciales)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoPaciente | ''>('')
  // Panel inline para cambiar (o quitar) el psicólogo de cada tipo de un paciente. Solo agentes.
  const [editando, setEditando] = useState<{ id: string; valores: Record<ColumnaPsicologo, string | null> } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)

  const nombrePsi = (id: string | null) => (id ? psicologos.find((p) => p.id === id)?.nombre ?? '—' : null)
  function abrirEdicion(p: PacienteTableRow) {
    setErrorEdicion(null)
    setEditando({
      id: p.id,
      valores: { psicologo_adultos_id: p.psicologo_adultos_id, psicologo_pareja_id: p.psicologo_pareja_id, psicologo_infantil_id: p.psicologo_infantil_id },
    })
  }
  // Psicólogos que pueden ir en cada tipo: los que lo pasan (o sin tipos configurados) y el actual aunque esté inactivo.
  function opcionesPara(tipo: TipoCita, actual: string | null) {
    return psicologos.filter((p) => p.id === actual || (p.activo && (p.tipos_consulta.length === 0 || p.tipos_consulta.includes(tipo))))
  }
  async function guardarEdicion() {
    if (!editando) return
    const v = editando.valores
    if (!v.psicologo_adultos_id && !v.psicologo_pareja_id && !v.psicologo_infantil_id) {
      setErrorEdicion('El paciente tiene que tener al menos un psicólogo.')
      return
    }
    setGuardando(true)
    setErrorEdicion(null)
    const { error } = await supabase.from('pacientes').update(v).eq('id', editando.id)
    setGuardando(false)
    if (error) { setErrorEdicion('No se pudo guardar: ' + error.message); return }
    setPacientes((prev) => prev.map((p) => (p.id !== editando.id ? p : {
      ...p,
      ...v,
      psicologo_nombre: TIPOS_CONSULTA
        .map((t) => [t, v[COLUMNA_PSICOLOGO[t]]] as const)
        .filter((x): x is readonly [TipoCita, string] => !!x[1])
        .map(([t, id]) => `${ETIQUETA_TIPO[t]}: ${nombrePsi(id)}`)
        .join(' · ') || 'Sin asignar',
    })))
    setEditando(null)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return pacientes.filter((p) => {
      const matchSearch =
        !q ||
        (p.nombre ?? '').toLowerCase().includes(q) ||
        (p.telefono ?? '').includes(q) ||
        (p.dni ?? '').toLowerCase().includes(q) ||
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
          placeholder="Buscar por nombre, teléfono, DNI, email o psicólogo…"
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
        <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['Nombre', 'Teléfono', 'DNI', 'Centro', 'Psicólogos', 'Estado', 'Consentimiento', 'Fecha cita', 'Añadido por'].map((col) => (
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
                  colSpan={9}
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
                  <td data-label="Nombre" style={{ padding: '13px 14px', color: '#272626', fontWeight: 500 }}>
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
                  <td data-label="Teléfono" style={{ padding: '13px 14px', color: '#4a5870' }}>{p.telefono || '—'}</td>
                  <td data-label="DNI" style={{ padding: '13px 14px', color: '#4a5870', whiteSpace: 'nowrap' }}>{p.dni || '—'}</td>
                  <td data-label="Centro" style={{ padding: '13px 14px', color: '#4a5870' }}>{p.centro_nombre || '—'}</td>
                  <td data-label="Psicólogos" style={{ padding: '13px 14px', color: '#4a5870' }}>
                    {editando?.id === p.id ? (
                      <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
                        {TIPOS_CONSULTA.map((t) => (
                          <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span style={{ width: 56, color: '#667799' }}>{ETIQUETA_TIPO[t]}</span>
                            <select
                              value={editando.valores[COLUMNA_PSICOLOGO[t]] ?? ''}
                              onChange={(e) => setEditando((prev) => prev && { ...prev, valores: { ...prev.valores, [COLUMNA_PSICOLOGO[t]]: e.target.value || null } })}
                              style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(47,90,174,0.25)', fontSize: 12.5, fontFamily: 'inherit' }}
                            >
                              <option value="">Ninguno</option>
                              {opcionesPara(t, editando.valores[COLUMNA_PSICOLOGO[t]]).map((ps) => (
                                <option key={ps.id} value={ps.id}>{ps.nombre}{ps.activo ? '' : ' (inactivo)'}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                        {errorEdicion && <div style={{ fontSize: 12, color: '#b91c1c' }}>{errorEdicion}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={guardarEdicion} disabled={guardando} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: guardando ? 0.6 : 1 }}>
                            {guardando ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button type="button" onClick={() => setEditando(null)} disabled={guardando} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {p.psicologo_nombre}
                        {puedeEditarPsicologos && (
                          <button
                            type="button"
                            onClick={() => abrirEdicion(p)}
                            title="Cambiar o quitar el psicólogo de cada tipo de consulta"
                            style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Editar
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td data-label="Estado" style={{ padding: '13px 14px' }}>
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
                  <td data-label="Consentimiento" style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
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
                  <td data-label="Fecha cita" style={{ padding: '13px 14px', color: '#4a5870', whiteSpace: 'nowrap' }}>
                    {formatFecha(p.fecha_cita)}
                    {p.hora_cita && (
                      <span style={{ marginLeft: 6, color: '#8899bb', fontSize: 12 }}>
                        {p.hora_cita}
                      </span>
                    )}
                  </td>
                  <td data-label="Añadido por" style={{ padding: '13px 14px', color: '#4a5870', whiteSpace: 'nowrap' }}>
                    {p.anadido_por ?? '—'}
                    {p.origen && (
                      <span style={{ marginLeft: 6, color: '#8899bb', fontSize: 11.5 }}>
                        {p.origen === 'call_center' ? 'call center' : p.origen}
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
