import { describe, it, expect } from 'vitest'
import { aMinutos, aHora, normalizarHora, validarTramos, resumenHorario, type Tramo } from './horarios'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })

describe('aMinutos / aHora / normalizarHora', () => {
  it('acepta HH:MM y HH:MM:SS', () => {
    expect(aMinutos('09:30')).toBe(570)
    expect(aMinutos('09:30:00')).toBe(570)
  })
  it('devuelve NaN con texto que no es una hora', () => {
    expect(aMinutos('abc')).toBeNaN()
    expect(aMinutos('')).toBeNaN()
  })
  it('aHora rellena con ceros', () => {
    expect(aHora(570)).toBe('09:30')
    expect(aHora(1290)).toBe('21:30')
  })
  it('normalizarHora quita los segundos', () => {
    expect(normalizarHora('11:30:00')).toBe('11:30')
    expect(normalizarHora('11:30')).toBe('11:30')
  })
})

describe('validarTramos', () => {
  it('acepta tramos correctos en varios días', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '16:00', '20:00'), t(3, '09:00', '14:00')])).toBeNull()
  })
  it('acepta una lista vacía', () => {
    expect(validarTramos([])).toBeNull()
  })
  it('rechaza fin igual o anterior al inicio', () => {
    expect(validarTramos([t(2, '14:00', '14:00')])).toMatch(/posterior/)
    expect(validarTramos([t(2, '14:00', '09:00')])).toMatch(/Martes/)
  })
  it('rechaza solapamiento en el mismo día', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '13:00', '18:00')])).toMatch(/solapan/)
  })
  it('permite tramos contiguos', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '14:00', '16:00')])).toBeNull()
  })
  it('rechaza un día fuera de 1..7', () => {
    expect(validarTramos([t(0, '09:00', '14:00')])).toMatch(/Día/)
    expect(validarTramos([t(8, '09:00', '14:00')])).toMatch(/Día/)
  })
  it('rechaza horas no válidas', () => {
    expect(validarTramos([t(4, 'x', '14:00')])).toMatch(/Hora no válida/)
  })
})

describe('resumenHorario', () => {
  it('agrupa los días con los mismos tramos', () => {
    expect(
      resumenHorario([t(1, '09:00:00', '14:00:00'), t(3, '09:00:00', '14:00:00'), t(5, '16:00:00', '20:00:00')]),
    ).toBe('L, X 09:00–14:00 · V 16:00–20:00')
  })
  it('une varios tramos de un día con "y" y los ordena', () => {
    expect(resumenHorario([t(1, '16:00', '20:00'), t(1, '09:00', '14:00')])).toBe('L 09:00–14:00 y 16:00–20:00')
  })
  it('devuelve cadena vacía sin tramos', () => {
    expect(resumenHorario([])).toBe('')
  })
})

describe('validarTramos y resumenHorario con centros', () => {
  const C = [
    { id: 'mor', nombre: 'Moratalaz', es_online: false },
    { id: 'sb', nombre: 'San Blas', es_online: false },
    { id: 'on', nombre: 'Online', es_online: true },
  ]
  const tc = (dia: number, ini: string, fin: string, centro_id: string): Tramo => ({ dia_semana: dia, hora_inicio: ini, hora_fin: fin, centro_id })

  it('dos centros presenciales no pueden solaparse', () => {
    expect(validarTramos([tc(2, '10:00', '14:00', 'sb'), tc(2, '13:00', '17:00', 'mor')], C))
      .toBe('Los tramos del martes se solapan (San Blas 10:00–14:00 y Moratalaz 13:00–17:00).')
  })
  it('Online puede solaparse con un presencial', () => {
    expect(validarTramos([tc(1, '10:00', '14:00', 'mor'), tc(1, '10:00', '14:00', 'on')], C)).toBeNull()
  })
  it('dos franjas Online no pueden solaparse', () => {
    expect(validarTramos([tc(1, '10:00', '14:00', 'on'), tc(1, '12:00', '15:00', 'on')], C)).not.toBeNull()
  })
  it('contiguos de centros distintos se permiten', () => {
    expect(validarTramos([tc(1, '10:00', '14:00', 'mor'), tc(1, '14:00', '18:00', 'sb')], C)).toBeNull()
  })
  it('resumen agrupa por centro, centros por nombre', () => {
    expect(resumenHorario([tc(1, '10:00', '14:00', 'sb'), tc(3, '10:00', '14:00', 'sb'), tc(2, '16:00', '20:00', 'on')], C))
      .toBe('Online: M 16:00–20:00 · San Blas: L, X 10:00–14:00')
  })
})
