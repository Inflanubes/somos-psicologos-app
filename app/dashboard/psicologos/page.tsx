'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, Paciente, Perfil } from '@/types/database'
import EventoSelect from '@/components/EventoSelect'
import { fetchCitasActivas, fetchBloqueosActivos, type EventoActivo } from '@/lib/eventos-activos'
import { getPerfilActual } from '@/lib/perfil'

type AccionPsicologo =
  | 'Agendar cita'
  | 'Cancelar cita'
  | 'Cambiar cita'
  | 'Bloquear agenda'
  | 'Desbloquear agenda'
  | 'Modificar bloqueo personal'
  | 'Añadir nuevo paciente'
  | 'Asuntos propios'
  | 'Vacaciones'
  | 'Baja laboral'

type PeriodoBloqueo = 'Horas' | 'Dias' | 'Semanas' | 'Meses'

const ACCIONES: AccionPsicologo[] = [
  'Agendar cita',
  'Añadir nuevo paciente',
  'Cambiar cita',
  'Cancelar cita',
  'Bloquear agenda',
  'Desbloquear agenda',
  'Modificar bloqueo personal',
  'Asuntos propios',
  'Vacaciones',
  'Baja laboral',
]

const ACCIONES_CITA: AccionPsicologo[] = ['Agendar cita', 'Cancelar cita', 'Cambiar cita']
const ACCIONES_BLOQUEO: AccionPsicologo[] = [
  'Bloquear agenda',
  'Desbloquear agenda',
  'Modificar bloqueo personal',
  'Asuntos propios',
  'Vacaciones',
  'Baja laboral',
]

const LABEL_MAP: Record<AccionPsicologo, string> = {
  'Agendar cita':          'Confirmar cita',
  'Bloquear agenda':       'Bloquear agenda',
  'Desbloquear agenda':    'Desbloquear agenda',
  'Modificar bloqueo personal':     'Modificar bloqueo personal',
  'Cambiar cita':          'Cambiar cita',
  'Cancelar cita':         'Cancelar cita',
  'Añadir nuevo paciente': 'Añadir paciente',
  'Asuntos propios':       'Confirmar asuntos propios',
  'Vacaciones':            'Confirmar vacaciones',
  'Baja laboral':          'Confirmar baja laboral',
}

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

function formatTime(val: string): string | null {
  if (!val) return null
  return val.length === 5 ? val + ':00' : val
}

