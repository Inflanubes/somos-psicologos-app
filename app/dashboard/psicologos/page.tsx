'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, Paciente, EstadoPaciente } from '@/types/database'

type AccionPsicologo =
  | 'Agendar cita'
  | 'Cancelar cita'
  | 'Cambiar cita'
  | 'Bloquear agenda'
  | 'Desbloquear agenda'

type PeriodoBloqueo = 'Dias' | 'Semanas'

const ACCIONES: AccionPsicologo[] = [
  'Agendar cita',
  'Cancelar cita',
  'Cambiar cita',
  'Bloquear agenda',
  'Desbloquear agenda',
]

const ACCIONES_CITA: AccionPsicologo[] = ['Agendar cita', 'Cancelar cita', 'Cambiar cita']
const ACCIONES_BLOQUEO: AccionPsicologo[] = ['Bloquear agenda', 'Desbloquear agenda']

function mapAccionToEstado(accion: AccionPsicologo): EstadoPaciente | null {
  switch (accion) {
    case 'Agendar cita':
      return 'Agendado'
    case 'Cancelar cita':
      return 'Anulado'
    case 'Cambiar cita':
      return 'Cambio solicitado'
    default:
      return null
  }
}

function addPeriodo(startDate: string, duracion: number, periodo: PeriodoBloqueo): string {
  const d = new Date(startDate)
  if (periodo === 'Dias') {
    d.setDate(d.getDate() + duracion)
  } else {
    d.setDate(d.getDate() + duracion * 7)
  }
  return d.toISOString().split('T')[0]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid rgba(58,140,140,0.25)',
  borderRadius: 8,
  fontSize: 14,
  color: '#1a2e2e',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#2a4545',
  marginBottom: 6,
  letterSpacing: '0.02em',
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function PsicologosPage() {
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [filteredPsicologos, setFilteredPsicologos] = useState<Psicologo[]>([])

  const [centroId, setCentroId] = useState('')
  const [psicologoId, setPsicologoId] = useState('')
  const [accion, setAccion] = useState<AccionPsicologo | ''>('')

  // Cita fields
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [pacienteResults, setPacienteResults] = useState<Paciente[]>([])
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')

  // Bloqueo fields
  const [fechaInicio, setFechaInicio] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoBloqueo>('Dias')
  const [duracion, setDuracion] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('centros').select('*').order('nombre'),
        supabase.from('psicologos').select('*').eq('activo', true).order('nombre'),
      ])
      setCentros((c ?? []) as Centro[])
      setPsicologos((p ?? []) as Psicologo[])
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (centroId) {
      setFilteredPsicologos(psicologos.filter((p) => p.centro_id === centroId))
    } else {
      setFilteredPsicologos([])
    }
    setPsicologoId('')
  }, [centroId, psicologos])

  // Patient search debounce
  useEffect(() => {
    if (pacienteSearch.length < 2) {
      setPacienteResults([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      const q = pacienteSearch.trim()
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
        .limit(8)
      setPacienteResults((data ?? []) as Paciente[])
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [pacienteSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isCitaAction = accion !== '' && ACCIONES_CITA.includes(accion as AccionPsicologo)
  const isBloqueoAction = accion !== '' && ACCIONES_BLOQUEO.includes(accion as AccionPsicologo)

  function resetForm() {
    setCentroId('')
    setPsicologoId('')
    setAccion('')
    setPacienteSearch('')
    setSelectedPaciente(null)
    setPacienteResults([])
    setShowDropdown(false)
    setFecha('')
    setHora('')
    setFechaInicio('')
    setPeriodo('Dias')
    setDuracion('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!centroId || !psicologoId || !accion) {
      setError('Por favor, completa los campos obligatorios.')
      return
    }
    if (isCitaAction && !selectedPaciente) {
      setError('Debes seleccionar un paciente para esta acción.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const centroNombre = centros.find((c) => c.id === centroId)?.nombre ?? ''
      const psicologoNombre = filteredPsicologos.find((p) => p.id === psicologoId)?.nombre ?? ''

      const fechaFinCalculada =
        isBloqueoAction && fechaInicio && duracion
          ? addPeriodo(fechaInicio, parseInt(duracion, 10), periodo)
          : null

      // 1. Insert accion_psicologo
      const { error: errAccion } = await supabase.from('acciones_psicologos').insert({
        psicologo_id: psicologoId,
        paciente_id: isCitaAction && selectedPaciente ? selectedPaciente.id : psicologoId,
        accion: accion as string,
        fecha_bloqueo_inicio: isBloqueoAction && fechaInicio ? fechaInicio : '',
        fecha_bloqueo_fin: fechaFinCalculada ?? '',
        fecha_cita: isCitaAction && fecha ? fecha : '',
        hora_cita: isCitaAction && hora ? hora : '',
      })

      if (errAccion) throw new Error(errAccion.message)

      // 2. Update paciente if cita action
      if (isCitaAction && selectedPaciente) {
        const nuevoEstado = mapAccionToEstado(accion as AccionPsicologo)
        if (nuevoEstado) {
          const { error: errUpdate } = await supabase
            .from('pacientes')
            .update({
              estado: nuevoEstado,
              ...(fecha ? { fecha_cita: fecha } : {}),
              ...(hora ? { hora_cita: hora } : {}),
            })
            .eq('id', selectedPaciente.id)
          if (errUpdate) throw new Error(errUpdate.message)
        }
      }

      // 3. Fire webhook
      const webhookUrl = process.env.NEXT_PUBLIC_MAKE_PSYCHOLOGIST_WEBHOOK
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'Selecciona tu centro': centroNombre,
            'Psicólogos [CENTRO]': psicologoNombre,
            '¿Qué necesitas hoy?': accion,
            'Selecciona la fecha': isCitaAction ? fecha : '',
            'Selecciona la hora': isCitaAction ? hora : '',
            '¿Cuando quieres que se inicie el bloqueo o desbloqueo de tu agenda?': isBloqueoAction
              ? fechaInicio
              : '',
            'Periodo que quieres bloquear/desbloquear': isBloqueoAction ? periodo : '',
            'Indícanos la duración en números enteros': isBloqueoAction ? duracion : '',
          }),
        })
      }

      setSuccess(true)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
            fontSize: 26,
            fontWeight: 600,
            color: '#1a2e2e',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Citas
        </h1>
        <p style={{ fontSize: 13.5, color: '#7a9090', margin: 0 }}>
          Gestiona citas y disponibilidad de agenda
        </p>
      </div>

      {/* Success */}
      {success && (
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 24,
            color: '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          ✓ Acción registrada correctamente.
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 24,
            color: '#991b1b',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Form card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '28px 32px',
          border: '1px solid rgba(58,140,140,0.13)',
          boxShadow: '0 2px 8px rgba(58,140,140,0.06)',
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Centro + Psicólogo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Centro" required>
              <select
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                required
              >
                <option value="">Selecciona un centro</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Psicólogo/a" required>
              <select
                value={psicologoId}
                onChange={(e) => setPsicologoId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={!centroId}
                required
              >
                <option value="">
                  {centroId ? 'Selecciona un psicólogo' : 'Primero selecciona centro'}
                </option>
                {filteredPsicologos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Acción */}
          <FormField label="¿Qué necesitas hoy?" required>
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value as AccionPsicologo)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              required
            >
              <option value="">Selecciona una acción</option>
              {ACCIONES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </FormField>

          {/* CITA FIELDS */}
          {isCitaAction && (
            <div
              style={{
                background: '#f7f4ef',
                borderRadius: 10,
                padding: '20px 20px 4px',
                marginBottom: 18,
                border: '1px solid rgba(58,140,140,0.12)',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#3a8c8c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 14,
                }}
              >
                Datos de la cita
              </div>

              {/* Patient search */}
              <FormField label="Buscar paciente" required>
                <div ref={searchRef} style={{ position: 'relative' }}>
                  {selectedPaciente ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: '1px solid rgba(58,140,140,0.35)',
                        borderRadius: 8,
                        background: '#e8f4f4',
                        fontSize: 14,
                        color: '#1a2e2e',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{selectedPaciente.nombre}</span>
                        <span style={{ color: '#5a7070', marginLeft: 8, fontSize: 12.5 }}>
                          {selectedPaciente.telefono}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPaciente(null)
                          setPacienteSearch('')
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#7a9090',
                          fontSize: 16,
                          lineHeight: 1,
                          padding: '0 4px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={pacienteSearch}
                      onChange={(e) => setPacienteSearch(e.target.value)}
                      onFocus={() => pacienteResults.length > 0 && setShowDropdown(true)}
                      placeholder="Escribe nombre o teléfono (mín. 2 caracteres)…"
                      style={inputStyle}
                    />
                  )}
                  {showDropdown && pacienteResults.length > 0 && !selectedPaciente && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: '#fff',
                        border: '1px solid rgba(58,140,140,0.2)',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        marginTop: 4,
                        maxHeight: 240,
                        overflowY: 'auto',
                      }}
                    >
                      {pacienteResults.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPaciente(p)
                            setPacienteSearch('')
                            setShowDropdown(false)
                          }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(58,140,140,0.07)',
                            fontSize: 13.5,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLDivElement).style.background = '#f7f4ef')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                          }
                        >
                          <div style={{ fontWeight: 600, color: '#1a2e2e' }}>{p.nombre}</div>
                          <div style={{ fontSize: 12, color: '#9ab0b0', marginTop: 2 }}>
                            {p.telefono}
                            {p.email ? ` · ${p.email}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showDropdown && pacienteResults.length === 0 && pacienteSearch.length >= 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: '#fff',
                        border: '1px solid rgba(58,140,140,0.2)',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        marginTop: 4,
                        padding: '14px',
                        fontSize: 13.5,
                        color: '#9ab0b0',
                        textAlign: 'center',
                      }}
                    >
                      No se encontraron pacientes
                    </div>
                  )}
                </div>
              </FormField>

              {/* Fecha + hora */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Fecha de cita">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Hora de cita">
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* BLOQUEO FIELDS */}
          {isBloqueoAction && (
            <div
              style={{
                background: '#f7f4ef',
                borderRadius: 10,
                padding: '20px 20px 4px',
                marginBottom: 18,
                border: '1px solid rgba(58,140,140,0.12)',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#3a8c8c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 14,
                }}
              >
                Datos del bloqueo
              </div>

              <FormField label="Fecha de inicio">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Periodo">
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value as PeriodoBloqueo)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="Dias">Días</option>
                    <option value="Semanas">Semanas</option>
                  </select>
                </FormField>
                <FormField label="Duración">
                  <input
                    type="number"
                    value={duracion}
                    onChange={(e) => setDuracion(e.target.value)}
                    placeholder="Ej. 2"
                    min={1}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              {fechaInicio && duracion && (
                <div
                  style={{
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#5a7070',
                    background: '#e8f4f4',
                    border: '1px solid rgba(58,140,140,0.2)',
                    borderRadius: 6,
                    padding: '8px 12px',
                  }}
                >
                  Fecha fin estimada:{' '}
                  <strong>
                    {new Date(
                      addPeriodo(fechaInicio, parseInt(duracion, 10) || 0, periodo)
                    ).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px 28px',
                background: loading ? '#9ab0b0' : '#3a8c8c',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Guardando…' : 'Guardar acción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
