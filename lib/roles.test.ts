import { describe, it, expect } from 'vitest'
import { esGestor, rutaPermitida, HOME_POR_ROL } from './roles'

describe('esGestor', () => {
  it('agente, inspección y sin perfil son gestores', () => {
    expect(esGestor('agente')).toBe(true)
    expect(esGestor('inspeccion')).toBe(true)
    expect(esGestor(null)).toBe(true)
    expect(esGestor('psicologo')).toBe(false)
    expect(esGestor('call_center')).toBe(false)
  })
})

describe('rutaPermitida', () => {
  it('inspección entra en todo menos en los dos paneles', () => {
    expect(rutaPermitida('inspeccion', '/dashboard/calendario')).toBe(true)
    expect(rutaPermitida('inspeccion', '/dashboard/usuarios')).toBe(true)
    expect(rutaPermitida('inspeccion', '/dashboard/psicologos')).toBe(true)
    expect(rutaPermitida('inspeccion', '/dashboard')).toBe(false)
    expect(rutaPermitida('inspeccion', '/dashboard/psicologos/stats')).toBe(false)
    expect(HOME_POR_ROL.inspeccion).toBe('/dashboard/calendario')
  })
  it('conserva las reglas actuales de psicólogo y call center', () => {
    expect(rutaPermitida('psicologo', '/dashboard/mensajes-psicologo')).toBe(true)
    expect(rutaPermitida('psicologo', '/dashboard/calendario')).toBe(false)
    expect(rutaPermitida('call_center', '/dashboard')).toBe(true)
    expect(rutaPermitida('call_center', '/dashboard/usuarios')).toBe(false)
    expect(rutaPermitida('agente', '/dashboard/psicologos/stats')).toBe(true)
  })
})
