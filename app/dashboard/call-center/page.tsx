'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, Paciente, EstadoPaciente } from '@/types/database'

type AccionCallCenter =
  | 'He AGENDADO cita'
  | 'He CAMBIADO cita'
  | 'He ANULADO cita'
  | 'Sin cita disponible'
  | 'Hablar con psicólogo'
  | 'Solicita cambio de psicólogo'
  | 'Otro'

const ACCIONES: AccionCallCenter[] = [
  'He AGENDADO cita',
  'He CAMBIADO cita',
  'He ANULADO cita',
  'Sin cita disponible',
  'Hablar con psicólogo',
  'Solicita cambio de psicólogo',
  'Otro',
]

const ACCIONES_CON_FECHA: AccionCallCenter[] = ['He AGENDADO cita', 'He CAMBIADO cita', 'He ANULADO cita']

async function generarInicialesUnicas(nombre: string): Promise<string> {
  // Build base initials: first letter of each word, uppercase, max 4 chars
  const base = nombre
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4)

  if (!base) return 'XX'

  // Fetch all existing iniciales that start with the base
  const { data } = await supabase
    .from('pacientes')
    .select('iniciales')
    .like('iniciales', `${base}%`)

  const existing = new Set((data ?? []).map((r: { iniciales: string | null }) => r.iniciales))

  if (!existing.has(base)) return base

  // Find the next available suffix number
  let n = 2
  while (existing.has(`${base}${n}`)) n++
  return `${base}${n}`
}

