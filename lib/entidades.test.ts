// lib/entidades.test.ts
import { describe, it, expect } from 'vitest'
import { agruparParejas, agruparMenores, estadoEntidad, coincideBusqueda } from './entidades'

type P = Parameters<typeof agruparParejas>[0][number]
const p = (id: string, extra: Partial<P> = {}): P => ({
  id, nombre: id.toUpperCase(), telefono: '600' + id, es_menor: false,
  consentimiento: false, psicologo_pareja_id: null, pareja_de: null, ...extra,
})

describe('agruparParejas', () => {
  it('dos fichas enlazadas son una pareja, aunque el enlace solo esté en una', () => {
    const r = agruparParejas([p('a', { pareja_de: 'b', psicologo_pareja_id: 'X' }), p('b', { psicologo_pareja_id: 'X' })])
    expect(r).toHaveLength(1)
    expect(r[0].personas.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('el enlace en los dos sentidos no duplica la pareja', () => {
    const r = agruparParejas([p('a', { pareja_de: 'b' }), p('b', { pareja_de: 'a' })])
    expect(r).toHaveLength(1)
  })
  it('una ficha con psicólogo de pareja y sin enlace sale sola (falta la segunda persona)', () => {
    const r = agruparParejas([p('a', { psicologo_pareja_id: 'X' }), p('c')])
    expect(r).toHaveLength(1)
    expect(r[0].personas.map((x) => x.id)).toEqual(['a'])
  })
  it('un enlace a una ficha que no está en la lista deja a la persona sola', () => {
    const r = agruparParejas([p('a', { pareja_de: 'zz' })])
    expect(r[0].personas.map((x) => x.id)).toEqual(['a'])
  })
  it('los adultos sin pareja no salen', () => {
    expect(agruparParejas([p('a'), p('b')])).toEqual([])
  })
})

describe('agruparMenores', () => {
  const tut = { T1_nombre_completo: 'Padre', 'T1_teléfono': '611', T1_consentimiento: true, T1_paciente_id: null,
    T2_nombre_completo: 'Madre', 'T2_teléfono': '622', T2_consentimiento: null, T2_paciente_id: 't2' }
  it('cada menor con sus tutores y el consentimiento de cada uno', () => {
    const r = agruparMenores([p('m', { es_menor: true }), p('a')], [{ id_menor: 'm', ...tut }])
    expect(r).toHaveLength(1)
    expect(r[0].menor.id).toBe('m')
    expect(r[0].tutores).toEqual([
      { cual: 'T1', nombre: 'Padre', telefono: '611', firmado: true, paciente_id: null },
      { cual: 'T2', nombre: 'Madre', telefono: '622', firmado: false, paciente_id: 't2' },
    ])
  })
  it('sin segundo tutor solo sale el primero', () => {
    const r = agruparMenores([p('m', { es_menor: true })], [{ id_menor: 'm', ...tut, T2_nombre_completo: '  ', 'T2_teléfono': null }])
    expect(r[0].tutores.map((t) => t.cual)).toEqual(['T1'])
  })
  it('un menor sin fila de tutores sale con la lista vacía', () => {
    expect(agruparMenores([p('m', { es_menor: true })], [])[0].tutores).toEqual([])
  })
})

describe('estadoEntidad', () => {
  it('completo solo si firman todos', () => {
    expect(estadoEntidad([true, true])).toBe('completo')
    expect(estadoEntidad([true, false])).toBe('parcial')
    expect(estadoEntidad([false, false])).toBe('pendiente')
    expect(estadoEntidad([])).toBe('pendiente')
  })
})

describe('coincideBusqueda', () => {
  it('busca en nombre y teléfono, sin distinguir mayúsculas', () => {
    expect(coincideBusqueda([{ nombre: 'Ana Pérez', telefono: '600' }], 'ana')).toBe(true)
    expect(coincideBusqueda([{ nombre: 'Ana', telefono: '600 111' }], '600')).toBe(true)
    expect(coincideBusqueda([{ nombre: 'Ana', telefono: null }], 'luis')).toBe(false)
    expect(coincideBusqueda([{ nombre: 'Ana', telefono: null }], '  ')).toBe(true)
  })
})
