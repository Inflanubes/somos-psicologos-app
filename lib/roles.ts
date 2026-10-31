import type { Rol } from '@/types/database'

export const ROLES: readonly Rol[] = ['agente', 'psicologo', 'call_center', 'inspeccion']

export const ETIQUETA_ROL: Record<Rol, string> = {
  agente: 'Agente',
  psicologo: 'Psicólogo',
  call_center: 'Call center',
  inspeccion: 'Inspección',
}

/**
 * Gestor = puede hacer lo que un agente (modo dios). Inspección es una copia del
 * agente sin los dos paneles de estadísticas. Sin fila en `perfiles` se trata
 * como agente, para no romper los logins heredados.
 */
export function esGestor(rol: Rol | null | undefined): boolean {
  return rol == null || rol === 'agente' || rol === 'inspeccion'
}

export const HOME_POR_ROL: Record<Rol, string> = {
  agente: '/dashboard',
  psicologo: '/dashboard/psicologos',
  // El call center entra por el calendario (disponibilidad de todos los psicólogos).
  call_center: '/dashboard/calendario',
  inspeccion: '/dashboard/calendario',
}

/** Rutas de Resumen de pacientes y Actividad de citas, vetadas a inspección. */
function esPanelEstadisticas(path: string): boolean {
  return path === '/dashboard' || path === '/dashboard/psicologos/stats' || path.startsWith('/dashboard/psicologos/stats/')
}

export function rutaPermitida(rol: Rol, path: string): boolean {
  if (rol === 'agente') return true
  if (rol === 'inspeccion') return !esPanelEstadisticas(path)
  // Psicólogo: su formulario de citas, la lista de sus pacientes y su página
  // de mensajes (ambas filtran ya por el psicólogo logueado).
  if (rol === 'psicologo')
    return (
      path === '/dashboard/psicologos' ||
      path === '/dashboard/pacientes' ||
      path === '/dashboard/mensajes-psicologo'
    )
  // Call center: calendario, panel personal y formulario de citas.
  if (rol === 'call_center')
    return path === '/dashboard/calendario' || path === '/dashboard' || path === '/dashboard/psicologos'
  return false
}
