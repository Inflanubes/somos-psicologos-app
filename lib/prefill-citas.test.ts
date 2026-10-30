import { describe, it, expect } from 'vitest'
import { faseTrasFijarAccion } from './prefill-citas'

describe('faseTrasFijarAccion (relleno de "Cambiar cita" desde el calendario)', () => {
  it('si la acción y el paciente ya estaban elegidos, las citas no se vuelven a cargar: salta a comprobar', () => {
    expect(faseTrasFijarAccion({ accionActual: 'Cambiar cita', pacienteActual: 'p', pacientePrefill: 'p' })).toBe(4)
  })
  it('si cambia la acción o el paciente, hay que esperar a la carga nueva', () => {
    expect(faseTrasFijarAccion({ accionActual: '', pacienteActual: 'p', pacientePrefill: 'p' })).toBe(3)
    expect(faseTrasFijarAccion({ accionActual: 'Cambiar cita', pacienteActual: 'q', pacientePrefill: 'p' })).toBe(3)
  })
})
