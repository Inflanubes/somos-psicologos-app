export const ESTADOS_PACIENTE = [
  'Nuevo paciente',
  'Agendado',
  'Anulado',
  'Sin disponibilidad',
  'En espera',
  'Cambio solicitado',
  'Dudoso',
  'Dudoso contactado',
  'Revisar recomendado',
  'Psicólogo sin disponibilidad',
  'Psicólogo',
  'Inactivo',
] as const

export type EstadoPaciente = typeof ESTADOS_PACIENTE[number]

export type Rol = 'agente' | 'psicologo' | 'call_center'

export type Perfil = {
  id: string
  nombre: string
  rol: Rol
  psicologo_id: string | null
  centro_id: string | null
  creado_en: string | null
}

export type Centro = {
  id: string
  nombre: string
  creado_en: string
  google_review_url: string | null
}

export type Psicologo = {
  id: string
  nombre: string
  centro_id: string
  activo: boolean
  telefono: string | null
  centro: string | null
  calendar_id: string | null
  email: string | null
  puede_bloquear: boolean | null
  /** true = admite citas a y media. Botón "30'" en Usuarios. Migración 012. */
  citas_media_hora: boolean | null
}

export type PsicologoInsert = {
  nombre: string
  email?: string | null
  telefono?: string | null
  centro_id?: string | null
  centro?: string | null
  calendar_id?: string | null
  activo?: boolean
  puede_bloquear?: boolean | null
  citas_media_hora?: boolean | null
}

export type Agente = {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  centro_id: string | null
  creado_en: string
  email: string | null
  auth_user_id: string | null
}

export type Paciente = {
  id: string
  nombre: string
  telefono: string
  email: string
  edad: number
  fecha_nacimiento: string | null
  es_menor: boolean
  consentimiento: boolean | null
  centro_id: string
  psicologo_id: string
  estado: EstadoPaciente
  fecha_cita: string | null
  hora_cita: string | null
  fecha_incorporacion: string | null
  fecha_cambio_estado: string | null
  iniciales: string | null
  gcal_event_id: string | null
  created_by: string | null
  created_by_id: string | null
  origen: string | null
}

export type AccionCallCenter = {
  id: string
  paciente_id: string
  accion: string
  agente_nombre: string
  centro_id: string
  psicologo_id: string
  fecha_cita: string
  hora_cita: string
  comentario: string
  created_by: string | null
  created_by_id: string | null
  origen: string | null
}

export type MotivoBloqueo = 'Asuntos propios' | 'Vacaciones' | 'Baja laboral' | 'Otros'

export type TipoCita = 'adulto' | 'pareja' | 'menor'

export type AccionPsicologo = {
  id: string
  psicologo_id: string | null
  paciente_id: string | null
  accion: string
  fecha_bloqueo_inicio: string | null
  fecha_bloqueo_fin: string | null
  motivo_bloqueo: MotivoBloqueo | null
  fecha_cita: string | null
  hora_cita: string | null
  tipo_cita: TipoCita | null
  comentario: string | null
  creado_en: string | null
  marca_temporal: string | null
  gcal_event_id: string | null
  created_by: string | null
  created_by_id: string | null
  origen: string | null
  es_paciente_recomendado: boolean | null
  recomendado_por: string | null
  activo: boolean | null
  /** Quién hizo la última acción sobre la fila (cancelar/cambiar/desbloquear). Lo rellena Make. */
  ultima_accion_por_id: string | null
  ultima_accion_por: string | null
  ultima_accion_en: string | null
}

/**
 * Historial de acciones (migración 011). Una fila por acción realizada:
 * 'Agendar cita' | 'Cambiar cita' | 'Cancelar cita' | 'Bloquear agenda' |
 * 'Desbloquear agenda' | 'Modificar bloqueo personal'.
 * Se rellena sola por trigger desde acciones_psicologos; es la fuente de las estadísticas.
 */
export type AccionHistorial = {
  id: string
  accion_id: string | null
  accion: string
  psicologo_id: string | null
  paciente_id: string | null
  gcal_event_id: string | null
  tipo_cita: TipoCita | null
  fecha_cita: string | null
  hora_cita: string | null
  fecha_cita_anterior: string | null
  hora_cita_anterior: string | null
  fecha_bloqueo_inicio: string | null
  fecha_bloqueo_fin: string | null
  fecha_bloqueo_inicio_anterior: string | null
  fecha_bloqueo_fin_anterior: string | null
  motivo_bloqueo: MotivoBloqueo | null
  realizado_por_id: string | null
  realizado_por: string | null
  origen: string | null
  creado_en: string
}

export type AccionHistorialInsert = Omit<AccionHistorial, 'id' | 'creado_en'>

export type HistorialEstado = {
  id: string
  paciente_id: string
  estado_anterior: EstadoPaciente
  estado_nuevo: EstadoPaciente
  fecha_cambio: string
  origen: string
  comentario: string
}

