// lib/eliminar-usuario.test.ts
import { describe, it, expect } from 'vitest'
import { pacientesSinOtroPsicologo, textoConfirmEliminar, textoBloqueoEliminar, AVISO_HISTORICO } from './eliminar-usuario'

const pac = (id: string, a: string | null, p: string | null, i: string | null) =>
  ({ id, nombre: id.toUpperCase(), psicologo_adultos_id: a, psicologo_pareja_id: p, psicologo_infantil_id: i })

describe('pacientesSinOtroPsicologo', () => {
  it('bloquean los pacientes que solo tienen a este psicólogo, aunque esté en dos columnas', () => {
    const r = pacientesSinOtroPsicologo([
      pac('solo', 'X', null, null),
      pac('dos-columnas', 'X', 'X', null),
      pac('con-otro', 'X', 'Y', null),
      pac('ajeno', 'Y', null, null),
    ], 'X')
    expect(r.map((p) => p.id)).toEqual(['solo', 'dos-columnas'])
  })
})

describe('textoConfirmEliminar', () => {
  it('psicólogo: el aviso de Jaime y las citas futuras que siguen en su Google Calendar', () => {
    const t = textoConfirmEliminar('psicologo', 'Marta', { citasFuturas: 3 })
    expect(t).toContain('Marta')
    expect(t).toContain(AVISO_HISTORICO)
    expect(t).toContain('3 citas futuras')
    expect(t).toContain('Google Calendar')
  })
  it('psicólogo sin citas futuras: sin la frase del calendario', () => {
    expect(textoConfirmEliminar('psicologo', 'Marta', { citasFuturas: 0 })).not.toContain('Google Calendar')
  })
  it('una sola cita futura en singular', () => {
    expect(textoConfirmEliminar('psicologo', 'Marta', { citasFuturas: 1 })).toContain('1 cita futura ')
  })
  it('agente: se conserva lo que registró', () => {
    const t = textoConfirmEliminar('agente', 'Luis', { citasFuturas: 0 })
    expect(t).toContain('¿Estás seguro de que quieres eliminar este usuario?')
    expect(t).not.toContain(AVISO_HISTORICO)
    expect(t).toContain('se conservan')
  })
})

describe('textoBloqueoEliminar', () => {
  it('lista los pacientes que hay que reasignar', () => {
    const t = textoBloqueoEliminar('Marta', [{ nombre: 'Ana' }, { nombre: 'Luis' }])
    expect(t).toContain('Ana, Luis')
    expect(t).toContain('Pacientes')
  })
})
