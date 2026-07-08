// Selección de centro activo para psicólogos que trabajan en varios centros.
// Cada centro tiene su propia fila en `psicologos` (mismo email), así que elegir
// centro equivale a elegir la fila de psicólogo con la que opera el formulario.
// Se guarda por usuario en localStorage para sobrevivir recargas sin re-login.

export type CentroActivo = {
  psicologoId: string
  centroId: string
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
