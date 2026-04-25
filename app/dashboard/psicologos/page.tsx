'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, Paciente, AccionPsicologoInsert } from '@/types/database'

type AccionPsicologo =
  | 'Agendar cita'
  | 'Cancelar cita'
  | 'Cambiar cita'
  | 'Bloquear agenda'
  | 'Desbloquear agenda'
  | 'Asuntos propios'
  | 'Vacaciones'
  | 'Baja laboral'

type PeriodoBloqueo = 'Horas' | 'Dias' | 'Semanas' | 'Meses'

const ACCIONES: AccionPsicologo[] = [
  'Agendar cita',
  'Cancelar cita',
  'Cambiar cita',
  'Bloquear agenda',
  'Desbloquear agenda',
  'Asuntos propios',
  'Vacaciones',
  'Baja laboral',
]

const ACCIONES_CITA: AccionPsicologo[] = ['Agendar cita', 'Cancelar cita', 'Cambiar cita']
const ACCIONES_BLOQUEO: AccionPsicologo[] = [
  'Bloquear agenda',
  'Desbloquear agenda',
  'Asuntos propios',
  'Vacaciones',
  'Baja laboral',
]

const BRAND_BLUE   = '#2f5aae'
const BRAND_ORANGE = '#ed8f0c'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #dde1ea',
  borderRadius: 8,
  fontSize: 14,
  color: '#272626',
  background: '#fff',
  outline: 'none',
  fontFamily: "'Montserrat', inherit",
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: BRAND_BLUE,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: BRAND_ORANGE,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '20px 0 14px',
        paddingBottom: 8,
        borderBottom: `2px solid #fdefd5`,
      }}
    >
      {children}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#eef2fb',
        borderLeft: `4px solid ${BRAND_BLUE}`,
        borderRadius: '0 8px 8px 0',
        padding: '10px 14px',
        fontSize: 13,
        color: '#3a4a6b',
        marginBottom: 16,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  )
}

