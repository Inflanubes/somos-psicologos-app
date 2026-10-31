// Desplegable "¿Qué necesitas hoy?" de Citas (B6, tarea 34).
// Cinco opciones fijas; los bloqueos van en un submenú "Tipo de bloqueo" que
// solo ven agentes y psicólogos con puede_bloquear. Cada tipo se traduce a la
// acción de siempre, que es la que viaja a Make y se guarda.

import { ACCIONES_SOLICITUD_ACTIVAS, esAccionSolicitud, type AccionSolicitud, type Rol } from './call-center'
import { esGestor } from './roles'

export type AccionPsicologo =
  | 'Agendar cita'
  | 'Cancelar cita'
  | 'Cambiar cita'
  | 'Bloquear agenda'
  | 'Desbloquear agenda'
  | 'Modificar bloqueo personal'
  | 'Añadir nuevo paciente'
  | 'Asuntos propios'
  | 'Vacaciones'
  | 'Baja médica'
  // Solicitudes al equipo (B3): 'Otro' | 'Sin disponibilidad' | 'hablar con psicologo' | 'Cambio solicitado'.
  | AccionSolicitud

export const ACCION_BLOQUEOS = 'Bloquear / Desbloquear agenda'

const ACCIONES_BASE: AccionPsicologo[] = ['Agendar cita', 'Añadir nuevo paciente', 'Cambiar cita', 'Cancelar cita']

export const TIPOS_BLOQUEO: { etiqueta: string; accion: AccionPsicologo; requierePermiso: boolean }[] = [
  { etiqueta: 'Vacaciones',           accion: 'Vacaciones',                 requierePermiso: false },
  { etiqueta: 'Asuntos propios',      accion: 'Asuntos propios',            requierePermiso: false },
  { etiqueta: 'Baja médica',          accion: 'Baja médica',                requierePermiso: false },
  { etiqueta: 'Modificar un bloqueo', accion: 'Modificar bloqueo personal', requierePermiso: false },
  { etiqueta: 'Bloqueo general',      accion: 'Bloquear agenda',            requierePermiso: true },
  { etiqueta: 'Desbloquear',          accion: 'Desbloquear agenda',         requierePermiso: true },
]

/**
 * Tipos de bloqueo que puede usar cada rol. Decisión de Sonia (27-10): un
 * psicólogo sin permiso no ve ningún bloqueo (se los pone un agente); el call
 * center tampoco. Una ficha antigua con puede_bloquear = null cuenta como false.
 */
export function tiposBloqueoDisponibles(rol: Rol, puedeBloquear: boolean | null): typeof TIPOS_BLOQUEO {
  if (esGestor(rol)) return TIPOS_BLOQUEO
  if (rol === 'psicologo' && (puedeBloquear ?? false)) return TIPOS_BLOQUEO
  return []
}

/** Opciones del primer desplegable, en orden. */
export function accionesMenu(
  rol: Rol,
  opts: { puedeBloquear: boolean | null; psicologoInactivo: boolean },
): string[] {
  // Un psicólogo desactivado gestiona su agenda pero no se da de alta pacientes nuevos.
  const base = ACCIONES_BASE.filter(
    (a) => !(a === 'Añadir nuevo paciente' && rol === 'psicologo' && opts.psicologoInactivo),
  )
  const menu: string[] = [...base]
  if (tiposBloqueoDisponibles(rol, opts.puedeBloquear).length > 0) menu.push(ACCION_BLOQUEOS)
  // Solicitudes al equipo (B3): call center y agentes; las activas se configuran en lib/call-center.ts.
  if (rol !== 'psicologo') menu.push(...ACCIONES_SOLICITUD_ACTIVAS)
  return menu
}

/** La acción que usa el formulario y se envía a Make. '' si falta elegir. */
export function accionReal(menu: string, tipoBloqueo: string): AccionPsicologo | '' {
  if (menu === ACCION_BLOQUEOS) {
    return TIPOS_BLOQUEO.find((t) => t.etiqueta === tipoBloqueo)?.accion ?? ''
  }
  if ((ACCIONES_BASE as string[]).includes(menu) || esAccionSolicitud(menu)) return menu as AccionPsicologo
  return ''
}
