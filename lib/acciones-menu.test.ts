import { describe, it, expect } from 'vitest'
import { accionesMenu, tiposBloqueoDisponibles, accionReal, ACCION_BLOQUEOS } from './acciones-menu'
import { ACCIONES_SOLICITUD_ACTIVAS } from './call-center'

const BASE = ['Agendar cita', 'Añadir nuevo paciente', 'Cambiar cita', 'Cancelar cita']
const SEIS = ['Vacaciones', 'Asuntos propios', 'Baja médica', 'Modificar un bloqueo', 'Bloqueo general', 'Desbloquear']

describe('accionesMenu y tiposBloqueoDisponibles', () => {
  it('agente ve cinco opciones (más las solicitudes activas) y seis tipos', () => {
    expect(accionesMenu('agente', { puedeBloquear: null, psicologoInactivo: false }))
      .toEqual([...BASE, ACCION_BLOQUEOS, ...ACCIONES_SOLICITUD_ACTIVAS])
    expect(tiposBloqueoDisponibles('agente', null).map((t) => t.etiqueta)).toEqual(SEIS)
  })

  it('psicólogo sin permiso no ve bloqueos (null cuenta como false)', () => {
    expect(accionesMenu('psicologo', { puedeBloquear: null, psicologoInactivo: false })).toEqual(BASE)
    expect(accionesMenu('psicologo', { puedeBloquear: false, psicologoInactivo: false })).not.toContain(ACCION_BLOQUEOS)
    expect(tiposBloqueoDisponibles('psicologo', false)).toEqual([])
    expect(tiposBloqueoDisponibles('psicologo', null)).toEqual([])
  })

  it('psicólogo con permiso ve los seis tipos y no ve solicitudes; call center ningún bloqueo', () => {
    expect(tiposBloqueoDisponibles('psicologo', true).map((t) => t.etiqueta)).toEqual(SEIS)
    expect(accionesMenu('psicologo', { puedeBloquear: true, psicologoInactivo: false })).toEqual([...BASE, ACCION_BLOQUEOS])
    expect(tiposBloqueoDisponibles('call_center', true)).toEqual([])
    expect(accionesMenu('call_center', { puedeBloquear: true, psicologoInactivo: false }))
      .toEqual([...BASE, ...ACCIONES_SOLICITUD_ACTIVAS])
  })

  it('psicólogo inactivo no ve Añadir nuevo paciente; el agente sí', () => {
    expect(accionesMenu('psicologo', { puedeBloquear: true, psicologoInactivo: true })).not.toContain('Añadir nuevo paciente')
    expect(accionesMenu('agente', { puedeBloquear: null, psicologoInactivo: true })).toContain('Añadir nuevo paciente')
  })
})

describe('accionReal', () => {
  it('traduce el submenú a la acción de siempre', () => {
    expect(accionReal(ACCION_BLOQUEOS, 'Bloqueo general')).toBe('Bloquear agenda')
    expect(accionReal(ACCION_BLOQUEOS, 'Desbloquear')).toBe('Desbloquear agenda')
    expect(accionReal(ACCION_BLOQUEOS, 'Modificar un bloqueo')).toBe('Modificar bloqueo personal')
    expect(accionReal(ACCION_BLOQUEOS, 'Baja médica')).toBe('Baja médica')
    expect(accionReal(ACCION_BLOQUEOS, '')).toBe('')
    expect(accionReal(ACCION_BLOQUEOS, 'Inventado')).toBe('')
    expect(accionReal('Agendar cita', '')).toBe('Agendar cita')
    expect(accionReal('Otro', '')).toBe('Otro')
    expect(accionReal('', '')).toBe('')
  })
})
