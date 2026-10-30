// lib/pareja.test.ts
import { describe, it, expect } from 'vitest'
import { validarSegundaPersona, buscarSegundaPersona } from './pareja'

const primera = { nombre: 'Ana Belén', telefono: '600111222' }

describe('validarSegundaPersona', () => {
  it('sin nombre ni teléfono no hay segunda persona', () => {
    expect(validarSegundaPersona(primera, { nombre: '', telefono: '  ' })).toEqual({ tipo: 'ninguna' })
  })
  it('si viene uno de los dos, el otro es obligatorio', () => {
    expect(validarSegundaPersona(primera, { nombre: 'Luis', telefono: '' }))
      .toEqual({ tipo: 'error', mensaje: 'Indica nombre y teléfono de la segunda persona.' })
    expect(validarSegundaPersona(primera, { nombre: '', telefono: '611' }))
      .toEqual({ tipo: 'error', mensaje: 'Indica nombre y teléfono de la segunda persona.' })
  })
  it('mismo nombre y mismo teléfono que la primera es un error', () => {
    expect(validarSegundaPersona(primera, { nombre: ' ana belen ', telefono: '600111222' }))
      .toEqual({ tipo: 'error', mensaje: 'La segunda persona no puede ser la misma que la primera.' })
  })
  it('mismo teléfono con otro nombre vale (parejas que comparten móvil)', () => {
    expect(validarSegundaPersona(primera, { nombre: ' Luis Gómez ', telefono: ' 600111222 ' }))
      .toEqual({ tipo: 'ok', nombre: 'Luis Gómez', telefono: '600111222' })
  })
})

describe('buscarSegundaPersona', () => {
  const candidatos = [
    { id: 'a', nombre: 'Ana Belén' },
    { id: 'b', nombre: 'LUIS GÓMEZ' },
  ]
  it('encuentra al adulto con el mismo nombre normalizado', () => {
    expect(buscarSegundaPersona('luis gomez', candidatos)).toEqual({ id: 'b', nombre: 'LUIS GÓMEZ' })
  })
  it('sin coincidencia de nombre devuelve null', () => {
    expect(buscarSegundaPersona('Luis García', candidatos)).toBeNull()
    expect(buscarSegundaPersona('Luis Gómez', [])).toBeNull()
  })
})
