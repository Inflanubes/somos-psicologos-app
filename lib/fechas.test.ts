import { describe, it, expect } from 'vitest'
import { ahoraMadrid, sumarMinutos, ANTELACION_MIN } from './fechas'

describe('ahoraMadrid', () => {
  it('convierte un instante UTC a fecha y minutos de Madrid (verano, +2)', () => {
    expect(ahoraMadrid(new Date('2026-07-01T22:30:00Z'))).toEqual({ fecha: '2026-07-02', minutos: 30 })
  })
  it('invierno, +1', () => {
    expect(ahoraMadrid(new Date('2026-12-01T10:05:00Z'))).toEqual({ fecha: '2026-12-01', minutos: 665 })
  })
})

describe('sumarMinutos', () => {
  it('suma dentro del día', () => {
    expect(sumarMinutos({ fecha: '2026-10-26', minutos: 600 }, ANTELACION_MIN)).toEqual({ fecha: '2026-10-26', minutos: 720 })
  })
  it('no pasa de medianoche', () => {
    expect(sumarMinutos({ fecha: '2026-10-26', minutos: 1400 }, 120)).toEqual({ fecha: '2026-10-26', minutos: 1439 })
  })
})
