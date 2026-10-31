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
  /** true = centro de videollamada; su franja de horario puede coincidir con una presencial (migración 016). */
  es_online: boolean
}

export type Psicologo = {
  id: string
  nombre: string
  activo: boolean
  telefono: string | null
  calendar_id: string | null
  email: string | null
  puede_bloquear: boolean | null
  /** true = admite citas a y media. Botón "30'" en Usuarios. Migración 012. */
  citas_media_hora: boolean | null
  /** Tipos de consulta que pasa (migración 014). Mismos valores que TipoCita. */
  tipos_consulta: TipoCita[]
}

/**
 * Fila de psicologos_centros (migración 014): un psicólogo trabaja en N centros.
 * activo (migración 016): false = no recibe citas nuevas en ese centro; cambiar y cancelar siguen permitidos.
 */
export type PsicologoCentro = { psicologo_id: string; centro_id: string; activo: boolean }

/** Fila de la vista psicologos_por_centro: una por psicólogo × centro. */
export type PsicologoPorCentro = Psicologo & {
  centro_id: string
  centro: string
  /** psicologos_centros.activo (migración 016). */
  centro_activo: boolean
  /** centros.es_online (migración 016). */
  es_online: boolean
}

export type PsicologoInsert = {
  nombre: string
  email?: string | null
  telefono?: string | null
  calendar_id?: string | null
  activo?: boolean
  puede_bloquear?: boolean | null
  citas_media_hora?: boolean | null
  tipos_consulta?: TipoCita[]
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
  DNI: string | null
  centro_id: string
  /** Psicólogos por tipo de consulta (migración 014). Al menos uno relleno. */
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
  estado: EstadoPaciente
  fecha_cita: string | null
  hora_cita: string | null
  fecha_incorporacion: string | null
  fecha_cambio_estado: string | null
  iniciales: string | null
  gcal_event_id: string | null
  /** Psicólogo que recomendó al paciente ("Nueva recomendación" en el alta); null si no la hay. */
  recomendado_por: string | null
  created_by: string | null
  created_by_id: string | null
  origen: string | null
  /** Operador del call center que dio de alta al paciente (migración 017). */
  operador: string | null
  /** Consentimiento marcado a mano (migración 018): origen, quién y cuándo. Null = llegó por formulario. */
  consentimiento_origen: 'formulario' | 'manual' | null
  consentimiento_marcado_por: string | null
  consentimiento_marcado_en: string | null
  /** La otra persona de la pareja (migración 018). */
  pareja_de: string | null
  /** Quién pidió la cita por esta persona (migración 019, Dante): su ficha si era paciente y el chat. */
  solicitante_id: string | null
  solicitante_chat: string | null
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
  /** Centro donde se atiende la cita (migración 014). Bloqueos: null. */
  centro_id: string | null
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
  /** Operador del call center que hizo la acción (migración 017; lo mapea Make). */
  operador: string | null
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
  /** Centro de la cita (migración 014); lo copia el trigger de historial. */
  centro_id: string | null
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
  /** Copia de acciones_psicologos.operador (migración 017). */
  operador: string | null
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
  psicologo_adultos_id?: string | null
  psicologo_pareja_id?: string | null
  psicologo_infantil_id?: string | null
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
  operador?: string | null
  consentimiento?: boolean | null
  consentimiento_origen?: 'formulario' | 'manual' | null
  consentimiento_marcado_por?: string | null
  consentimiento_marcado_en?: string | null
  pareja_de?: string | null
  solicitante_id?: string | null
  solicitante_chat?: string | null
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
  centro_id?: string | null
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
  T1_dni: string | null
  T2_dni: string | null
  /** Tutor que ya es paciente (migración 014). */
  T1_paciente_id: string | null
  T2_paciente_id: string | null
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
  T1_dni?: string | null
  T2_dni?: string | null
  T1_paciente_id?: string | null
  T2_paciente_id?: string | null
  Otros?: string | null
}

/**
 * Tramo semanal de trabajo de un psicólogo en un centro (migraciones 012 y 016).
 * dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM:SS' tal como las devuelve Postgres.
 * revisar: true si la migración 016 asignó el centro automáticamente; el guardado desde Psicólogos lo pone a false.
 */
export type HorarioPsicologo = {
  id: string
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  centro_id: string
  revisar: boolean
  creado_en: string
}

export type HorarioPsicologoInsert = {
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  centro_id: string
  revisar?: boolean
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
      psicologos_centros: {
        Row: PsicologoCentro
        Insert: Omit<PsicologoCentro, 'activo'> & { activo?: boolean }
        Update: Partial<PsicologoCentro>
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
    Views: {
      psicologos_por_centro: {
        Row: PsicologoPorCentro
        Relationships: []
      }
    }
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
  }
}
