import { describe, it, expect } from 'vitest'
import { calcularLibres, bloqueosPorHora, marcarPrimeras, aplicarAccionLocal, type PsicologoAgenda } from './calendario-huecos'
import type { EventoCalendario } from './calendario'
import type { Tramo } from './horarios'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string, centro_id: string): Tramo => ({
  dia_semana, hora_inicio, hora_fin, centro_id,
})

const AHORA = { fecha: '2026-10-26', minutos: 9 * 60 } // lunes 26-10-2026 a las 09:00
const DIAS = ['2026-10-26', '2026-10-27']

const jaime = (extra: Partial<PsicologoAgenda> = {}): PsicologoAgenda => ({
  id: 'j', nombre: 'Jaime', activo: true, mediaHora: false,
  tramos: [t(1, '10:00', '12:00', 'mor'), t(1, '10:00', '12:00', 'on'), t(2, '16:00', '18:00', 'mor')],
  citas: [], bloqueos: [], ...extra,
})

const base: EventoCalendario = {
  id: 'x', tipo: 'cita', psicologoId: 'j', psicologoNombre: 'Jaime', centroId: 'mor',
  fecha: null, hora: null, tipoCita: null, iniciales: null, inicio: null, fin: null, motivo: null,
  primera: false, pacienteId: null,
}
const cita: EventoCalendario = { ...base, id: 'c0', fecha: '2026-10-26', hora: '10:00', tipoCita: 'adulto', iniciales: 'AB', pacienteId: 'p' }

describe('calcularLibres', () => {
  it('libres por día, saltando el pasado; hora libre en dos centros = un evento con centros', () => {
    const l = calcularLibres([jaime()], DIAS, AHORA, null)
    // 10:00 del lunes queda dentro de las 2 h de antelación (ahora 09:00): no es libre.
    expect(l.map((e) => `${e.fecha} ${e.hora}`)).toEqual(['2026-10-26 11:00', '2026-10-27 16:00', '2026-10-27 17:00'])
    expect(l[0].centros).toEqual(['mor', 'on'])
    expect(l[0].centroId).toBeNull()
    expect(l[1].centroId).toBe('mor')
    expect(l[1].centros).toBeUndefined()
    expect(l[0].tipo).toBe('libre')
    expect(l[0].id).toBe('libre:j:2026-10-26:11:00')
    expect(l[0].psicologoNombre).toBe('Jaime')
  })
  it('con filtro de centro solo sus franjas', () => {
    const l = calcularLibres([jaime()], DIAS, AHORA, 'on')
    expect(l.map((e) => e.fecha)).toEqual(['2026-10-26'])
    expect(l[0].centroId).toBe('on')
  })
  it('una cita a las 10:30 de un psicólogo con medias horas tapa 10:00 y 11:00', () => {
    const p = jaime({ mediaHora: true, tramos: [t(1, '10:00', '13:00', 'mor')], citas: [{ fecha: '2026-10-26', hora: '10:30:00' }] })
    expect(calcularLibres([p], ['2026-10-26'], { fecha: '2026-10-26', minutos: 0 }, 'mor').map((e) => e.hora)).toEqual(['11:30', '12:00'])
  })
  it('no calcula libres en días pasados', () => {
    expect(calcularLibres([jaime()], ['2026-10-19', '2026-10-20'], AHORA, null)).toEqual([])
  })
  it('un día bloqueado no tiene libres', () => {
    const p = jaime({ bloqueos: [{ inicio: '2026-10-27', fin: '2026-10-27' }] })
    expect(calcularLibres([p], DIAS, AHORA, null).map((e) => e.fecha)).toEqual(['2026-10-26'])
  })
})

describe('bloqueosPorHora', () => {
  it('una celda por hora dentro de las franjas', () => {
    const b: EventoCalendario = { ...base, id: 'b1', tipo: 'bloqueo', centroId: null, inicio: '2026-10-26', fin: '2026-10-27', motivo: 'Vacaciones' }
    const r = bloqueosPorHora([b], new Map([['j', jaime().tramos]]), DIAS)
    expect(r.map((e) => `${e.fecha} ${e.hora}`)).toEqual(['2026-10-26 10:00', '2026-10-26 11:00', '2026-10-27 16:00', '2026-10-27 17:00'])
    expect(r[0].id).toBe('b1:2026-10-26:10:00')
    expect(r[0].tipo).toBe('bloqueo')
    expect(r[0].motivo).toBe('Vacaciones')
  })
  it('sin franjas ese día no pinta nada; sin fin cubre los días siguientes', () => {
    const b: EventoCalendario = { ...base, id: 'b2', tipo: 'bloqueo', inicio: '2026-10-27', fin: null, motivo: null }
    const r = bloqueosPorHora([b], new Map([['j', jaime().tramos]]), ['2026-10-26', '2026-10-27', '2026-10-28'])
    expect(r.map((e) => `${e.fecha} ${e.hora}`)).toEqual(['2026-10-27 16:00', '2026-10-27 17:00'])
  })
})