function generarIniciales(nombre: string): string {
  const trimmed = nombre.trim()
  if (!trimmed) return ''
  const words = trimmed.split(/\s+/)
  const initials = words.map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 4) || 'XX'
  const firstName = words[0] || ''
  return `${initials} (${firstName})`
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

  // Bloqueo fields
  const [fechaInicio, setFechaInicio] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoBloqueo>('Dias')
  const [duracion, setDuracion] = useState('')

  // Modificar bloqueo: nuevas fechas de inicio/fin
  const [modFechaInicio, setModFechaInicio] = useState('')
  const [modFechaFin, setModFechaFin] = useState('')

  // Nuevo paciente fields
  const [npNombre, setNpNombre] = useState('')
  const [npTelefono, setNpTelefono] = useState('')
  const [npEmail, setNpEmail] = useState('')
  const [npEdad, setNpEdad] = useState('')
  const [npEsMenor, setNpEsMenor] = useState(false)
  const [npEsRecomendado, setNpEsRecomendado] = useState(false)
  // Tutores (paciente menor)
  const [npT1Nombre, setNpT1Nombre] = useState('')
  const [npT1Telefono, setNpT1Telefono] = useState('')
  const [npT1Mail, setNpT1Mail] = useState('')
  const [npT2Nombre, setNpT2Nombre] = useState('')
  const [npT2Telefono, setNpT2Telefono] = useState('')
  const [npT2Mail, setNpT2Mail] = useState('')
  const [npSoloUnTutor, setNpSoloUnTutor] = useState(false)
  const [npOtros, setNpOtros] = useState('')

  // Event selector (Cambiar/Cancelar cita, Desbloquear agenda)
  const [citasActivas, setCitasActivas] = useState<EventoActivo[]>([])
  const [bloqueosActivos, setBloqueosActivos] = useState<EventoActivo[]>([])
  const [eventoSeleccionadoId, setEventoSeleccionadoId] = useState('')
  const [loadingEventos, setLoadingEventos] = useState(false)

  // Logged-in identity (to fix the form to a psychologist and stamp who acted)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const esPsicologo = perfil?.rol === 'psicologo'

  // For a psychologist the centro/psicólogo are fixed to their own profile.
  // Use the profile as the source of truth so a successful action (which resets
  // the form) or a slow auto-fill can never leave the next submit without them.
  const effCentroId    = esPsicologo ? (perfil?.centro_id ?? centroId) : centroId
  const effPsicologoId = esPsicologo ? (perfil?.psicologo_id ?? psicologoId) : psicologoId

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

  const psicologoSeleccionado = filteredPsicologos.find((p) => p.id === psicologoId) ?? null

  const isCitaAction = accion !== '' && ACCIONES_CITA.includes(accion as AccionPsicologo)
  const isBloqueoAction = accion !== '' && ACCIONES_BLOQUEO.includes(accion as AccionPsicologo)
  const isCambiarCita = accion === 'Cambiar cita'
  const isNuevoPaciente = accion === 'Añadir nuevo paciente'

  // Actions that act on an existing event → need the event selector
  const requiereSelectorCita = accion === 'Cancelar cita' || accion === 'Cambiar cita'
  const esModificarBloqueo = accion === 'Modificar bloqueo personal'
  const requiereSelectorBloqueo = accion === 'Desbloquear agenda' || esModificarBloqueo
  const eventoActual = [...citasActivas, ...bloqueosActivos].find((e) => e.id === eventoSeleccionadoId)

  // Load logged-in identity
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    getPerfilActual().then(setPerfil)
  }, [])

  // Psychologist user: lock the form to their own centro + psychologist record.
  useEffect(() => {
    if (esPsicologo && perfil?.centro_id) setCentroId(perfil.centro_id)
  }, [esPsicologo, perfil])

  useEffect(() => {
    if (
      esPsicologo &&
      perfil?.psicologo_id &&
      filteredPsicologos.some((p) => p.id === perfil.psicologo_id) &&
      psicologoId !== perfil.psicologo_id
    ) {
      setPsicologoId(perfil.psicologo_id)
    }
  }, [esPsicologo, perfil, filteredPsicologos, psicologoId])

  // Load active appointments of the selected patient (for Cancelar/Cambiar cita)
  useEffect(() => {
    setEventoSeleccionadoId('')
    if (!requiereSelectorCita || !psicologoId || !pacienteIniciales) {
      setCitasActivas([])
      return
    }
    const pacienteId = pacientes.find((p) => p.iniciales === pacienteIniciales)?.id
    if (!pacienteId) {
      setCitasActivas([])
      return
    }
    let cancelled = false
    setLoadingEventos(true)
    fetchCitasActivas({ tabla: 'acciones_psicologos', psicologoId, pacienteId })
      .then((eventos) => { if (!cancelled) setCitasActivas(eventos) })
      .catch(() => { if (!cancelled) setCitasActivas([]) })
      .finally(() => { if (!cancelled) setLoadingEventos(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psicologoId, accion, pacienteIniciales])

  // Load active blocks of the selected psychologist (for Desbloquear agenda)
  useEffect(() => {
    setEventoSeleccionadoId('')
    if (!requiereSelectorBloqueo || !psicologoId) {
      setBloqueosActivos([])
      return
    }
    let cancelled = false
    setLoadingEventos(true)
    // Desbloquear → bloqueos genéricos (Otros/null); Modificar → vacaciones/asuntos/baja
    fetchBloqueosActivos({
      tabla: 'acciones_psicologos',
      psicologoId,
      categoria: esModificarBloqueo ? 'modificar' : 'desbloquear',
    })
      .then((eventos) => { if (!cancelled) setBloqueosActivos(eventos) })
      .catch(() => { if (!cancelled) setBloqueosActivos([]) })
      .finally(() => { if (!cancelled) setLoadingEventos(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psicologoId, accion])

  function resetForm() {
    // A psychologist's centro + psicólogo are locked to their profile and the
    // auto-fill effects don't re-run on reset — so keep them (and their patient
    // list) instead of clearing, or the next action submits with empty fields.
    if (esPsicologo) {
      setCentroId(perfil?.centro_id ?? '')
      setPsicologoId(perfil?.psicologo_id ?? '')
    } else {
      setCentroId('')
      setPsicologoId('')
      setPacientes([])
    }
    setAccion('')
    setPacienteIniciales('')
    setFecha('')
    setHora('')
    setFechaInicio('')
    setHoraInicio('')
    setPeriodo('Dias')
    setDuracion('')
    setModFechaInicio('')
    setModFechaFin('')
    setCitasActivas([])
    setBloqueosActivos([])
    setEventoSeleccionadoId('')
    setNpNombre('')
    setNpTelefono('')
    setNpEmail('')
    setNpEdad('')
    setNpEsMenor(false)
    setNpEsRecomendado(false)
    setNpT1Nombre('')
    setNpT1Telefono('')
    setNpT1Mail('')
    setNpT2Nombre('')
    setNpT2Telefono('')
    setNpT2Mail('')
    setNpSoloUnTutor(false)
    setNpOtros('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!effCentroId || !effPsicologoId || !accion) {
      setError('Por favor, completa los campos obligatorios.')
      return
    }
    if (isCitaAction && !pacienteIniciales) {
      setError('Debes seleccionar un paciente para esta acción.')
      return
    }
    if (isNuevoPaciente && (!npNombre.trim() || !npTelefono.trim())) {
      setError('El nombre y el teléfono son obligatorios.')
      return
    }
    if ((requiereSelectorCita || requiereSelectorBloqueo) && !eventoSeleccionadoId) {
      setError('Debes seleccionar el evento sobre el que actuar.')
      return
    }
    if (esModificarBloqueo && !modFechaInicio && !modFechaFin) {
      setError('Indica al menos una fecha nueva (inicio o fin) para modificar el bloqueo.')
      return
    }

    setLoading(true)
    try {
      const centroNombre    = centros.find((c) => c.id === effCentroId)?.nombre ?? ''
      const psicologoNombre =
        (filteredPsicologos.find((p) => p.id === effPsicologoId) ??
          psicologos.find((p) => p.id === effPsicologoId))?.nombre ?? ''

      // ── AÑADIR NUEVO PACIENTE ─────────────────────────────────────────────
      if (isNuevoPaciente) {
        // 1) Duplicate check — does this telefono already belong to a patient?
        const telefonoNorm = npTelefono.trim()
        const { data: existentes } = await supabase
          .from('pacientes')
          .select('id, nombre, iniciales, psicologo_id')
          .eq('telefono', telefonoNorm)

        if (existentes && existentes.length > 0) {
          const dup = existentes[0]
          // Same psicólogo: friendly notice, no agent alert.
          if (dup.psicologo_id === effPsicologoId) {
            setError(
              `Este paciente ya está añadido en tu lista: ${dup.nombre} (${dup.iniciales}).`
            )
            return
          }
          // Different psicólogo: alert agentes via Make and block the insert.
          const psicologoActual = psicologos.find((p) => p.id === dup.psicologo_id)
          await fetch('/api/webhook/psicologos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mensaje: 'Paciente duplicado',
              responseId: 'web_' + Date.now(),
              timestampFormulario: new Date().toISOString(),
              datosProcesados: {
                accion: 'Paciente duplicado',
                psicologo_solicitante_nombre: psicologoNombre,
                psicologo_solicitante_id: effPsicologoId,
                paciente_existente_nombre: dup.nombre,
                paciente_existente_iniciales: dup.iniciales,
                paciente_existente_id: dup.id,
                psicologo_actual_id: dup.psicologo_id,
                psicologo_actual_nombre: psicologoActual?.nombre ?? null,
                telefono: telefonoNorm,
                nombre_intentado: npNombre.trim(),
                es_paciente_recomendado: npEsRecomendado,
              },
              respuestasFormulario: {
                'Selecciona tu centro': centroNombre,
                '¿Qué necesitas hoy?': 'Añadir nuevo paciente',
              },
            }),
          })
          setError(
            `Este paciente ya existe en la base de datos asignado a otro psicólogo. ` +
            `Hemos avisado al equipo para que lo revisen.`
          )
          return
        }

        // 2) No duplicate — proceed with the standard insert + Make notification.
        const iniciales = generarIniciales(npNombre)
        const { error: supaError } = await supabase.from('pacientes').insert({
          nombre:              npNombre.trim(),
          iniciales,
          telefono:            telefonoNorm,
          email:               npEmail.trim() || null,
          edad:                npEdad ? parseInt(npEdad, 10) : null,
          es_menor:            npEsMenor,
          centro_id:           effCentroId,
          psicologo_id:        effPsicologoId,
          recomendado_por:     npEsRecomendado ? effPsicologoId : null,
          estado:              'Nuevo paciente',
          fecha_incorporacion: new Date().toISOString().split('T')[0],
        })
        if (supaError) throw new Error('Error al añadir paciente: ' + supaError.message)

        await fetch('/api/webhook/psicologos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mensaje:             'Formulario Web Psicólogos',
            responseId:          'web_' + Date.now(),
            timestampFormulario: new Date().toISOString(),
            datosProcesados: {
              psicologo_nombre: psicologoNombre,
              accion:           'Añadir nuevo paciente',
              paciente_nombre:  npNombre.trim(),
              paciente_iniciales: iniciales,
              telefono:         npTelefono.trim(),
              email:            npEmail.trim() || null,
              edad:             npEdad ? parseInt(npEdad, 10) : null,
              es_menor:         npEsMenor,
              es_paciente_recomendado: npEsRecomendado,
              recomendado_por:  npEsRecomendado ? effPsicologoId : null,
            },
            respuestasFormulario: {
              'Selecciona tu centro': centroNombre,
              '¿Qué necesitas hoy?':  'Añadir nuevo paciente',
            },
          }),
        })

        setSuccess(true)
        resetForm()
        return
      }

      // ── CITAS / BLOQUEOS — send to Make webhook ───────────────────────────
      // Block-creation actions still collect a manual start date; modify/cancel
      // actions identify the event via gcal_event_id from the selector instead.
      const isBloqueoCreacion =
        isBloqueoAction && accion !== 'Desbloquear agenda' && accion !== 'Modificar bloqueo personal'
      const origen = perfil?.rol ?? 'agente'
      const quienNombre = perfil?.nombre ?? psicologoNombre

      const datosProcesados = {
        psicologo_nombre:     psicologoNombre,
        accion,
        paciente_iniciales:   isCitaAction ? pacienteIniciales : null,
        fecha_cita:           isCitaAction ? fecha || null : null,
        hora_cita:            isCitaAction ? formatTime(hora) : null,
        // Exact event to act on (Cambiar/Cancelar cita, Desbloquear/Modificar bloqueo).
        // Make uses this gcal_event_id instead of searching by date.
        gcal_event_id:        (requiereSelectorCita || requiereSelectorBloqueo) ? eventoActual?.gcalEventId ?? null : null,
        accion_id:            (requiereSelectorCita || requiereSelectorBloqueo) ? eventoActual?.id ?? null : null,
        // Modificar bloqueo: new start/end dates for the selected block
        nueva_fecha_inicio:   esModificarBloqueo ? modFechaInicio || null : null,
        nueva_fecha_fin:      esModificarBloqueo ? modFechaFin || null : null,
        // Block-creation actions: start + period/duration
        fecha_inicio_bloqueo: isBloqueoCreacion ? fechaInicio || null : null,
        hora_inicio_bloqueo:  isBloqueoCreacion ? formatTime(horaInicio) : null,
        periodo:              isBloqueoCreacion ? periodo : null,
        duracion:             isBloqueoCreacion && duracion ? parseInt(duracion, 10) : null,
        // Who performed the action (from login)
        created_by:           quienNombre,
        created_by_id:        userId,
        origen,
      }

      const payload = {
        mensaje:              'Formulario Web Psicólogos',
        responseId:           'web_' + Date.now(),
        timestampFormulario:  new Date().toISOString(),
        datosProcesados,
        respuestasFormulario: {
          'Selecciona tu centro': centroNombre,
          '¿Qué necesitas hoy?':  accion,
        },
      }

      const webhookRes = await fetch('/api/webhook/psicologos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!webhookRes.ok) throw new Error('Error en webhook: ' + webhookRes.status)

      // Form-submission log (matches citas-psicologos behavior).
      // The canonical action record (acciones_psicologos) is written by Make.
      await supabase.from('formulario_citas_psicologos').insert({
        centro:          centroNombre,
        psicologo:       psicologoNombre,
        accion,
        fecha_inicio:    datosProcesados.fecha_inicio_bloqueo,
        hora_inicio:     datosProcesados.hora_inicio_bloqueo,
        periodo:         datosProcesados.periodo,
        duracion:        datosProcesados.duracion,
        fecha_cita:      datosProcesados.fecha_cita,
        hora_cita:       datosProcesados.hora_cita,
        response_id:     payload.responseId,
        timestamp_envio: payload.timestampFormulario,
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
    <>
      <style>{`
        .layout-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }
        @media (min-width: 1024px) {
          .layout-wrapper {
            flex-direction: row;
            align-items: flex-start;
          }
          .form-card {
            flex: 0 0 500px;
          }
          .calendar-panel {
            flex: 1;
            min-width: 0;
          }
        }
      `}</style>
    <div style={{ padding: '36px 40px', maxWidth: 1320 }}>
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
          Gestiona citas, bloqueos y altas de pacientes
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

      {/* Form + Calendar wrapper */}
      <div className="layout-wrapper">

      {/* Form card */}
      <div
        className="form-card"
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '36px 40px',
          boxShadow: '6px 6px 30px rgba(0,0,0,0.10)',
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Centro + Psicólogo — hidden for a psychologist (form fixed to them) */}
          {esPsicologo ? (
            <div
              style={{
                background: '#eef2fb',
                borderLeft: `4px solid ${BRAND_BLUE}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 13.5,
                color: '#3a4a6b',
              }}
            >
              Estás gestionando tu propia agenda como{' '}
              <strong>{filteredPsicologos.find((p) => p.id === psicologoId)?.nombre ?? perfil?.nombre}</strong>.
            </div>
          ) : (
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
          )}

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1.5px solid #eef0f5', margin: '4px 0 20px' }} />

          {/* Acción */}
          <FormField label="¿Qué necesitas hoy?" required>
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value as AccionPsicologo)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              disabled={!psicologoId}
              required
            >
              <option value="">
                {psicologoId ? 'Selecciona una acción' : 'Primero selecciona psicólogo'}
              </option>
              {ACCIONES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </FormField>

          {/* NUEVO PACIENTE FIELDS */}
          {isNuevoPaciente && (
            <div>
              <SectionTitle>Datos del nuevo paciente</SectionTitle>
              <InfoBox>
                El paciente quedará asignado a{' '}
                <strong>{filteredPsicologos.find((p) => p.id === psicologoId)?.nombre}</strong>{' '}
                con estado <strong>Nuevo paciente</strong>.
              </InfoBox>

              <FormField label="Nombre completo" required>
                <input
                  type="text"
                  value={npNombre}
                  onChange={(e) => setNpNombre(e.target.value)}
                  placeholder="Ej. María García López"
                  style={inputStyle}
                  required
                />
              </FormField>

              <FormField label="Teléfono" required>
                <input
                  type="tel"
                  value={npTelefono}
                  onChange={(e) => setNpTelefono(e.target.value)}
                  placeholder="Ej. 612 345 678"
                  style={inputStyle}
                  required
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={npEmail}
                  onChange={(e) => setNpEmail(e.target.value)}
                  placeholder="Ej. maria@email.com"
                  style={inputStyle}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Edad">
                  <input
                    type="number"
                    value={npEdad}
                    onChange={(e) => {
                      setNpEdad(e.target.value)
                      setNpEsMenor(parseInt(e.target.value, 10) < 18)
                    }}
                    placeholder="Ej. 34"
                    min={0}
                    max={120}
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="¿Es menor de edad?">
                  <select
                    value={npEsMenor ? 'si' : 'no'}
                    onChange={(e) => setNpEsMenor(e.target.value === 'si')}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </FormField>
              </div>

              {npNombre.trim() && (
                <div style={{ fontSize: 12, color: '#888', marginTop: -8, marginBottom: 16 }}>
                  Iniciales generadas automáticamente:{' '}
                  <strong style={{ color: BRAND_BLUE }}>{generarIniciales(npNombre)}</strong>
                </div>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${npEsRecomendado ? BRAND_BLUE : '#dde1ea'}`,
                  background: npEsRecomendado ? '#eef2fb' : '#fafbfc',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 0.12s, border 0.12s',
                  fontSize: 14,
                  color: '#272626',
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  checked={npEsRecomendado}
                  onChange={(e) => setNpEsRecomendado(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: BRAND_BLUE, cursor: 'pointer' }}
                />
                <span>
                  Nueva recomendación{' '}
                  <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>
                    — el paciente queda recomendado por este psicólogo
                  </span>
                </span>
              </label>
            </div>
          )}

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

              {/* Event selector: pick the existing appointment to change/cancel */}
              {requiereSelectorCita && (
                <FormField label={isCambiarCita ? 'Cita a cambiar' : 'Cita a cancelar'} required>
                  <EventoSelect
                    eventos={citasActivas}
                    value={eventoSeleccionadoId}
                    onChange={setEventoSeleccionadoId}
                    loading={loadingEventos}
                    emptyText="Sin citas activas para este paciente"
                    placeholder="Selecciona la cita"
                    disabled={!pacienteIniciales}
                    inputStyle={inputStyle}
                    required
                  />
                </FormField>
              )}

              {/* New date/time — only for scheduling or changing an appointment */}
              {(accion === 'Agendar cita' || isCambiarCita) && (
                <>
                  {isCambiarCita && <InfoBox>Nueva fecha y hora:</InfoBox>}
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
                </>
              )}
            </div>
          )}

          {/* BLOQUEO FIELDS */}
          {isBloqueoAction && (
            <div>
              <SectionTitle>
                {accion === 'Desbloquear agenda' ? 'Desbloquear agenda' : accion}
              </SectionTitle>

              {/* Desbloquear: pick the existing generic block to remove */}
              {accion === 'Desbloquear agenda' && (
                <FormField label="Bloqueo a eliminar" required>
                  <EventoSelect
                    eventos={bloqueosActivos}
                    value={eventoSeleccionadoId}
                    onChange={setEventoSeleccionadoId}
                    loading={loadingEventos}
                    emptyText="Sin bloqueos activos para este psicólogo"
                    placeholder="Selecciona el bloqueo"
                    inputStyle={inputStyle}
                    required
                  />
                </FormField>
              )}

              {/* Modificar bloqueo: pick a vacaciones/baja/asuntos block + new dates */}
              {esModificarBloqueo && (
                <>
                  <FormField label="Bloqueo a modificar" required>
                    <EventoSelect
                      eventos={bloqueosActivos}
                      value={eventoSeleccionadoId}
                      onChange={setEventoSeleccionadoId}
                      loading={loadingEventos}
                      emptyText="Sin vacaciones, baja o asuntos propios activos"
                      placeholder="Selecciona el bloqueo"
                      inputStyle={inputStyle}
                      required
                    />
                  </FormField>
                  <InfoBox>
                    Cambia solo lo que necesites. <strong>Lo que dejes vacío se mantiene como está.</strong>
                  </InfoBox>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <FormField label="Nueva fecha de inicio">
                      <input
                        type="date"
                        value={modFechaInicio}
                        onChange={(e) => setModFechaInicio(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Nueva fecha de fin">
                      <input
                        type="date"
                        value={modFechaFin}
                        onChange={(e) => setModFechaFin(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>
                </>
              )}

              {/* Block-creation actions: manual start + period/duration */}
              {!requiereSelectorBloqueo && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <FormField label="Fecha de inicio">
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Hora inicio (opcional)">
                      <input
                        type="time"
                        value={horaInicio}
                        onChange={(e) => setHoraInicio(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

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
                </>
              )}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: 28 }}>
            {(() => {
              const submitDisabled =
                loading || !accion ||
                ((requiereSelectorCita || requiereSelectorBloqueo) && !eventoSeleccionadoId)
              return (
                <button
                  type="submit"
                  disabled={submitDisabled}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: submitDisabled ? '#a0b0cc' : BRAND_BLUE,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 30,
                    fontSize: 15,
                    fontWeight: 400,
                    cursor: submitDisabled ? 'not-allowed' : 'pointer',
                    fontFamily: "'Varela Round', sans-serif",
                    transition: 'background 0.2s, box-shadow 0.2s',
                    boxShadow: submitDisabled ? 'none' : `0 4px 14px rgba(47,90,174,0.30)`,
                    letterSpacing: '0.3px',
                  }}
                >
                  {loading ? 'Enviando…' : accion ? LABEL_MAP[accion] : 'Selecciona una acción'}
                </button>
              )
            })()}
          </div>
        </form>
      </div>

      {/* Google Calendar embed */}
      {psicologoSeleccionado?.calendar_id && (
        <div className="calendar-panel" style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '6px 6px 30px rgba(0,0,0,0.10)',
          padding: '24px', width: '100%',
        }}>
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: BRAND_BLUE,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            marginBottom: 16,
          }}>
            Calendario — {psicologoSeleccionado.nombre}
          </div>
          <iframe
            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(psicologoSeleccionado.calendar_id)}&ctz=Europe%2FMadrid&mode=WEEK&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0&hl=es`}
            style={{ width: '100%', height: 600, border: 0, borderRadius: 8, display: 'block' }}
            scrolling="no"
          />
        </div>
      )}

      </div>{/* end layout-wrapper */}
    </div>
    </>
  )
}