export default function PsicologosPage() {
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [filteredPsicologos, setFilteredPsicologos] = useState<Psicologo[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loadingPacientes, setLoadingPacientes] = useState(false)

  const [centroId, setCentroId] = useState('')
  const [psicologoId, setPsicologoId] = useState('')
  const [accion, setAccion] = useState<AccionPsicologo | ''>('')

  // Cita fields
  const [pacienteIniciales, setPacienteIniciales] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')

  // Cambiar cita: current appointment date/time (so Make can find the GCal event)
  const [fechaActual, setFechaActual] = useState('')
  const [horaActual, setHoraActual] = useState('')

  // Bloqueo fields
  const [fechaInicio, setFechaInicio] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoBloqueo>('Dias')
  const [duracion, setDuracion] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
    setPacientes([])
    setPacienteIniciales('')
  }, [centroId, psicologos])

  // Load patients filtered by selected psychologist
  useEffect(() => {
    if (!psicologoId) {
      setPacientes([])
      setPacienteIniciales('')
      return
    }
    setLoadingPacientes(true)
    supabase
      .from('pacientes')
      .select('id, nombre, iniciales, psicologo_id')
      .eq('psicologo_id', psicologoId)
      .not('iniciales', 'is', null)
      .order('iniciales')
      .then(({ data }) => {
        setPacientes((data ?? []) as Paciente[])
        setLoadingPacientes(false)
      })
  }, [psicologoId])

  const isCitaAction = accion !== '' && ACCIONES_CITA.includes(accion as AccionPsicologo)
  const isBloqueoAction = accion !== '' && ACCIONES_BLOQUEO.includes(accion as AccionPsicologo)
  const isCambiarCita = accion === 'Cambiar cita'

  function resetForm() {
    setCentroId('')
    setPsicologoId('')
    setAccion('')
    setPacienteIniciales('')
    setPacientes([])
    setFecha('')
    setHora('')
    setFechaActual('')
    setHoraActual('')
    setFechaInicio('')
    setHoraInicio('')
    setPeriodo('Dias')
    setDuracion('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!centroId || !psicologoId || !accion) {
      setError('Por favor, completa los campos obligatorios.')
      return
    }
    if (isCitaAction && !pacienteIniciales) {
      setError('Debes seleccionar un paciente para esta acción.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const centroNombre = centros.find((c) => c.id === centroId)?.nombre ?? ''
      const psicologoNombre = filteredPsicologos.find((p) => p.id === psicologoId)?.nombre ?? ''

      // Insert into acciones_psicologos
      const accionPsicologo: AccionPsicologoInsert = {
        psicologo_id: psicologoId,
        accion: accion,
        created_by: psicologoNombre,
        fecha_cita: isCitaAction ? fecha || null : null,
        hora_cita: isCitaAction ? hora || null : null,
        fecha_bloqueo_inicio: isBloqueoAction ? fechaInicio || null : isCambiarCita ? fechaActual || null : null,
        marca_temporal: new Date().toISOString(),
      }
      if (isCitaAction && pacienteIniciales) {
        const { data: pacData } = await supabase
          .from('pacientes')
          .select('id')
          .eq('psicologo_id', psicologoId)
          .eq('iniciales', pacienteIniciales)
          .limit(1)
        if (pacData && pacData.length > 0) {
          accionPsicologo.paciente_id = (pacData[0] as { id: string }).id
        }
      }
      await supabase.from('acciones_psicologos').insert(accionPsicologo)

      const datosProcesados = {
        centro: centroNombre,
        psicologo_nombre: psicologoNombre,
        accion: accion,
        paciente_iniciales: isCitaAction ? pacienteIniciales : null,
        // For "Cambiar cita": fecha_cita/hora_cita = NEW appointment
        fecha_cita: isCitaAction ? fecha || null : null,
        hora_cita: isCitaAction ? hora || null : null,
        // For "Cambiar cita": fecha_inicio_bloqueo/hora_inicio_bloqueo = CURRENT appointment (to find GCal event)
        // For bloqueo actions: fecha_inicio_bloqueo/hora_inicio_bloqueo = block start
        fecha_inicio_bloqueo: isCambiarCita
          ? fechaActual || null
          : isBloqueoAction
            ? fechaInicio || null
            : null,
        hora_inicio_bloqueo: isCambiarCita
          ? horaActual || null
          : isBloqueoAction
            ? horaInicio || null
            : null,
        periodo: isBloqueoAction ? periodo : null,
        duracion: isBloqueoAction && duracion ? parseInt(duracion, 10) : null,
      }

      await fetch('/api/webhook/psicologos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'dashboard',
          datosProcesados,
        }),
      })

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
            color: '#272626',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Citas
        </h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: 0 }}>
          Gestiona citas y disponibilidad de agenda
        </p>
      </div>

      {/* Success */}
      {success && (
        <div
          style={{
            background: '#e8f4e8',
            border: '1.5px solid #b5d9b5',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 24,
            color: '#2a7a2a',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ✅ ¡Listo! La acción se ha registrado correctamente.
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#fdeaea',
            border: '1.5px solid #f5b7b1',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 24,
            color: '#c0392b',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Form card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '36px 40px',
          boxShadow: '6px 6px 30px rgba(0,0,0,0.10)',
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

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1.5px solid #eef0f5', margin: '4px 0 20px' }} />

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
            <div>
              <SectionTitle>
                {accion === 'Agendar cita' ? 'Nueva cita' : accion === 'Cancelar cita' ? 'Cancelar cita' : 'Cambiar cita'}
              </SectionTitle>

              {/* Patient dropdown */}
              <FormField label="Paciente" required>
                <select
                  value={pacienteIniciales}
                  onChange={(e) => setPacienteIniciales(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  disabled={!psicologoId || loadingPacientes}
                  required
                >
                  <option value="">
                    {!psicologoId
                      ? 'Primero selecciona psicólogo'
                      : loadingPacientes
                        ? 'Cargando pacientes…'
                        : pacientes.length === 0
                          ? 'Sin pacientes con iniciales'
                          : 'Selecciona el paciente'}
                  </option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.iniciales ?? ''}>
                      {p.iniciales}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* For Cambiar cita: current appointment */}
              {isCambiarCita && (
                <>
                  <InfoBox>
                    Fecha y hora <strong>actual</strong> de la cita a cambiar:
                  </InfoBox>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <FormField label="Fecha actual">
                      <input
                        type="date"
                        value={fechaActual}
                        onChange={(e) => setFechaActual(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Hora actual">
                      <input
                        type="time"
                        value={horaActual}
                        onChange={(e) => setHoraActual(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>
                  <InfoBox>Nueva fecha y hora:</InfoBox>
                </>
              )}

              {/* Fecha + hora */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label={isCambiarCita ? 'Nueva fecha' : 'Fecha de cita'}>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label={isCambiarCita ? 'Nueva hora' : 'Hora de cita'}>
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
            <div>
              <SectionTitle>
                {accion === 'Desbloquear agenda' ? 'Desbloquear agenda' : accion}
              </SectionTitle>

              {accion === 'Desbloquear agenda' && (
                <InfoBox>Indica la fecha y hora de inicio del bloqueo que quieres eliminar.</InfoBox>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Fecha de inicio">
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Hora de inicio">
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              {accion !== 'Desbloquear agenda' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FormField label="Periodo">
                    <select
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value as PeriodoBloqueo)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="Horas">Horas</option>
                      <option value="Dias">Días</option>
                      <option value="Semanas">Semanas</option>
                      <option value="Meses">Meses</option>
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
              )}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: 28 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#a0b0cc' : BRAND_BLUE,
                color: '#fff',
                border: 'none',
                borderRadius: 30,
                fontSize: 15,
                fontWeight: 400,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'Varela Round', sans-serif",
                transition: 'background 0.2s, box-shadow 0.2s',
                boxShadow: loading ? 'none' : `0 4px 14px rgba(47,90,174,0.30)`,
                letterSpacing: '0.3px',
              }}
            >
              {loading ? 'Enviando…' : 'Guardar acción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