export type PacienteInsert = {
  nombre: string
  telefono: string
  email?: string | null
  edad?: number | null
  fecha_nacimiento?: string | null
  es_menor?: boolean | null
  centro_id: string
  psicologo_id?: string | null
  estado: EstadoPaciente
  fecha_cita?: string | null
  hora_cita?: string | null
  fecha_incorporacion?: string | null
  fecha_cambio_estado?: string | null
  iniciales?: string | null
  recomendado_por?: string | null
  created_by?: string | null
  created_by_id?: string | null
  origen?: string | null
}

export type FormularioCitasPsicologosInsert = {
  centro?: string | null
  psicologo?: string | null
  accion?: string | null
  fecha_inicio?: string | null
  hora_inicio?: string | null
  periodo?: string | null
  duracion?: number | null
  fecha_cita?: string | null
  hora_cita?: string | null
  tipo_cita?: string | null
  response_id?: string | null
  timestamp_envio?: string | null
}

export type AccionCallCenterInsert = {
  paciente_id: string
  accion: string
  agente_nombre?: string | null
  centro_id?: string | null
  psicologo_id?: string | null
  fecha_cita?: string | null
  hora_cita?: string | null
  comentario?: string | null
  created_by?: string | null
  created_by_id?: string | null
  origen?: string | null
  marca_temporal?: string | null
}

export type AccionPsicologoInsert = {
  psicologo_id: string
  paciente_id?: string | null
  accion: string
  fecha_bloqueo_inicio?: string | null
  fecha_bloqueo_fin?: string | null
  fecha_cita?: string | null
  hora_cita?: string | null
  tipo_cita?: TipoCita | null
  created_by?: string | null
  created_by_id?: string | null
  origen?: string | null
  marca_temporal?: string | null
}

export type HistorialEstadoInsert = {
  paciente_id: string
  estado_anterior: EstadoPaciente
  estado_nuevo: EstadoPaciente
  fecha_cambio?: string | null
  origen?: string | null
  comentario?: string | null
}

export type AsociadoMenor = {
  id: number
  created_at: string
  id_menor: string
  T1_nombre_completo: string | null
  'T1_teléfono': string | null
  T1_mail: string | null
  T1_consentimiento: boolean | null
  T2_nombre_completo: string | null
  'T2_teléfono': string | null
  T2_mail: string | null
  T2_consentimiento: boolean | null
  Otros: string | null
}

export type AsociadoMenorInsert = {
  id_menor: string
  T1_nombre_completo?: string | null
  'T1_teléfono'?: string | null
  T1_mail?: string | null
  T1_consentimiento?: boolean | null
  T2_nombre_completo?: string | null
  'T2_teléfono'?: string | null
  T2_mail?: string | null
  T2_consentimiento?: boolean | null
  Otros?: string | null
}

/**
 * Tramo semanal de trabajo de una ficha de psicólogo (migración 012).
 * dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM:SS' tal como las devuelve Postgres.
 */
export type HorarioPsicologo = {
  id: string
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  creado_en: string
}

export type HorarioPsicologoInsert = {
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export type Database = {
  public: {
    Tables: {
      centros: {
        Row: Centro
        Insert: Omit<Centro, 'id' | 'creado_en'>
        Update: Partial<Omit<Centro, 'id'>>
        Relationships: []
      }
      psicologos: {
        Row: Psicologo
        Insert: PsicologoInsert
        Update: Partial<PsicologoInsert>
        Relationships: []
      }
      pacientes: {
        Row: Paciente
        Insert: PacienteInsert
        Update: Partial<PacienteInsert>
        Relationships: []
      }
      acciones_call_center: {
        Row: AccionCallCenter
        Insert: AccionCallCenterInsert
        Update: Partial<AccionCallCenterInsert>
        Relationships: []
      }
      acciones_psicologos: {
        Row: AccionPsicologo
        Insert: AccionPsicologoInsert
        Update: Partial<AccionPsicologoInsert>
        Relationships: []
      }
      acciones_historial: {
        Row: AccionHistorial
        Insert: AccionHistorialInsert
        Update: Partial<AccionHistorialInsert>
        Relationships: []
      }
      historial_estados: {
        Row: HistorialEstado
        Insert: HistorialEstadoInsert
        Update: Partial<HistorialEstadoInsert>
        Relationships: []
      }
      formulario_citas_psicologos: {
        Row: FormularioCitasPsicologosInsert & { id: number; created_at: string }
        Insert: FormularioCitasPsicologosInsert
        Update: Partial<FormularioCitasPsicologosInsert>
        Relationships: []
      }
      agentes: {
        Row: Agente
        Insert: Omit<Agente, 'id' | 'creado_en'>
        Update: Partial<Omit<Agente, 'id' | 'creado_en'>>
        Relationships: []
      }
      perfiles: {
        Row: Perfil
        Insert: Omit<Perfil, 'creado_en'>
        Update: Partial<Omit<Perfil, 'id'>>
        Relationships: []
      }
      asociados_menores: {
        Row: AsociadoMenor
        Insert: AsociadoMenorInsert
        Update: Partial<AsociadoMenorInsert>
        Relationships: []
      }
      horarios_psicologos: {
        Row: HorarioPsicologo
        Insert: HorarioPsicologoInsert
        Update: Partial<HorarioPsicologoInsert>
        Relationships: []
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
  }
}