describe('marcarPrimeras', () => {
  it('la cita más antigua del paciente es la primera; las siguientes no', () => {
    const c1 = { ...cita, id: 'c1', pacienteId: 'p', fecha: '2026-10-26' }
    const c2 = { ...cita, id: 'c2', pacienteId: 'p', fecha: '2026-10-28' }
    const hist = [
      { accion_id: 'c1', paciente_id: 'p', fecha_cita: '2026-10-26', creado_en: '2026-10-20T10:00:00Z' },
      { accion_id: 'c2', paciente_id: 'p', fecha_cita: '2026-10-28', creado_en: '2026-10-21T10:00:00Z' },
    ]
    const r = marcarPrimeras([c1, c2], hist)
    expect(r.find((e) => e.id === 'c1')?.primera).toBe(true)
    expect(r.find((e) => e.id === 'c2')?.primera).toBe(false)
  })
  it('sin fila propia en el histórico se compara solo por fecha', () => {
    const c1 = { ...cita, id: 'nueva', pacienteId: 'p', fecha: '2026-10-30' }
    const hist = [{ accion_id: 'vieja', paciente_id: 'p', fecha_cita: '2026-10-01', creado_en: '2026-09-20T10:00:00Z' }]
    expect(marcarPrimeras([c1], hist)[0].primera).toBe(false)
    expect(marcarPrimeras([c1], [])[0].primera).toBe(true)
  })
  it('misma fecha: gana la creada antes', () => {
    const a = { ...cita, id: 'a', pacienteId: 'p', fecha: '2026-10-26' }
    const hist = [
      { accion_id: 'a', paciente_id: 'p', fecha_cita: '2026-10-26', creado_en: '2026-10-20T12:00:00Z' },
      { accion_id: 'z', paciente_id: 'p', fecha_cita: '2026-10-26', creado_en: '2026-10-20T10:00:00Z' },
    ]
    expect(marcarPrimeras([a], hist)[0].primera).toBe(false)
  })
  it('una cita sin paciente nunca es primera', () => {
    expect(marcarPrimeras([{ ...cita, pacienteId: null }], [])[0].primera).toBe(false)
  })
})

describe('aplicarAccionLocal', () => {
  it('anular → anulada; cambiar → mueve', () => {
    const r = aplicarAccionLocal([cita], { tipo: 'anular', citaId: cita.id })
    expect(r[0].tipo).toBe('anulada')
    const m = aplicarAccionLocal([cita], { tipo: 'cambiar', citaId: cita.id, fecha: '2026-10-29', hora: '12:00', centroId: 'on' })
    expect(m[0]).toMatchObject({ fecha: '2026-10-29', hora: '12:00', centroId: 'on', tipo: 'cita' })
  })
  it('agendar añade sin mutar la entrada', () => {
    const entrada = [cita]
    const nueva = { ...cita, id: 'local:1', fecha: '2026-10-30' }
    const r = aplicarAccionLocal(entrada, { tipo: 'agendar', cita: nueva })
    expect(r).toHaveLength(2)
    expect(entrada).toHaveLength(1)
  })
})

describe('aplicarAccionLocal es idempotente (se vuelve a aplicar tras cada recarga)', () => {
  it('agendar no duplica si ya hay una cita del mismo psicólogo a esa hora', () => {
    const nueva = { ...cita, id: 'local:1' }
    const r = aplicarAccionLocal([cita], { tipo: 'agendar', cita: nueva })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('c0')
  })
  it('anular sobre una cita que ya no está no cambia nada', () => {
    const r = aplicarAccionLocal([cita], { tipo: 'anular', citaId: 'otra' })
    expect(r).toEqual([cita])
  })
})
