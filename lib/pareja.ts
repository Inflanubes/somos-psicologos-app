// lib/pareja.ts
// Segunda persona en el alta de pareja (bloque B4, tarea 40). Lógica pura;
// la pantalla de Citas consulta Supabase y llama aquí para decidir.

import { normalizarNombre } from './pacientes-tipos'

export const ERROR_SEGUNDA_INCOMPLETA = 'Indica nombre y teléfono de la segunda persona.'
export const ERROR_SEGUNDA_IGUAL = 'La segunda persona no puede ser la misma que la primera.'

export type SegundaPersona =
  | { tipo: 'ninguna' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'ok'; nombre: string; telefono: string }

/**
 * Los dos campos son opcionales, pero si viene uno el otro es obligatorio.
 * Mismo nombre y mismo teléfono que la primera persona = error (sería la misma).
 * Mismo teléfono con otro nombre vale: hay parejas que comparten móvil.
 */
export function validarSegundaPersona(
  primera: { nombre: string; telefono: string },
  segunda: { nombre: string; telefono: string },
): SegundaPersona {
  const nombre = segunda.nombre.trim()
  const telefono = segunda.telefono.trim()
  if (!nombre && !telefono) return { tipo: 'ninguna' }
  if (!nombre || !telefono) return { tipo: 'error', mensaje: ERROR_SEGUNDA_INCOMPLETA }
  if (normalizarNombre(nombre) === normalizarNombre(primera.nombre) && telefono === primera.telefono.trim()) {
    return { tipo: 'error', mensaje: ERROR_SEGUNDA_IGUAL }
  }
  return { tipo: 'ok', nombre, telefono }
}

/** Entre los adultos con ese teléfono, el que tiene el mismo nombre (normalizado). */
export function buscarSegundaPersona<T extends { id: string; nombre: string }>(nombre: string, candidatos: T[]): T | null {
  const n = normalizarNombre(nombre)
  return candidatos.find((c) => normalizarNombre(c.nombre) === n) ?? null
}

/**
 * La segunda persona ya era paciente: solo se le pone este psicólogo de pareja si
 * la columna está libre o ya es suya. Nunca se pisa a otro psicólogo de pareja
 * sin pasar por las reglas de duplicados del alta normal.
 */
export function decidirVinculoPareja(
  existente: { psicologo_pareja_id: string | null },
  psicologoId: string,
): 'vincular' | 'otro_psicologo' {
  const actual = existente.psicologo_pareja_id
  return !actual || actual === psicologoId ? 'vincular' : 'otro_psicologo'
}