function mapAccionToEstado(accion: AccionCallCenter, estadoActual: EstadoPaciente): EstadoPaciente {
  switch (accion) {
    case 'He AGENDADO cita':
      return 'Agendado'
    case 'He CAMBIADO cita':
      return 'Cambio solicitado'
    case 'He ANULADO cita':
      return 'Anulado'
    case 'Sin cita disponible':
      return 'Sin disponibilidad'
    case 'Hablar con psicólogo':
      return 'En espera'
    case 'Solicita cambio de psicólogo':
      return 'Cambio solicitado'
    case 'Otro':
      return estadoActual
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid rgba(47,90,174,0.25)',
  borderRadius: 8,
  fontSize: 14,
  color: '#272626',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#2f5aae',
  marginBottom: 6,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
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

export default function CallCenterPage() {
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [filteredPsicologos, setFilteredPsicologos] = useState<Psicologo[]>([])

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [centroId, setCentroId] = useState('')
  const [psicologoId, setPsicologoId] = useState('')
  const [accion, setAccion] = useState<AccionCallCenter | ''>('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [fechaAnterior, setFechaAnterior] = useState('')
  const [horaAnterior, setHoraAnterior] = useState('')
  const [esMenor, setEsMenor] = useState(false)
  const [edad, setEdad] = useState('')
  const [comentarios, setComentarios] = useState('')

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
  }, [centroId, psicologos])

  const showFechaHora = accion !== '' && ACCIONES_CON_FECHA.includes(accion as AccionCallCenter)
  const isCambiarCita = accion === 'He CAMBIADO cita'
  const isAnularCita = accion === 'He ANULADO cita'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre || !telefono || !centroId || !accion) {
      setError('Por favor, completa los campos obligatorios.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const agenteNombre = user?.email ?? 'Desconocido'
      const accionValue = accion as AccionCallCenter

      // 1a. Search or create paciente
      const searchResult = await supabase
        .from('pacientes')
        .select('*')
        .eq('telefono', telefono)
        .limit(1)
      const existentes = (searchResult.data ?? []) as Paciente[]

      let pacienteId: string
      let estadoAnterior: EstadoPaciente = 'Nuevo paciente'

      if (existentes.length > 0) {
        pacienteId = existentes[0].id
        estadoAnterior = existentes[0].estado
      } else {
        const iniciales = await generarInicialesUnicas(nombre)

        const { data: nuevo, error: errInsert } = await supabase
          .from('pacientes')
          .insert({
            nombre,
            telefono,
            email,
            centro_id: centroId,
            psicologo_id: psicologoId || centroId,
            estado: 'Nuevo paciente' as EstadoPaciente,
            es_menor: esMenor,
            edad: esMenor && edad ? parseInt(edad, 10) : 0,
            fecha_cita: showFechaHora && fecha ? fecha : null,
            hora_cita: showFechaHora && hora ? hora : null,
            fecha_incorporacion: new Date().toISOString(),
            iniciales,
          })
          .select('id')
          .single()

        if (errInsert || !nuevo) throw new Error(errInsert?.message ?? 'Error al crear paciente')
        pacienteId = nuevo.id
      }

      const estadoNuevo = mapAccionToEstado(accionValue, estadoAnterior)

      // 1b. Insert acciones_call_center
      const { error: errAccion } = await supabase.from('acciones_call_center').insert({
        paciente_id: pacienteId,
        accion: accionValue,
        agente_nombre: agenteNombre,
        centro_id: centroId,
        psicologo_id: psicologoId || centroId,
        fecha_cita: showFechaHora && fecha ? fecha : null,
        hora_cita: showFechaHora && hora ? hora : null,
        comentario: comentarios,
        created_by: 'call center',
      })

      if (errAccion) throw new Error(errAccion.message)

      // 1c. Insert historial_estados
      const { error: errHistorial } = await supabase.from('historial_estados').insert({
        paciente_id: pacienteId,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        fecha_cambio: new Date().toISOString(),
        origen: 'call_center',
        comentario: comentarios,
      })

      if (errHistorial) throw new Error(errHistorial.message)

      // Update paciente estado if changed
      if (estadoNuevo !== estadoAnterior) {
        await supabase
          .from('pacientes')
          .update({
            estado: estadoNuevo,
            ...(showFechaHora && fecha ? { fecha_cita: fecha } : {}),
            ...(showFechaHora && hora ? { hora_cita: hora } : {}),
          })
          .eq('id', pacienteId)
      }

      // 2. Fire webhook
      const centroNombre = centros.find((c) => c.id === centroId)?.nombre ?? ''
      const psicologoNombre = filteredPsicologos.find((p) => p.id === psicologoId)?.nombre ?? ''

      const webhookUrl = process.env.NEXT_PUBLIC_MAKE_CALL_CENTER_WEBHOOK
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            respuestasFormulario: {
              'NOMBRE COMPLETO': nombre,
              'TELÉFONO': telefono,
              'CORREO ELECTRÓNICO': email,
              'CLINICA': centroNombre,
              'Psicólogos [CLINICA]': psicologoNombre,
              'ACCIÓN TOMADA': accionValue,
              'FECHA': fecha,
              'HORA': hora,
              'FECHA ANTERIOR': isCambiarCita ? fechaAnterior : '',
              'HORA ANTERIOR': isCambiarCita ? horaAnterior : '',
              'EDAD (si es menor)': esMenor ? edad : '',
              'COMENTARIOS': comentarios,
            },
            datosHojaCalculo: {
              'NOMBRE COMPLETO': nombre,
              'TELÉFONO': telefono,
              'CLINICA': centroNombre,
              'Psicólogos [CLINICA]': psicologoNombre,
              'Indica en detalle motivo y objetivo de la llamada (añade datos de contacto si aplica)':
                comentarios,
            },
          }),
        })
      }

      setSuccess(true)
      // Reset form
      setNombre('')
      setTelefono('')
      setEmail('')
      setCentroId('')
      setPsicologoId('')
      setAccion('')
      setFecha('')
      setHora('')
      setFechaAnterior('')
      setHoraAnterior('')
      setEsMenor(false)
      setEdad('')
      setComentarios('')
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
          Gestiones
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Registra la acción realizada durante la llamada
        </p>
      </div>

      {/* Success message */}
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
          ✓ Registro guardado correctamente. El formulario ha sido reiniciado.
        </div>
      )}

      {/* Error message */}
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
          borderRadius: 16,
          padding: '28px 32px',
          boxShadow: '6px 6px 30px rgba(0,0,0,0.08)',
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Row: nombre + telefono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Nombre completo" required>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. María García López"
                style={inputStyle}
                required
              />
            </FormField>
            <FormField label="Teléfono" required>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 612345678"
                style={inputStyle}
                required
              />
            </FormField>
          </div>

          {/* Email */}
          <FormField label="Correo electrónico">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej. maria@ejemplo.com"
              style={inputStyle}
            />
          </FormField>

          {/* Row: clinica + psicologo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Clínica" required>
              <select
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                required
              >
                <option value="">Selecciona una clínica</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Psicólogo/a">
              <select
                value={psicologoId}
                onChange={(e) => setPsicologoId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={!centroId}
              >
                <option value="">
                  {centroId ? 'Selecciona un psicólogo' : 'Primero selecciona clínica'}
                </option>
                {filteredPsicologos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Accion */}
          <FormField label="Acción tomada" required>
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value as AccionCallCenter)}
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

          {/* Fecha + hora (conditional) */}
          {showFechaHora && (
            <div>
              {/* Cambiar cita: fecha/hora anterior (para que Make encuentre el evento) */}
              {isCambiarCita && (
                <>
                  <div
                    style={{
                      background: '#eef2fb',
                      borderLeft: '4px solid #2f5aae',
                      borderRadius: '0 8px 8px 0',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#3a4a6b',
                      marginBottom: 14,
                    }}
                  >
                    Fecha y hora <strong>actual</strong> de la cita a cambiar:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <FormField label="Fecha actual de la cita">
                      <input
                        type="date"
                        value={fechaAnterior}
                        onChange={(e) => setFechaAnterior(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Hora actual de la cita">
                      <input
                        type="time"
                        value={horaAnterior}
                        onChange={(e) => setHoraAnterior(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>
                  <div
                    style={{
                      background: '#eef2fb',
                      borderLeft: '4px solid #2f5aae',
                      borderRadius: '0 8px 8px 0',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#3a4a6b',
                      marginBottom: 14,
                    }}
                  >
                    Nueva fecha y hora:
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField
                  label={
                    isCambiarCita
                      ? 'Nueva fecha de cita'
                      : isAnularCita
                        ? 'Fecha de la cita anulada'
                        : 'Fecha de cita'
                  }
                >
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField
                  label={
                    isCambiarCita
                      ? 'Nueva hora de cita'
                      : isAnularCita
                        ? 'Hora de la cita anulada'
                        : 'Hora de cita'
                  }
                >
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

          {/* Es menor + edad */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 14,
                color: '#3a4a6b',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={esMenor}
                onChange={(e) => setEsMenor(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2f5aae', cursor: 'pointer' }}
              />
              Es paciente menor de edad
            </label>
          </div>

          {esMenor && (
            <FormField label="Edad">
              <input
                type="number"
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                placeholder="Ej. 12"
                min={0}
                max={17}
                style={{ ...inputStyle, width: 120 }}
              />
            </FormField>
          )}

          {/* Comentarios */}
          <FormField label="Comentarios">
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Motivo de la llamada, detalles adicionales…"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </FormField>

          {/* Submit */}
          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px 28px',
                background: loading ? '#8899bb' : '#2f5aae',
                color: '#fff',
                border: 'none',
                borderRadius: 30,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: '"Varela Round", inherit',
                transition: 'background 0.2s',
                boxShadow: '0 4px 14px rgba(47,90,174,0.30)',
              }}
            >
              {loading ? 'Guardando…' : 'Guardar registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
