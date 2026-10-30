// Selección de centro activo para psicólogos que trabajan en varios centros.
// Desde la migración 014 un psicólogo es una sola fila; sus centros están en
// `psicologos_centros`. Se guarda el centro elegido por usuario en localStorage
// para sobrevivir recargas sin re-login (`psicologoId` es siempre el único id).
// Desde B2 la pastilla "Todos" se guarda como `centroId: 'todos'`.

/** Valor de `centroId` cuando el psicólogo elige la pastilla "Todos". */
export const TODOS_LOS_CENTROS = 'todos'

export type CentroActivo = {
  psicologoId: string
  /** Id de centro o `TODOS_LOS_CENTROS`. */
  centroId: string
}

/**
 * Centro que fija el formulario: `null` con "Todos" (el formulario pide centro),
 * `undefined` si no hay selección guardada (quien llama decide el respaldo).
 */
export function centroIdEfectivo(sel: CentroActivo | null): string | null | undefined {
  if (!sel) return undefined
  return sel.centroId === TODOS_LOS_CENTROS ? null : sel.centroId
}

const storageKey = (userId: string) => `centro-activo:${userId}`

export function getCentroActivo(userId: string): CentroActivo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CentroActivo>
    if (typeof parsed.psicologoId === 'string' && typeof parsed.centroId === 'string') {
      return { psicologoId: parsed.psicologoId, centroId: parsed.centroId }
    }
    return null
  } catch {
    return null
  }
}

export function setCentroActivo(userId: string, seleccion: CentroActivo): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(seleccion))
  } catch {
    // localStorage lleno o bloqueado: la selección vive solo en memoria.
  }
}

export function clearCentroActivo(userId: string): void {
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // sin acceso a localStorage: nada que limpiar
  }
}
