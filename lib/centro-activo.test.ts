import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getCentroActivo, setCentroActivo, clearCentroActivo, centroIdEfectivo, TODOS_LOS_CENTROS } from './centro-activo'

// Sin jsdom: un localStorage mínimo en memoria sobre `window`.
beforeAll(() => {
  const datos = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v) },
    removeItem: (k: string) => { datos.delete(k) },
  }
  ;(globalThis as unknown as { window: unknown }).window = { localStorage }
})

describe('centro activo con "Todos"', () => {
  beforeEach(() => clearCentroActivo('u1'))
  it('guarda y devuelve "todos" como cualquier otro centro', () => {
    setCentroActivo('u1', { psicologoId: 'p1', centroId: TODOS_LOS_CENTROS })
    expect(getCentroActivo('u1')).toEqual({ psicologoId: 'p1', centroId: 'todos' })
  })
  it('centroIdEfectivo traduce "todos" a null y deja el resto igual', () => {
    expect(centroIdEfectivo({ psicologoId: 'p1', centroId: TODOS_LOS_CENTROS })).toBeNull()
    expect(centroIdEfectivo({ psicologoId: 'p1', centroId: 'mor' })).toBe('mor')
    expect(centroIdEfectivo(null)).toBeUndefined()
  })
})
