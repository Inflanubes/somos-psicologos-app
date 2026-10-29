import { describe, it, expect } from 'vitest'
import {
  proximosHuecos, motivoSinHuecos, elegirMasProximo, comprobarHueco, sumarDias,
  DIAS_VISTA, MAX_HUECOS, type HuecoFecha,
} from './huecos-dante'
import type { DatosDisponibilidad } from './disponibilidad-datos'
import type { Tramo } from './horarios'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })
const AHORA = { fecha: '2026-10-26', minutos: 10 * 60 } // lunes 10:00
const datos = (extra: Partial<DatosDisponibilidad> = {}): DatosDisponibilidad => ({
  tramos: [t(1, '09:00', '13:00'), t(2, '16:00', '18:00')],
  citas: [], bloqueos: [], mediaHora: false, tieneAlgunHorario: true, centroActivo: true,
  ...extra,
})

describe('sumarDias', () => {
  it('suma días sobre YYYY-MM-DD cruzando el mes', () => {
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02')
    expect(sumarDias('2026-10-26', 0)).toBe('2026-10-26')
  })
})

describe('proximosHuecos', () => {
  it('salta las horas pasadas y las de menos de 2 h; lista en orden y corta en max', () => {
    expect(proximosHuecos(datos(), AHORA, undefined, 3)).toEqual([
      { fecha: '2026-10-26', hora: '12:00' }, { fecha: '2026-10-27', hora: '16:00' }, { fecha: '2026-10-27', hora: '17:00' },
    ])
  })
  it('desde una fecha futura empieza ahí; desde una pasada empieza hoy', () => {
    expect(proximosHuecos(datos(), AHORA, '2026-10-27', 1)).toEqual([{ fecha: '2026-10-27', hora: '16:00' }])
    expect(proximosHuecos(datos(), AHORA, '2026-10-20', 1)).toEqual([{ fecha: '2026-10-26', hora: '12:00' }])
  })
  it('no mira más allá de 14 días', () => {
    expect(DIAS_VISTA).toBe(14)
    expect(MAX_HUECOS).toBe(10)
    expect(proximosHuecos(datos({ tramos: [] }), AHORA)).toEqual([])
    expect(proximosHuecos(datos({ tramos: [t(1, '09:00', '13:00')], bloqueos: [{ inicio: '2026-10-26', fin: '2026-11-30' }] }), AHORA)).toEqual([])
  })
  it('con el centro apagado no hay huecos; una cita ocupa su hora', () => {
    expect(proximosHuecos(datos({ centroActivo: false }), AHORA)).toEqual([])
    expect(proximosHuecos(datos({ citas: [{ fecha: '2026-10-26', hora: '12:00:00' }] }), AHORA, undefined, 1)).toEqual([{ fecha: '2026-10-27', hora: '16:00' }])
  })
})

describe('motivoSinHuecos', () => {
  it('centro inactivo, sin horario en el centro o simplemente sin huecos', () => {
    expect(motivoSinHuecos(datos({ centroActivo: false }))).toBe('centro_inactivo')
    expect(motivoSinHuecos(datos({ tramos: [] }))).toBe('sin_horario_en_centro')
    expect(motivoSinHuecos(datos())).toBe('sin_huecos')
  })
})

describe('elegirMasProximo', () => {
  it('más temprano, empate por nombre', () => {
    const a = { nombre: 'Marta', huecos: [{ fecha: '2026-10-27', hora: '16:00' }] }
    const b = { nombre: 'Jaime', huecos: [{ fecha: '2026-10-27', hora: '16:00' }] }
    const c = { nombre: 'Ana', huecos: [] as HuecoFecha[] }
    expect(elegirMasProximo([a, b, c])).toBe(b)
    expect(elegirMasProximo([c])).toBeNull()
  })
  it('gana la fecha más temprana aunque la hora sea más tarde', () => {
    const a = { nombre: 'Marta', huecos: [{ fecha: '2026-10-26', hora: '18:00' }] }
    const b = { nombre: 'Jaime', huecos: [{ fecha: '2026-10-27', hora: '09:00' }] }
    expect(elegirMasProximo([b, a])).toBe(a)
  })
})

describe('comprobarHueco', () => {
  it('aplica las reglas completas y acepta horas con segundos', () => {
    expect(comprobarHueco(datos(), AHORA, '2026-10-26', '12:00')).toEqual({ ok: true })
    expect(comprobarHueco(datos(), AHORA, '2026-10-26', '12:00:00')).toEqual({ ok: true })
    expect(comprobarHueco(datos(), AHORA, '2026-10-26', '11:00')).toEqual({ ok: false, motivo: 'antelacion' })
    expect(comprobarHueco(datos(), AHORA, '2026-10-26', '09:00')).toEqual({ ok: false, motivo: 'pasado' })
    expect(comprobarHueco(datos(), AHORA, '2026-10-27', '10:00')).toEqual({ ok: false, motivo: 'fuera_horario' })
    expect(comprobarHueco(datos(), AHORA, '2026-10-26', '10:15')).toEqual({ ok: false, motivo: 'hora_no_valida' })
    expect(comprobarHueco(datos({ mediaHora: false }), AHORA, '2026-10-27', '16:30')).toEqual({ ok: false, motivo: 'media_hora' })
  })
  it('centro apagado bloquea agendar pero no cambiar (excluirAccionId)', () => {
    expect(comprobarHueco(datos({ centroActivo: false }), AHORA, '2026-10-27', '16:00')).toEqual({ ok: false, motivo: 'centro_inactivo' })
    expect(comprobarHueco(datos({ centroActivo: false }), AHORA, '2026-10-27', '16:00', 'acc-1')).toEqual({ ok: true })
  })
  it('al cambiar, la propia cita no ocupa su hora', () => {
    const d = datos({ citas: [{ fecha: '2026-10-27', hora: '16:00:00', accionId: 'acc-1' }] })
    expect(comprobarHueco(d, AHORA, '2026-10-27', '16:00')).toEqual({ ok: false, motivo: 'ocupado' })
    expect(comprobarHueco(d, AHORA, '2026-10-27', '16:00', 'acc-1')).toEqual({ ok: true })
  })
})
