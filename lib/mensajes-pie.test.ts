import { describe, it, expect } from 'vitest'
import { conPie, llevaPie, pieMensaje } from './mensajes-pie'

describe('conPie', () => {
  it('añade el pie separado por línea en blanco', () => {
    expect(conPie('Hola Ana', 'X')).toBe('Hola Ana\n\nMensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: X')
  })
  it('no lo duplica y respeta espacios finales', () => {
    const una = conPie('Hola  \n', 'X')
    expect(conPie(una, 'X')).toBe(una)
    expect(una.startsWith('Hola\n\n')).toBe(true)
  })
  it('mensaje vacío → solo el pie', () => {
    expect(conPie('', 'X')).toBe(pieMensaje('X'))
  })
})

describe('llevaPie', () => {
  it('los mensajes a pacientes llevan pie', () => {
    for (const t of ['mensaje_espera', 'mensaje_dudoso', 'mensaje_sin_disponibilidad', 'solicitar_resena', 'mensaje_libre'])
      expect(llevaPie(t)).toBe(true)
  })
  it('el aviso al psicólogo no lo lleva', () => {
    expect(llevaPie('notificar_psicologo')).toBe(false)
  })
})
