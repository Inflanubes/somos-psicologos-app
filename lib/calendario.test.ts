import { describe, it, expect } from 'vitest'
import {
  sumarDias, lunesDeSemana, diasDeSemana, etiquetaRangoSemana, etiquetaDia,
  FILAS_HORA, filaDeHora, filtrarEventos, bloqueoCubreDia, tramoCubreCelda, colorCentro, etiquetaTipoCita,
  type EventoCalendario,
} from './calendario'

const cita = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'c1', tipo: 'cita', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: '2026-09-28', hora: '10:00', tipoCita: 'adulto', iniciales: 'AB (Ana)',
  inicio: null, fin: null, motivo: null, ...extra,
})
const bloqueo = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'b1', tipo: 'bloqueo', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: null, hora: null, tipoCita: null, iniciales: null,
  inicio: '2026-09-28', fin: '2026-09-30', motivo: 'Vacaciones', ...extra,
})

describe('fechas de semana', () => {
  it('sumarDias cruza el fin de mes', () => {
    expect(sumarDias('2026-09-28', 3)).toBe('2026-10-01')
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
  })
  it('lunesDeSemana devuelve el lunes anterior o el mismo día si ya es lunes', () => {
    expect(lunesDeSemana('2026-09-28')).toBe('2026-09-28') // lunes
    expect(lunesDeSemana('2026-09-27')).toBe('2026-09-21') // domingo
    expect(lunesDeSemana('2026-09-30')).toBe('2026-09-28') // miércoles
  })
  it('diasDeSemana cruza el año', () => {
    const dias = diasDeSemana('2026-12-28')
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2026-12-28')
    expect(dias[6]).toBe('2027-01-03')
  })
  it('etiquetaRangoSemana muestra ambos extremos y el año del final', () => {
    expect(etiquetaRangoSemana('2026-12-28')).toMatch(/^28 dic\.? – 3 ene\.? 2027$/)
  })
  it('etiquetaDia muestra día de la semana corto y número', () => {
    expect(etiquetaDia('2026-09-28')).toMatch(/^lun\.? 28$/)
  })
})

describe('filas de la rejilla', () => {
  it('hay 28 filas de 08:00 a 21:30', () => {
    expect(FILAS_HORA).toHaveLength(28)
    expect(FILAS_HORA[0]).toBe('08:00')
    expect(FILAS_HORA[27]).toBe('21:30')
  })
  it('filaDeHora acepta HH:MM y HH:MM:SS y devuelve -1 fuera de franja', () => {
    expect(filaDeHora('08:00')).toBe(0)
    expect(filaDeHora('10:30:00')).toBe(5)
    expect(filaDeHora('21:30')).toBe(27)
    expect(filaDeHora('07:00')).toBe(-1)
    expect(filaDeHora('22:00')).toBe(-1)
  })
})

describe('filtrarEventos', () => {
  const eventos = [
    cita({ id: 'c1', centroId: 'sb', tipoCita: 'adulto', psicologoId: 'p1' }),
    cita({ id: 'c2', centroId: 'sal', tipoCita: 'pareja', psicologoId: 'p2' }),
    cita({ id: 'c3', centroId: 'sb', tipoCita: null, psicologoId: 'p1' }),
    bloqueo({ id: 'b1', centroId: 'sb', psicologoId: 'p1' }),
  ]
  it('sin filtros devuelve todo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: '', psicologoId: '' })).toHaveLength(4)
  })
  it('filtra por centro (citas y bloqueos)', () => {
    expect(filtrarEventos(eventos, { centroId: 'sal', tipoCita: '', psicologoId: '' }).map((e) => e.id)).toEqual(['c2'])
  })
  it('filtra por tipo de cita sin quitar los bloqueos', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: 'adulto', psicologoId: '' }).map((e) => e.id)).toEqual(['c1', 'b1'])
  })
  it('"sin_tipo" devuelve las citas sin tipo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: 'sin_tipo', psicologoId: '' }).map((e) => e.id)).toEqual(['c3', 'b1'])
  })
  it('filtra por psicólogo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: '', psicologoId: 'p2' }).map((e) => e.id)).toEqual(['c2'])
  })
})

describe('bloqueoCubreDia / tramoCubreCelda', () => {
  it('un bloqueo cubre sus días, extremos incluidos, y sin fin cubre lo posterior', () => {
    expect(bloqueoCubreDia(bloqueo({}), '2026-09-28')).toBe(true)
    expect(bloqueoCubreDia(bloqueo({}), '2026-09-30')).toBe(true)
    expect(bloqueoCubreDia(bloqueo({}), '2026-10-01')).toBe(false)
    expect(bloqueoCubreDia(bloqueo({ fin: null }), '2027-01-01')).toBe(true)
    expect(bloqueoCubreDia(cita({}), '2026-09-28')).toBe(false)
  })
  it('un tramo cubre las medias horas que caben enteras en él', () => {
    const tramos = [{ dia_semana: 1, hora_inicio: '09:00:00', hora_fin: '14:00:00' }]
    expect(tramoCubreCelda(tramos, '2026-09-28', '09:00')).toBe(true)
    expect(tramoCubreCelda(tramos, '2026-09-28', '13:30')).toBe(true)
    expect(tramoCubreCelda(tramos, '2026-09-28', '14:00')).toBe(false)
    expect(tramoCubreCelda(tramos, '2026-09-29', '10:00')).toBe(false) // martes
  })
})

describe('colores y etiquetas', () => {
  it('colorCentro da la vuelta a la paleta', () => {
    expect(colorCentro(0)).toEqual(colorCentro(8))
    expect(colorCentro(3).fondo).not.toBe(colorCentro(4).fondo)
  })
  it('etiquetaTipoCita', () => {
    expect(etiquetaTipoCita('adulto')).toBe('Adulto')
    expect(etiquetaTipoCita('pareja')).toBe('Pareja')
    expect(etiquetaTipoCita('menor')).toBe('Menor')
    expect(etiquetaTipoCita(null)).toBe('Sin tipo')
  })
})
