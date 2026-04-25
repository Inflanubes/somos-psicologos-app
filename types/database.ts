export type EstadoPaciente =
  | 'Nuevo paciente'
  | 'Agendado'
  | 'Anulado'
  | 'Sin disponibilidad'
  | 'En espera'
  | 'Cambio solicitado'
  | 'Dudoso'
  | 'Dudoso contactado'
  | 'Revisar recomendado'
  | 'Psicólogo sin disponibilidad'
  | 'Psicólogo'

export type Centro = {
  id: string
  nombre: string
  creado_en: string
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
}

export type Agente = {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  centro_id: string | null
  creado_en: string
}

export type Paciente = {
  id: string
  nombre: string
  telefono: string
  email: string
  edad: number
  es_menor: boolean
  centro_id: string
  psicologo_id: string
  estado: EstadoPaciente
  fecha_cita: string | null
  hora_cita: string | null
  fecha_incorporacion: string | null
  fecha_cambio_estado: string | null
  iniciales: string | null
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
}

export type AccionPsicologo = {
  id: string
  psicologo_id: string
  paciente_id: string
  accion: string
  fecha_bloqueo_inicio: string
  fecha_bloqueo_fin: string
  fecha_cita: string
  hora_cita: string
}

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
  es_menor?: boolean | null
  centro_id: string
  psicologo_id?: string | null
  estado: EstadoPaciente
  fecha_cita?: string | null
  hora_cita?: string | null
  fecha_incorporacion?: string | null
  fecha_cambio_estado?: string | null
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
}

export type AccionPsicologoInsert = {
  psicologo_id: string
  paciente_id?: string | null
  accion: string
  fecha_bloqueo_inicio?: string | null
  fecha_bloqueo_fin?: string | null
  fecha_cita?: string | null
  hora_cita?: string | null
  created_by?: string | null
}

export type HistorialEstadoInsert = {
  paciente_id: string
  estado_anterior: EstadoPaciente
  estado_nuevo: EstadoPaciente
  fecha_cambio?: string | null
  origen?: string | null
  comentario?: string | null
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
        Insert: Omit<Psicologo, 'id'>
        Update: Partial<Omit<Psicologo, 'id'>>
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
      historial_estados: {
        Row: HistorialEstado
        Insert: HistorialEstadoInsert
        Update: Partial<HistorialEstadoInsert>
        Relationships: []
      }
      agentes: {
        Row: Agente
        Insert: Omit<Agente, 'id' | 'creado_en'>
        Update: Partial<Omit<Agente, 'id' | 'creado_en'>>
        Relationships: []
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
  }
}
