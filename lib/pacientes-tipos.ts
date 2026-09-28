// lib/pacientes-tipos.ts
// Lógica pura del modelo "paciente con varios psicólogos por tipo" (migración 014).
// Sin acceso a datos: las pantallas consultan Supabase y llaman a estas funciones.
import type { TipoCita } from '@/types/database'

export type TipoConsulta = TipoCita
export type ColumnaPsicologo = 'psicologo_adultos_id' | 'psicologo_pareja_id' | 'psicologo_infantil_id'

export const TIPOS_CONSULTA: TipoConsulta[] = ['adulto', 'pareja', 'menor']

export const COLUMNA_PSICOLOGO: Record<TipoConsulta, ColumnaPsicologo> = {
  adulto: 'psicologo_adultos_id',
  pareja: 'psicologo_pareja_id',
  menor: 'psicologo_infantil_id',
}

export const ETIQUETA_TIPO: Record<TipoConsulta, string> = {
  adulto: 'Adultos',
  pareja: 'Pareja',
  menor: 'Infantil',
}

/** minúsculas, sin tildes, espacios colapsados: "  Ana  BELÉN " → "ana belen" */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Cadena para `.or(...)` de Supabase: pacientes atendidos por ese psicólogo en cualquier tipo. */
export function filtroPacientesDePsicologo(psicologoId: string): string {
  return TIPOS_CONSULTA.map((t) => `${COLUMNA_PSICOLOGO[t]}.eq.${psicologoId}`).join(',')
}

export type PacienteTipos = Record<ColumnaPsicologo, string | null>

export function tiposDePaciente(p: PacienteTipos, psicologoId: string): TipoConsulta[] {
  return TIPOS_CONSULTA.filter((t) => p[COLUMNA_PSICOLOGO[t]] === psicologoId)
}

/**
 * Tipos que puede elegir el usuario: los del psicólogo, acotados por la edad del
 * paciente. Sin tipos configurados (ficha antigua o vacía) se ofrecen los tres.
 */
export function tiposDisponibles(
  psicologo: { tipos_consulta: TipoConsulta[] } | null,
  esMenor: boolean | null,
): TipoConsulta[] {
  const propios = psicologo?.tipos_consulta?.length ? psicologo.tipos_consulta : TIPOS_CONSULTA
  if (esMenor === true) return propios.includes('menor') ? ['menor'] : []
  if (esMenor === false) return propios.filter((t) => t !== 'menor')
  return [...propios]
}

export type PacienteExistente = PacienteTipos & {
  id: string
  nombre: string
  telefono: string | null
  fecha_nacimiento: string | null
}

export type NuevoPaciente = {
  nombre: string
  telefono: string
  fechaNacimiento: string
  esMenor: boolean
  tipoConsulta: TipoConsulta
  psicologoId: string
}

export type DecisionDuplicado =
  | { tipo: 'ninguno' }
  | { tipo: 'bloquear'; paciente: PacienteExistente; motivo: 'menor_mismo_nombre_fecha' | 'mismo_telefono_y_nombre' | 'ya_en_tu_lista' }
  | { tipo: 'confirmar'; paciente: PacienteExistente; fuerza: 'suave' | 'fuerte'; columnaOcupadaPor: string | null }

/**
 * Decide qué hacer antes de crear un paciente (reglas de la especificación §5).
 * `existentes` son los candidatos que la pantalla ya ha consultado: por teléfono
 * (adultos) o por fecha de nacimiento (menores).
 */
export function evaluarDuplicado(nuevo: NuevoPaciente, existentes: PacienteExistente[]): DecisionDuplicado {
  const nombreNuevo = normalizarNombre(nuevo.nombre)

  if (nuevo.esMenor) {
    const igual = existentes.find(
      (p) => p.fecha_nacimiento === nuevo.fechaNacimiento && normalizarNombre(p.nombre) === nombreNuevo,
    )
    return igual ? { tipo: 'bloquear', paciente: igual, motivo: 'menor_mismo_nombre_fecha' } : { tipo: 'ninguno' }
  }

  const telefono = nuevo.telefono.trim()
  const mismoTelefono = telefono ? existentes.filter((p) => (p.telefono ?? '').trim() === telefono) : []
  if (mismoTelefono.length === 0) return { tipo: 'ninguno' }

  const mismoNombre = mismoTelefono.find((p) => normalizarNombre(p.nombre) === nombreNuevo)
  if (mismoNombre) return { tipo: 'bloquear', paciente: mismoNombre, motivo: 'mismo_telefono_y_nombre' }

  const candidato = mismoTelefono[0]
  const columna = COLUMNA_PSICOLOGO[nuevo.tipoConsulta]
  const ocupadaPor = candidato[columna]
  if (ocupadaPor === nuevo.psicologoId) return { tipo: 'bloquear', paciente: candidato, motivo: 'ya_en_tu_lista' }
  return {
    tipo: 'confirmar',
    paciente: candidato,
    fuerza: nuevo.tipoConsulta === 'pareja' ? 'suave' : 'fuerte',
    columnaOcupadaPor: ocupadaPor ?? null,
  }
}
