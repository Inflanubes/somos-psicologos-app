import { describe, it, expect } from 'vitest'
import { rangoDeAtajo, rangoDeParams, atajoDeRango, enRango, diasDelRango, etiquetaRango, sumarDias } from './periodo'

const HOY = '2026-10-27' // martes

describe('periodo', () => {
  it('atajos', () => {
    expect(rangoDeAtajo('hoy', HOY)).toEqual({ desde: '2026-10-27', hasta: '2026-10-27' })
    expect(rangoDeAtajo('semana', HOY)).toEqual({ desde: '2026-10-26', hasta: '2026-11-01' })
    expect(rangoDeAtajo('mes', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(rangoDeAtajo('mes_anterior', HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(rangoDeAtajo('ultimos_90', HOY)).toEqual({ desde: '2026-07-30', hasta: '2026-10-27' })
    expect(rangoDeAtajo('siempre', HOY)).toEqual({ desde: '', hasta: '' })
  })
  it('semana desde un domingo y mes anterior en enero', () => {
    expect(rangoDeAtajo('semana', '2026-11-01')).toEqual({ desde: '2026-10-26', hasta: '2026-11-01' })
    expect(rangoDeAtajo('mes_anterior', '2026-01-15')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
    expect(rangoDeAtajo('mes', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })
  it('params: fechas mandan, luego atajo, luego mes; invertidas se corrigen', () => {
    expect(rangoDeParams({ desde: '2026-10-05', hasta: '2026-10-01', periodo: 'hoy' }, HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-05' })
    expect(rangoDeParams({ periodo: 'semana' }, HOY)).toEqual(rangoDeAtajo('semana', HOY))
    expect(rangoDeParams({ desde: 'ayer' }, HOY)).toEqual(rangoDeAtajo('mes', HOY))
    expect(rangoDeParams({}, HOY)).toEqual(rangoDeAtajo('mes', HOY))
    expect(rangoDeParams({ desde: '2026-10-05' }, HOY)).toEqual({ desde: '2026-10-05', hasta: '' })
    expect(rangoDeParams({ periodo: 'siempre' }, HOY)).toEqual({ desde: '', hasta: '' })
    expect(atajoDeRango({ desde: '2026-10-01', hasta: '2026-10-31' }, HOY)).toBe('mes')
    expect(atajoDeRango({ desde: '', hasta: '' }, HOY)).toBe('siempre')
    expect(atajoDeRango({ desde: '2026-10-02', hasta: '2026-10-31' }, HOY)).toBeNull()
  })
  it('enRango y diasDelRango', () => {
    expect(enRango('2026-10-31', { desde: '2026-10-01', hasta: '2026-10-31' })).toBe(true)
    expect(enRango('2026-11-01', { desde: '2026-10-01', hasta: '2026-10-31' })).toBe(false)
    expect(enRango(null, { desde: '', hasta: '' })).toBe(false)
    expect(enRango('1999-01-01', { desde: '', hasta: '' })).toBe(true)
    expect(diasDelRango({ desde: '2026-10-30', hasta: '2026-11-01' }, { primero: '2026-01-01', ultimo: '2026-12-31' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(diasDelRango({ desde: '', hasta: '' }, { primero: '2026-10-26', ultimo: '2026-10-27' })).toHaveLength(2)
    expect(diasDelRango({ desde: '', hasta: '' }, { primero: '', ultimo: '' })).toEqual([])
  })
  it('etiquetaRango y sumarDias', () => {
    expect(etiquetaRango({ desde: '2026-10-01', hasta: '2026-10-31' })).toBe('1 oct – 31 oct 2026')
    expect(etiquetaRango({ desde: '', hasta: '' })).toBe('Desde siempre')
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01')
  })
})
