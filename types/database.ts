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

export interface Centro {
  id: string
  nombre: string
  creado_en: string
}

export interface Psicologo {
  id: string
  nombre: string
  centro_id: string
  activo: boolean
}

export interface Paciente {
  id: string
  nombre: string
  telefono: string
  email: string
  edad: number
  es_menor: boolean
  centro_id: string
  psicologo_id: string
  estado: EstadoPaciente
  fecha_cita: string
  hora_cita: string
  fecha_incorporacion: string
}

export interface AccionCallCenter {
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

export interface AccionPsicologo {
  id: string
  psicologo_id: string
  paciente_id: string
  accion: string
  fecha_bloqueo_inicio: string
  fecha_bloqueo_fin: string
  fecha_cita: string
  hora_cita: string
}

export interface Database {
  public: {
    Tables: {
      centros: {
        Row: Centro
        Insert: Omit<Centro, 'id' | 'creado_en'>
        Update: Partial<Omit<Centro, 'id'>>
      }
      psicologos: {
        Row: Psicologo
        Insert: Omit<Psicologo, 'id'>
        Update: Partial<Omit<Psicologo, 'id'>>
      }
      pacientes: {
        Row: Paciente
        Insert: Omit<Paciente, 'id'>
        Update: Partial<Omit<Paciente, 'id'>>
      }
      acciones_call_center: {
        Row: AccionCallCenter
        Insert: Omit<AccionCallCenter, 'id'>
        Update: Partial<Omit<AccionCallCenter, 'id'>>
      }
      acciones_psicologos: {
        Row: AccionPsicologo
        Insert: Omit<AccionPsicologo, 'id'>
        Update: Partial<Omit<AccionPsicologo, 'id'>>
      }
    }
  }
}
