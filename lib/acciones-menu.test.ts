import { describe, it, expect } from 'vitest'
import { accionesMenu, tiposBloqueoDisponibles, accionReal, etiquetaOpcionMenu, ACCION_BLOQUEOS } from './acciones-menu'
import { ACCIONES_SOLICITUD_ACTIVAS } from './call-center'

const BASE = ['Agendar cita', 'Añadir nuevo paciente', 'Cambiar cita', 'Cancelar cita']
const SEIS = ['Vacaciones', 'Asuntos propios', 'Baja médica', 'Modificar un bloqueo', 'Cerrar agenda', 'Desbloquear']

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
      .toEqual([...BASE, 'hablar con psicologo', 'Cambio solicitado', 'Otro'])
  })

  it('el call center no ve Sin disponibilidad; el agente sí', () => {
    expect(accionesMenu('call_center', { puedeBloquear: null, psicologoInactivo: false })).not.toContain('Sin disponibilidad')
    expect(accionesMenu('agente', { puedeBloquear: null, psicologoInactivo: false })).toContain('Sin disponibilidad')
  })

  it('psicólogo inactivo no ve Añadir nuevo paciente; el agente sí', () => {
    expect(accionesMenu('psicologo', { puedeBloquear: true, psicologoInactivo: true })).not.toContain('Añadir nuevo paciente')
    expect(accionesMenu('agente', { puedeBloquear: null, psicologoInactivo: true })).toContain('Añadir nuevo paciente')
  })
})

describe('accionReal', () => {
  it('traduce el submenú a la acción de siempre', () => {
    expect(accionReal(ACCION_BLOQUEOS, 'Cerrar agenda')).toBe('Bloquear agenda')
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

describe('call center por supuestos (F2, tarea 11)', () => {
  const opts = { puedeBloquear: null, psicologoInactivo: false }
  it('supuesto 1 (ya tuvo cita): agendar, cambiar, cancelar, hablar, cambio de psicólogo y otros', () => {
    expect(accionesMenu('call_center', { ...opts, supuesto: 1 }))
      .toEqual(['Agendar cita', 'Cambiar cita', 'Cancelar cita', 'hablar con psicologo', 'Cambio solicitado', 'Otro'])
  })
  it('supuesto 2 (ficha sin citas): agendar, cambio de psicólogo o centro y otros', () => {
    expect(accionesMenu('call_center', { ...opts, supuesto: 2 })).toEqual(['Agendar cita', 'Cambio solicitado', 'Otro'])
    expect(etiquetaOpcionMenu('Cambio solicitado', 2)).toBe('Cambio de psicólogo o centro')
    expect(etiquetaOpcionMenu('Cambio solicitado', 1)).toBe('Cambio de psicólogo')
  })
  it('supuesto 3 (no existe): añadir paciente y otros', () => {
    expect(accionesMenu('call_center', { ...opts, supuesto: 3 })).toEqual(['Añadir nuevo paciente', 'Otro'])
  })
  it('el supuesto solo cambia el menú del call center', () => {
    expect(accionesMenu('agente', { ...opts, supuesto: 3 })).toEqual(accionesMenu('agente', opts))
  })
  it('etiquetas del resto de opciones', () => {
    expect(etiquetaOpcionMenu('Otro')).toBe('Otros (aviso al equipo)')
    expect(etiquetaOpcionMenu('Agendar cita', 1)).toBe('Agendar cita')
  })
})
