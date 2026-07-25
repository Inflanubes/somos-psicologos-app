'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, Paciente, Perfil, TipoCita } from '@/types/database'
import EventoSelect from '@/components/EventoSelect'
import TimeSelect from '@/app/dashboard/_components/TimeSelect'
import { fetchCitasActivas, fetchBloqueosActivos, type EventoActivo } from '@/lib/eventos-activos'
import { getPerfilActual } from '@/lib/perfil'
import { getCentroActivo, setCentroActivo, clearCentroActivo, type CentroActivo } from '@/lib/centro-activo'

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
// Bloqueo general de agenda: solo para psicólogos con puede_bloquear = true
// (los agentes no tienen restricción). Vacaciones/asuntos/baja son para todos.
const ACCIONES_BLOQUEO_GENERAL: AccionPsicologo[] = ['Bloquear agenda', 'Desbloquear agenda']
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

// Para las terapias, menor = hasta 15 años; con 16+ se trata como adulto
// (sin tutores y con consentimiento propio).
const EDAD_MAXIMA_MENOR = 15

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento + 'T00:00:00')
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
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
  const [tipoCita, setTipoCita] = useState<TipoCita | ''>('')

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
  const [npFechaNacimiento, setNpFechaNacimiento] = useState('')
  const [npEsRecomendado, setNpEsRecomendado] = useState(false)
  // Edad y es_menor se derivan de la fecha de nacimiento (menor = <= 15 años).
  const npEdadCalc = npFechaNacimiento ? calcularEdad(npFechaNacimiento) : null
  const npEsMenor = npEdadCalc !== null && npEdadCalc >= 0 && npEdadCalc <= EDAD_MAXIMA_MENOR
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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const esPsicologo = perfil?.rol === 'psicologo'

  // Multi-centro: un psicólogo que trabaja en varios centros tiene una fila en
  // `psicologos` por centro (mismo email). Si hay más de una, debe elegir centro.
  const [misVariantes, setMisVariantes] = useState<Psicologo[]>([])
  const [variantesCargadas, setVariantesCargadas] = useState(false)
  const [centroActivo, setCentroActivoState] = useState<CentroActivo | null>(null)
  const esMultiCentro = esPsicologo && misVariantes.length > 1
  const necesitaElegirCentro = esMultiCentro && !centroActivo

  // For a psychologist the centro/psicólogo are fixed to their own profile (or
  // to the chosen center when they work in several). Use these as the source of
  // truth so a successful action (which resets the form) or a slow auto-fill
  // can never leave the next submit without them.
  const psiPsicologoId = centroActivo?.psicologoId ?? perfil?.psicologo_id ?? null
  const psiCentroId    = centroActivo?.centroId ?? perfil?.centro_id ?? null
  const effCentroId    = esPsicologo ? (psiCentroId ?? centroId) : centroId
  const effPsicologoId = esPsicologo ? (psiPsicologoId ?? psicologoId) : psicologoId

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
      .select('id, nombre, iniciales, psicologo_id, es_menor, consentimiento')
      .eq('psicologo_id', psicologoId)
      .not('iniciales', 'is', null)
      .order('iniciales')
      .then(({ data }) => {
        setPacientes((data ?? []) as Paciente[])
        setLoadingPacientes(false)
      })
  }, [psicologoId])

  const psicologoSeleccionado = filteredPsicologos.find((p) => p.id === psicologoId) ?? null

  // Un usuario psicólogo solo ve Bloquear/Desbloquear agenda si su ficha lo permite;
  // los agentes gestionan cualquier agenda sin restricción.
  const accionesDisponibles = ACCIONES.filter(
    (a) =>
      !ACCIONES_BLOQUEO_GENERAL.includes(a) ||
      !esPsicologo ||
      (psicologoSeleccionado?.puede_bloquear ?? false)
  )

  const isCitaAction = accion !== '' && ACCIONES_CITA.includes(accion as AccionPsicologo)
  const isBloqueoAction = accion !== '' && ACCIONES_BLOQUEO.includes(accion as AccionPsicologo)
  const isCambiarCita = accion === 'Cambiar cita'
  const isNuevoPaciente = accion === 'Añadir nuevo paciente'
  // Agendar/Cambiar piden fecha, hora y tipo de cita (adulto/pareja/menor)
  const pideTipoCita = accion === 'Agendar cita' || isCambiarCita
  const pacienteSeleccionado = pacientes.find((p) => p.iniciales === pacienteIniciales) ?? null

  // Actions that act on an existing event → need the event selector
  const requiereSelectorCita = accion === 'Cancelar cita' || accion === 'Cambiar cita'
  const esModificarBloqueo = accion === 'Modificar bloqueo personal'
  const requiereSelectorBloqueo = accion === 'Desbloquear agenda' || esModificarBloqueo
  const eventoActual = [...citasActivas, ...bloqueosActivos].find((e) => e.id === eventoSeleccionadoId)

  // Load logged-in identity
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setUserEmail(user?.email ?? null)
    })
    getPerfilActual().then(setPerfil)
  }, [])

  // Multi-centro: load every psicologos row sharing the logged-in email and
  // restore the previously chosen center (if it still exists).
  useEffect(() => {
    if (!esPsicologo || !userEmail || !userId) return
    let cancelled = false
    supabase
      .from('psicologos')
      .select('id, nombre, centro_id, centro')
      .eq('email', userEmail)
      .eq('activo', true)
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as Psicologo[]
        setMisVariantes(rows)
        const guardada = getCentroActivo(userId)
        if (guardada && rows.some((r) => r.id === guardada.psicologoId)) {
          setCentroActivoState(guardada)
        }
        setVariantesCargadas(true)
      })
    return () => { cancelled = true }
  }, [esPsicologo, userEmail, userId])

  // Pre-select the appointment type from the patient (menor → 'menor'), still
  // overridable to 'pareja' by hand. Re-runs only when the patient changes.
  useEffect(() => {
    if (!pideTipoCita || !pacienteSeleccionado) return
    setTipoCita(pacienteSeleccionado.es_menor ? 'menor' : 'adulto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteSeleccionado?.id, pideTipoCita])

  // Psychologist user: lock the form to their own centro + psychologist record
  // (the chosen center when they work in several).
  useEffect(() => {
    if (esPsicologo && psiCentroId) setCentroId(psiCentroId)
  }, [esPsicologo, psiCentroId])

  useEffect(() => {
    if (
      esPsicologo &&
      psiPsicologoId &&
      filteredPsicologos.some((p) => p.id === psiPsicologoId) &&
      psicologoId !== psiPsicologoId
    ) {
      setPsicologoId(psiPsicologoId)
    }
  }, [esPsicologo, psiPsicologoId, filteredPsicologos, psicologoId])

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
      setCentroId(psiCentroId ?? '')
      setPsicologoId(psiPsicologoId ?? '')
    } else {
      setCentroId('')
      setPsicologoId('')
      setPacientes([])
    }
    setAccion('')
    setPacienteIniciales('')
    setFecha('')
    setHora('')
    setTipoCita('')
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
    setNpFechaNacimiento('')
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
    if (
      esPsicologo &&
      ACCIONES_BLOQUEO_GENERAL.includes(accion as AccionPsicologo) &&
      !(psicologoSeleccionado?.puede_bloquear ?? false)
    ) {
      setError('No tienes permiso para usar el bloqueo general de agenda. Habla con el equipo.')
      return
    }
    if (isCitaAction && !pacienteIniciales) {
      setError('Debes seleccionar un paciente para esta acción.')
      return
    }
    if (pideTipoCita && !tipoCita) {
      setError('Selecciona el tipo de cita (adulto, pareja o menor).')
      return
    }
    if (isNuevoPaciente && (!npNombre.trim() || !npTelefono.trim())) {
      setError('El nombre y el teléfono son obligatorios.')
      return
    }
    if (isNuevoPaciente && !npFechaNacimiento) {
      setError('La fecha de nacimiento es obligatoria.')
      return
    }
    if (isNuevoPaciente && (npEdadCalc === null || npEdadCalc < 0 || npEdadCalc > 120)) {
      setError('La fecha de nacimiento no es válida.')
      return
    }
    if (isNuevoPaciente && npEsMenor) {
      if (!npT1Nombre.trim() || !npT1Telefono.trim()) {
        setError('Para un paciente menor, el nombre y el teléfono del Tutor 1 son obligatorios.')
        return
      }
      if (npSoloUnTutor) {
        if (!npOtros.trim()) {
          setError('Explica la circunstancia especial en el campo "Otros".')
          return
        }
      } else if (!npT2Nombre.trim() || !npT2Telefono.trim()) {
        setError('Indica el Tutor 2 (nombre y teléfono) o marca la casilla de circunstancia especial.')
        return
      }
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
        const { data: nuevoPaciente, error: supaError } = await supabase
          .from('pacientes')
          .insert({
            nombre:              npNombre.trim(),
            iniciales,
            telefono:            telefonoNorm,
            email:               npEmail.trim() || null,
            fecha_nacimiento:    npFechaNacimiento,
            edad:                npEdadCalc,
            es_menor:            npEsMenor,
            centro_id:           effCentroId,
            psicologo_id:        effPsicologoId,
            recomendado_por:     npEsRecomendado ? effPsicologoId : null,
            estado:              'Nuevo paciente',
            fecha_incorporacion: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single()
        if (supaError) throw new Error('Error al añadir paciente: ' + supaError.message)
        if (!nuevoPaciente) throw new Error('No se pudo recuperar el identificador del nuevo paciente. Inténtalo de nuevo.')

        // Paciente menor: guardar los datos de los tutores legales.
        if (npEsMenor) {
          const { error: menorError } = await supabase.from('asociados_menores').insert({
            id_menor:           nuevoPaciente.id,
            T1_nombre_completo: npT1Nombre.trim(),
            'T1_teléfono':      npT1Telefono.trim(),
            T1_mail:            npT1Mail.trim() || null,
            T2_nombre_completo: npSoloUnTutor ? null : npT2Nombre.trim(),
            'T2_teléfono':      npSoloUnTutor ? null : npT2Telefono.trim(),
            T2_mail:            npSoloUnTutor ? null : (npT2Mail.trim() || null),
            Otros:              npSoloUnTutor ? npOtros.trim() : null,
          })
          if (menorError) {
            throw new Error(
              'El paciente se creó, pero no se pudieron guardar los datos de los tutores: ' +
              menorError.message + '. Avisa al equipo para completarlos.'
            )
          }
        }

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
              paciente_id:      nuevoPaciente.id,
              telefono:         npTelefono.trim(),
              email:            npEmail.trim() || null,
              fecha_nacimiento: npFechaNacimiento,
              edad:             npEdadCalc,
              es_paciente_recomendado: npEsRecomendado,
              recomendado_por:  npEsRecomendado ? effPsicologoId : null,
              es_menor:         npEsMenor,
              tutor1_nombre:    npEsMenor ? npT1Nombre.trim() : null,
              tutor1_telefono:  npEsMenor ? npT1Telefono.trim() : null,
              tutor1_mail:      npEsMenor ? (npT1Mail.trim() || null) : null,
              tutor2_nombre:    npEsMenor && !npSoloUnTutor ? npT2Nombre.trim() : null,
              tutor2_telefono:  npEsMenor && !npSoloUnTutor ? npT2Telefono.trim() : null,
              tutor2_mail:      npEsMenor && !npSoloUnTutor ? (npT2Mail.trim() || null) : null,
              solo_un_tutor:    npEsMenor ? npSoloUnTutor : null,
              otros:            npEsMenor && npSoloUnTutor ? npOtros.trim() : null,
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
        tipo_cita:            pideTipoCita ? tipoCita || null : null,
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
        tipo_cita:       datosProcesados.tipo_cita,
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

  function elegirCentro(variante: Psicologo) {
    const seleccion: CentroActivo = { psicologoId: variante.id, centroId: variante.centro_id }
    setCentroActivoState(seleccion)
    if (userId) setCentroActivo(userId, seleccion)
  }

  function cambiarDeCentro() {
    setCentroActivoState(null)
    if (userId) clearCentroActivo(userId)
    setAccion('')
    setPacienteIniciales('')
    setEventoSeleccionadoId('')
  }

  function nombreCentro(variante: Psicologo): string {
    return centros.find((c) => c.id === variante.centro_id)?.nombre ?? variante.centro ?? 'Centro'
  }

  // Psicólogo multi-centro sin centro elegido: pedir el centro antes del formulario.
  // (El psicólogo nunca se elige: cada centro apunta a su propia fila de la misma persona.)
  if (necesitaElegirCentro) {
    return (
      <div className="page-pad" style={{ maxWidth: 560 }}>
        <h1
          style={{
            fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
            fontSize: 26,
            fontWeight: 600,
            color: '#272626',
            margin: '0 0 6px',
          }}
        >
          Citas
        </h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '0 0 28px' }}>
          Trabajas en más de un centro
        </p>
        <div
          className="page-pad"
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '6px 6px 30px rgba(0,0,0,0.10)',
          }}
        >
          <div style={{ ...labelStyle, marginBottom: 16 }}>¿En qué centro vas a trabajar hoy?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {misVariantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => elegirCentro(v)}
                style={{
                  padding: '16px 18px',
                  border: '1.5px solid #dde1ea',
                  borderRadius: 10,
                  background: '#fafbfc',
                  fontSize: 15,
                  fontWeight: 600,
                  color: BRAND_BLUE,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s, border 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eef2fb'
                  e.currentTarget.style.borderColor = BRAND_BLUE
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fafbfc'
                  e.currentTarget.style.borderColor = '#dde1ea'
                }}
              >
                {nombreCentro(v)}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: '#888', marginTop: 16, marginBottom: 0 }}>
            Podrás cambiar de centro en cualquier momento desde el formulario.
          </p>
        </div>
      </div>
    )
  }

  // Evitar mostrar el formulario con el centro por defecto mientras aún no
  // sabemos si el psicólogo es multi-centro.
  if (esPsicologo && !variantesCargadas) {
    return (
      <div className="page-pad" style={{ fontSize: 14, color: '#888' }}>Cargando…</div>
    )
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
    <div className="page-pad" style={{ maxWidth: 1320 }}>
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
        className="form-card page-pad"
        style={{
          background: '#ffffff',
          borderRadius: 16,
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
              <strong>{filteredPsicologos.find((p) => p.id === psicologoId)?.nombre ?? perfil?.nombre}</strong>
              {esMultiCentro && (
                <>
                  {' '}en <strong>{centros.find((c) => c.id === effCentroId)?.nombre ?? ''}</strong>
                </>
              )}
              .
              {esMultiCentro && (
                <button
                  type="button"
                  onClick={cambiarDeCentro}
                  style={{
                    marginLeft: 10,
                    padding: '3px 10px',
                    border: `1px solid ${BRAND_BLUE}`,
                    borderRadius: 16,
                    background: '#fff',
                    color: BRAND_BLUE,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cambiar de centro
                </button>
              )}
            </div>
          ) : (
          <div className="r-grid-2" style={{ gap: 16 }}>
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
              {accionesDisponibles.map((a) => (
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

              <div className="r-grid-2" style={{ gap: 16 }}>
                <FormField label="Fecha de nacimiento" required>
                  <input
                    type="date"
                    value={npFechaNacimiento}
                    onChange={(e) => setNpFechaNacimiento(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                    required
                  />
                </FormField>

                <FormField label={`¿Es menor? (hasta ${EDAD_MAXIMA_MENOR} años)`}>
                  <select
                    value={npEsMenor ? 'si' : 'no'}
                    disabled
                    style={inputStyle}
                  >
                    <option value="no">
                      {npEdadCalc !== null ? `No — ${npEdadCalc} años` : 'No'}
                    </option>
                    <option value="si">
                      {npEdadCalc !== null ? `Sí — ${npEdadCalc} años` : 'Sí'}
                    </option>
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

              {npEsMenor && (
                <div>
                  <SectionTitle>Datos de los tutores legales</SectionTitle>
                  <InfoBox>
                    Para menores se requieren dos consentimientos. Si solo hay un tutor,
                    marca la casilla de circunstancia especial y explica el motivo.
                  </InfoBox>

                  <FormField label="Tutor 1 · Nombre completo" required>
                    <input
                      type="text"
                      value={npT1Nombre}
                      onChange={(e) => setNpT1Nombre(e.target.value)}
                      placeholder="Ej. Juan García Pérez"
                      style={inputStyle}
                    />
                  </FormField>
                  <div className="r-grid-2" style={{ gap: 16 }}>
                    <FormField label="Tutor 1 · Teléfono" required>
                      <input
                        type="tel"
                        value={npT1Telefono}
                        onChange={(e) => setNpT1Telefono(e.target.value)}
                        placeholder="Ej. 612 345 678"
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Tutor 1 · Email">
                      <input
                        type="email"
                        value={npT1Mail}
                        onChange={(e) => setNpT1Mail(e.target.value)}
                        placeholder="Ej. juan@email.com"
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

                  {!npSoloUnTutor && (
                    <>
                      <FormField label="Tutor 2 · Nombre completo" required>
                        <input
                          type="text"
                          value={npT2Nombre}
                          onChange={(e) => setNpT2Nombre(e.target.value)}
                          placeholder="Ej. Ana López Ruiz"
                          style={inputStyle}
                        />
                      </FormField>
                      <div className="r-grid-2" style={{ gap: 16 }}>
                        <FormField label="Tutor 2 · Teléfono" required>
                          <input
                            type="tel"
                            value={npT2Telefono}
                            onChange={(e) => setNpT2Telefono(e.target.value)}
                            placeholder="Ej. 612 345 678"
                            style={inputStyle}
                          />
                        </FormField>
                        <FormField label="Tutor 2 · Email">
                          <input
                            type="email"
                            value={npT2Mail}
                            onChange={(e) => setNpT2Mail(e.target.value)}
                            placeholder="Ej. ana@email.com"
                            style={inputStyle}
                          />
                        </FormField>
                      </div>
                    </>
                  )}

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      border: `1.5px solid ${npSoloUnTutor ? BRAND_BLUE : '#dde1ea'}`,
                      background: npSoloUnTutor ? '#eef2fb' : '#fafbfc',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.12s, border 0.12s',
                      fontSize: 14,
                      color: '#272626',
                      fontWeight: 500,
                      marginBottom: 18,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={npSoloUnTutor}
                      onChange={(e) => setNpSoloUnTutor(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: BRAND_BLUE, cursor: 'pointer' }}
                    />
                    <span>
                      No es posible aportar un segundo tutor{' '}
                      <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>
                        — circunstancia especial (fallecimiento, adopción, divorcio…)
                      </span>
                    </span>
                  </label>

                  {npSoloUnTutor && (
                    <FormField label="Otros · Explica la circunstancia" required>
                      <textarea
                        value={npOtros}
                        onChange={(e) => setNpOtros(e.target.value)}
                        placeholder="Ej. El otro progenitor ha fallecido / adopción con tutor único / divorcio con sentencia de custodia…"
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: "'Montserrat', inherit" }}
                      />
                    </FormField>
                  )}
                </div>
              )}
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

              {/* Estado del consentimiento informado (lo actualiza Make al recibir el formulario firmado) */}
              {pacienteSeleccionado && (
                <div style={{ marginTop: -10, marginBottom: 18 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: pacienteSeleccionado.consentimiento ? '#e8f4e8' : '#fef3c7',
                      color: pacienteSeleccionado.consentimiento ? '#2a7a2a' : '#92400e',
                      border: `1px solid ${pacienteSeleccionado.consentimiento ? '#b5d9b5' : '#fde68a'}`,
                    }}
                  >
                    {pacienteSeleccionado.consentimiento
                      ? '✓ Consentimiento firmado'
                      : '⏳ Consentimiento pendiente'}
                  </span>
                </div>
              )}

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
                  <FormField label="Tipo de cita" required>
                    <select
                      value={tipoCita}
                      onChange={(e) => setTipoCita(e.target.value as TipoCita | '')}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      required
                    >
                      <option value="">Selecciona el tipo</option>
                      <option value="adulto">Adulto</option>
                      <option value="pareja">Pareja</option>
                      <option value="menor">Menor</option>
                    </select>
                  </FormField>
                  {isCambiarCita && <InfoBox>Nueva fecha y hora:</InfoBox>}
                  <div className="r-grid-2" style={{ gap: 16 }}>
                    <FormField label={isCambiarCita ? 'Nueva fecha' : 'Fecha de cita'}>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label={isCambiarCita ? 'Nueva hora' : 'Hora de cita'}>
                      <TimeSelect value={hora} onChange={setHora} style={inputStyle} />
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
                  <div className="r-grid-2" style={{ gap: 16 }}>
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
                  <div className="r-grid-2" style={{ gap: 16 }}>
                    <FormField label="Fecha de inicio">
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Hora inicio (opcional)">
                      <TimeSelect value={horaInicio} onChange={setHoraInicio} style={inputStyle} />
                    </FormField>
                  </div>

                  <div className="r-grid-2" style={{ gap: 16 }}>
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
          {/* Escritorio: vista semana */}
          <iframe
            className="cal-desktop"
            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(psicologoSeleccionado.calendar_id)}&ctz=Europe%2FMadrid&mode=WEEK&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0&hl=es`}
            style={{ width: '100%', height: 600, border: 0, borderRadius: 8 }}
            scrolling="no"
          />
          {/* Móvil: vista agenda (lista), más usable en pantalla estrecha */}
          <iframe
            className="cal-mobile"
            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(psicologoSeleccionado.calendar_id)}&ctz=Europe%2FMadrid&mode=AGENDA&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0&hl=es`}
            style={{ width: '100%', height: 520, border: 0, borderRadius: 8 }}
            scrolling="no"
          />
        </div>
      )}

      </div>{/* end layout-wrapper */}
    </div>
    </>
  )
}
