import { describe, it, expect } from 'vitest'
import { validarPeticion, admiteTipo } from './disponibilidad-servidor'

const C = '11111111-1111-1111-1111-111111111111'
const P = '22222222-2222-2222-2222-222222222222'

describe('validarPeticion', () => {
  it('acepta las tres formas', () => {
    expect(validarPeticion({ tipo: 'centro', centro_id: C })).toEqual({ req: { tipo: 'centro', centro_id: C, fecha_deseada: undefined, tipo_consulta: undefined } })
    expect(validarPeticion({ tipo: 'psicologo', centro_id: C, psicologo_id: P, fecha_deseada: '2026-10-27', tipo_consulta: 'adulto' }))
      .toEqual({ req: { tipo: 'psicologo', centro_id: C, psicologo_id: P, fecha_deseada: '2026-10-27', tipo_consulta: 'adulto' } })
    expect(validarPeticion({ tipo: 'comprobar', centro_id: C, psicologo_id: P, fecha: '2026-10-27', hora: '10:15', excluir_accion_id: '' }))
      .toEqual({ req: { tipo: 'comprobar', centro_id: C, psicologo_id: P, fecha: '2026-10-27', hora: '10:15', excluir_accion_id: undefined } })
  })
  it('rechaza tipo desconocido, UUID mal y hora mal', () => {
    expect(validarPeticion({ tipo: 'otro', centro_id: C })).toEqual({ error: 'tipo debe ser psicologo, centro o comprobar' })
    expect(validarPeticion({ tipo: 'centro', centro_id: 'abc' })).toEqual({ error: 'centro_id obligatorio' })
    expect(validarPeticion({ tipo: 'psicologo', centro_id: C, psicologo_id: 'x' })).toEqual({ error: 'psicologo_id obligatorio' })
    expect(validarPeticion({ tipo: 'comprobar', centro_id: C, psicologo_id: P, fecha: '2026-10-27', hora: 'x' })).toEqual({ error: 'hora obligatoria (HH:MM)' })
    expect(validarPeticion({ tipo: 'centro', centro_id: C, tipo_consulta: 'perro' })).toEqual({ error: 'tipo_consulta no válido' })
  })
  it('rechaza fechas con formato válido pero inexistentes (no debe acabar en 500)', () => {
    expect(validarPeticion({ tipo: 'centro', centro_id: C, fecha_deseada: '2026-13-05' })).toEqual({ error: 'fecha_deseada no es una fecha real (YYYY-MM-DD)' })
    expect(validarPeticion({ tipo: 'centro', centro_id: C, fecha_deseada: '2026-02-30' })).toEqual({ error: 'fecha_deseada no es una fecha real (YYYY-MM-DD)' })
    expect(validarPeticion({ tipo: 'comprobar', centro_id: C, psicologo_id: P, fecha: '2026-11-31', hora: '10:00' })).toEqual({ error: 'fecha no es una fecha real (YYYY-MM-DD)' })
    expect(validarPeticion({ tipo: 'centro', centro_id: C, fecha_deseada: '2028-02-29' })).toHaveProperty('req')
  })
})

describe('admiteTipo', () => {
  it('sin filtro o con lista vacía (sin configurar) vale todo; con lista, solo los incluidos', () => {
    expect(admiteTipo(['adulto'], undefined)).toBe(true)
    expect(admiteTipo([], 'pareja')).toBe(true)
    expect(admiteTipo(['adulto'], 'pareja')).toBe(false)
    expect(admiteTipo(['adulto', 'pareja'], 'pareja')).toBe(true)
  })
})
