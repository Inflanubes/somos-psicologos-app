import { describe, it, expect } from 'vitest'
import { fechasSerie, comprobarSerie, formatoFechaCorta, mensajeNoDisponibles } from './citas-recurrentes'
import { diaSemanaISO, type ParamsHuecos } from './disponibilidad'
import type { Tramo } from './horarios'

const MARTES = '2026-11-03'
const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })
const disp: Omit<ParamsHuecos, 'fecha' | 'incluirMedias'> = {
  tramos: [t(2, '09:00', '20:00')],
  citas: [],
  bloqueos: [],
  mediaHora: false,
}

describe('fechasSerie', () => {
  it('cada 15 días: misma semana día, cada 14 días, empezando por la fecha elegida', () => {
    const f = fechasSerie(MARTES, 'quincenal', 1)
    expect(f).toEqual(['2026-11-03', '2026-11-17', '2026-12-01'])
    expect(f.every((d) => diaSemanaISO(d) === 2)).toBe(true)
  })
  it('mensual: cada 4 semanas, siempre el mismo día de la semana', () => {
    const f = fechasSerie(MARTES, 'mensual', 3)
    expect(f).toEqual(['2026-11-03', '2026-12-01', '2026-12-29', '2027-01-26'])
    expect(f.every((d) => diaSemanaISO(d) === 2)).toBe(true)
  })
  it('un año como máximo: no pasa del mismo día del año siguiente', () => {
    const f = fechasSerie(MARTES, 'quincenal', 12)
    expect(f.length).toBe(27)
    expect(f[f.length - 1] < '2027-11-03').toBe(true)
    expect(fechasSerie(MARTES, 'quincenal', 24)).toEqual(f)
  })
  it('cruza el cambio de hora sin desplazar el día', () => {
    const f = fechasSerie('2027-03-23', 'quincenal', 1)
    expect(f).toEqual(['2027-03-23', '2027-04-06', '2027-04-20'])
  })
  it('sin repetición o fecha vacía: solo la fecha elegida o nada', () => {
    expect(fechasSerie('', 'quincenal', 6)).toEqual([])
    expect(fechasSerie(MARTES, 'quincenal', 0)).toEqual([MARTES])
  })
})

describe('comprobarSerie', () => {
  it('separa fechas con cita, bloqueadas o fuera de horario (modo restringido)', () => {
    const r = comprobarSerie(['2026-11-03', '2026-11-17', '2026-12-01', '2026-12-15'], '17:00', {
      ...disp,
      citas: [{ fecha: '2026-11-17', hora: '17:30:00' }],
      bloqueos: [{ inicio: '2026-12-01', fin: '2026-12-05', motivo: 'Vacaciones' }],
    }, true)
    expect(r.libres).toEqual(['2026-11-03', '2026-12-15'])
    expect(r.noDisponibles).toEqual(['2026-11-17', '2026-12-01'])
  })
  it('restringido: fuera de horario no vale', () => {
    const r = comprobarSerie(['2026-11-03'], '20:00', disp, true)
    expect(r.noDisponibles).toEqual(['2026-11-03'])
  })
  it('agente: fuera de horario se acepta (ya lo avisó al elegir), pero cita o bloqueo no', () => {
    const r = comprobarSerie(['2026-11-03', '2026-11-17', '2026-12-01'], '20:00', {
      ...disp,
      citas: [{ fecha: '2026-11-17', hora: '20:00' }],
      bloqueos: [{ inicio: '2026-12-01', fin: null }],
    }, false)
    expect(r.libres).toEqual(['2026-11-03'])
    expect(r.noDisponibles).toEqual(['2026-11-17', '2026-12-01'])
  })
})

describe('mensajes', () => {
  it('formato dd/mm/aaaa', () => {
    expect(formatoFechaCorta('2026-11-03')).toBe('03/11/2026')
  })
  it('lista las fechas no disponibles', () => {
    expect(mensajeNoDisponibles(['2026-11-17', '2026-12-01'])).toBe(
      'Las fechas 17/11/2026 y 01/12/2026 no están disponibles. Añádelas por separado teniendo en cuenta la disponibilidad.',
    )
    expect(mensajeNoDisponibles(['2026-11-17'])).toBe(
      'La fecha 17/11/2026 no está disponible. Añádela por separado teniendo en cuenta la disponibilidad.',
    )
    expect(mensajeNoDisponibles(['2026-11-03', '2026-11-17', '2026-12-01'])).toContain('03/11/2026, 17/11/2026 y 01/12/2026')
  })
})
