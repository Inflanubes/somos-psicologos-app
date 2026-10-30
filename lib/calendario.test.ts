import { describe, it, expect } from 'vitest'
import {
  sumarDias, lunesDeSemana, diasDeSemana, etiquetaRangoSemana, etiquetaDia,
  FILAS_HORA, filaDeHora, filtrarEventos, bloqueoCubreDia, tramoCubreCelda, etiquetaTipoCita,
  estadoVisual, COLORES_ESTADO, LEYENDA, modoContador, textoChip,
  distribuirColumnas,
  type EventoCalendario,
} from './calendario'

const cita = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'c1', tipo: 'cita', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: '2026-09-28', hora: '10:00', tipoCita: 'adulto', iniciales: 'AB (Ana)',
  inicio: null, fin: null, motivo: null, primera: false, pacienteId: 'pac1', ...extra,
})
const bloqueo = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'b1', tipo: 'bloqueo', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: null, hora: null, tipoCita: null, iniciales: null,
  inicio: '2026-09-28', fin: '2026-09-30', motivo: 'Vacaciones', primera: false, pacienteId: null, ...extra,
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
  it('un bloqueo sin centro se ve en cualquier filtro de centro', () => {
    const sinCentro = bloqueo({ id: 'b2', centroId: null })
    expect(filtrarEventos([sinCentro], { centroId: 'c1', tipoCita: '', psicologoId: '' })).toHaveLength(1)
  })
  it('una cita sin centro solo se ve en "Todos los centros"', () => {
    const sinCentro = cita({ id: 'c9', centroId: null })
    expect(filtrarEventos([sinCentro], { centroId: '', tipoCita: '', psicologoId: '' })).toHaveLength(1)
    expect(filtrarEventos([sinCentro], { centroId: 'c1', tipoCita: '', psicologoId: '' })).toHaveLength(0)
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

describe('distribuirColumnas (citas de una hora que se solapan en un día)', () => {
  it('una cita sola ocupa toda la columna', () => {
    const r = distribuirColumnas([{ id: 'a', fila: 4 }])
    expect(r.get('a')).toEqual({ col: 0, total: 1 })
  })
  it('dos citas a la misma hora se reparten en dos columnas', () => {
    const r = distribuirColumnas([{ id: 'a', fila: 4 }, { id: 'b', fila: 4 }])
    expect(r.get('a')).toEqual({ col: 0, total: 2 })
    expect(r.get('b')).toEqual({ col: 1, total: 2 })
  })
  it('10:00 y 10:30 se solapan; 11:00 reutiliza la columna de las 10:00', () => {
    const r = distribuirColumnas([{ id: 'c', fila: 6 }, { id: 'a', fila: 4 }, { id: 'b', fila: 5 }])
    expect(r.get('a')).toEqual({ col: 0, total: 2 })
    expect(r.get('b')).toEqual({ col: 1, total: 2 })
    expect(r.get('c')).toEqual({ col: 0, total: 2 })
  })
  it('citas que no se solapan van cada una a ancho completo', () => {
    const r = distribuirColumnas([{ id: 'a', fila: 4 }, { id: 'b', fila: 8 }])
    expect(r.get('a')).toEqual({ col: 0, total: 1 })
    expect(r.get('b')).toEqual({ col: 0, total: 1 })
  })
})

describe('colores y etiquetas', () => {
  it('etiquetaTipoCita', () => {
    expect(etiquetaTipoCita('adulto')).toBe('Adulto')
    expect(etiquetaTipoCita('pareja')).toBe('Pareja')
    expect(etiquetaTipoCita('menor')).toBe('Menor')
    expect(etiquetaTipoCita(null)).toBe('Sin tipo')
  })
})

describe('estado visual, colores y contador', () => {
  it('estadoVisual para los cinco casos', () => {
    expect(estadoVisual(cita({ tipo: 'libre' }))).toBe('libre')
    expect(estadoVisual(cita({}))).toBe('ocupada')
    expect(estadoVisual(cita({ primera: true }))).toBe('primera')
    expect(estadoVisual(cita({ tipo: 'anulada', primera: true }))).toBe('anulada')
    expect(estadoVisual(bloqueo({}))).toBe('bloqueo')
  })
  it('COLORES_ESTADO y LEYENDA siguen la especificación', () => {
    expect(COLORES_ESTADO.libre).toEqual({ fondo: '#e3edff', borde: '#2f5aae', texto: '#1f3f80' })
    expect(COLORES_ESTADO.anulada).toMatchObject({ fondo: '#ffffff', borde: '#dc2626', texto: '#991b1b', bordeEstilo: 'dashed', tachado: true })
    expect(LEYENDA.map((l) => l.etiqueta)).toEqual(['Libre', 'Ocupada', 'Primera cita', 'Anulada', 'Bloqueada'])
  })
  it('modoContador solo sin centro ni psicólogo', () => {
    expect(modoContador({ centroId: '', psicologoId: '', tipoCita: 'adulto' })).toBe(true)
    expect(modoContador({ centroId: 'sb', psicologoId: '', tipoCita: '' })).toBe(false)
    expect(modoContador({ centroId: '', psicologoId: 'p1', tipoCita: '' })).toBe(false)
  })
  it('textoChip', () => {
    expect(textoChip(1)).toBe('1 libre')
    expect(textoChip(4)).toBe('4 libres')
  })
})

describe('filtrarEventos con libres y anuladas', () => {
  const libre = cita({ id: 'l1', tipo: 'libre', centroId: null, centros: ['mor', 'on'], tipoCita: null })
  it('un libre con varios centros se conserva al filtrar por uno de ellos', () => {
    expect(filtrarEventos([libre], { centroId: 'on', tipoCita: '', psicologoId: '' })).toHaveLength(1)
    expect(filtrarEventos([libre], { centroId: 'sb', tipoCita: '', psicologoId: '' })).toHaveLength(0)
  })
  it('el filtro de tipo no afecta a libres ni bloqueos, pero sí a anuladas', () => {
    const anulada = cita({ id: 'a1', tipo: 'anulada', tipoCita: 'pareja' })
    const r = filtrarEventos([libre, anulada, bloqueo({})], { centroId: '', tipoCita: 'adulto', psicologoId: '' })
    expect(r.map((e) => e.id)).toEqual(['l1', 'b1'])
  })
})

describe('distribuirColumnas con altos distintos', () => {
  it('un libre de una fila y una cita de dos filas a la misma hora van en dos columnas', () => {
    const r = distribuirColumnas([{ id: 'libre', fila: 4, filas: 1 }, { id: 'cita', fila: 4 }])
    expect(r.get('libre')?.total).toBe(2)
    expect(r.get('cita')?.total).toBe(2)
    expect(r.get('libre')?.col).not.toBe(r.get('cita')?.col)
  })
  it('un libre de una fila deja su columna libre para el siguiente libre media hora después', () => {
    const r = distribuirColumnas([{ id: 'l1', fila: 4, filas: 1 }, { id: 'l2', fila: 5, filas: 1 }])
    expect(r.get('l1')).toEqual({ col: 0, total: 1 })
    expect(r.get('l2')).toEqual({ col: 0, total: 1 })
  })
})
