import { describe, it, expect } from 'vitest'
import {
  diaSemanaISO, nombreDia, diaBloqueado, trabajaEseDia, generarHuecos, motivoAviso, etiquetaMotivo, aplicarCitaLocal,
  type ParamsHuecos, type Hueco,
} from './disponibilidad'
import type { Tramo } from './horarios'

const LUNES = '2026-09-28'
const MARTES = '2026-09-29'
const DOMINGO = '2026-09-27'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })
const base: ParamsHuecos = { tramos: [], citas: [], bloqueos: [], fecha: LUNES, mediaHora: false, incluirMedias: false }
const estado = (huecos: Hueco[], hora: string) => huecos.find((h) => h.hora === hora)?.estado

describe('diaSemanaISO / nombreDia', () => {
  it('lunes = 1 y domingo = 7 (no 0)', () => {
    expect(diaSemanaISO(LUNES)).toBe(1)
    expect(diaSemanaISO(DOMINGO)).toBe(7)
  })
  it('nombreDia devuelve el nombre en minúsculas', () => {
    expect(nombreDia(MARTES)).toBe('martes')
    expect(nombreDia(DOMINGO)).toBe('domingo')
  })
})

describe('trabajaEseDia', () => {
  it('sin tramos siempre trabaja (sin restricción)', () => {
    expect(trabajaEseDia([], MARTES)).toBe(true)
  })
  it('con tramos solo los días que los tienen', () => {
    const tramos = [t(1, '09:00', '14:00'), t(3, '09:00', '14:00')]
    expect(trabajaEseDia(tramos, LUNES)).toBe(true)
    expect(trabajaEseDia(tramos, MARTES)).toBe(false)
  })
})

describe('diaBloqueado', () => {
  it('incluye los dos extremos del rango', () => {
    const b = [{ inicio: '2026-09-28', fin: '2026-09-30', motivo: 'Vacaciones' }]
    expect(diaBloqueado(b, '2026-09-28')?.motivo).toBe('Vacaciones')
    expect(diaBloqueado(b, '2026-09-30')).not.toBeNull()
    expect(diaBloqueado(b, '2026-10-01')).toBeNull()
    expect(diaBloqueado(b, '2026-09-27')).toBeNull()
  })
  it('un bloqueo sin fin bloquea todo lo posterior al inicio', () => {
    const b = [{ inicio: '2026-09-28', fin: null }]
    expect(diaBloqueado(b, '2027-03-01')).not.toBeNull()
    expect(diaBloqueado(b, '2026-09-27')).toBeNull()
  })
})

describe('generarHuecos: franja y medias horas', () => {
  it('solo en punto: 14 huecos de 08:00 a 21:00, todos libres sin tramos ni citas', () => {
    const h = generarHuecos(base)
    expect(h).toHaveLength(14)
    expect(h[0]).toEqual({ hora: '08:00', estado: 'libre' })
    expect(h[13]).toEqual({ hora: '21:00', estado: 'libre' })
  })
  it('con medias horas activas: 28 huecos hasta 21:30, todos libres', () => {
    const h = generarHuecos({ ...base, mediaHora: true })
    expect(h).toHaveLength(28)
    expect(h[27]).toEqual({ hora: '21:30', estado: 'libre' })
  })
  it('incluirMedias sin mediaHora: las y media salen como media_hora', () => {
    const h = generarHuecos({ ...base, incluirMedias: true })
    expect(h).toHaveLength(28)
    expect(estado(h, '10:00')).toBe('libre')
    expect(estado(h, '10:30')).toBe('media_hora')
  })
})

describe('generarHuecos: horario', () => {
  it('fuera de horario antes, después y cuando la hora entera no cabe en el tramo', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00', '14:00')], mediaHora: true })
    expect(estado(h, '08:00')).toBe('fuera_horario')
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '13:00')).toBe('libre')
    expect(estado(h, '13:30')).toBe('fuera_horario') // 13:30–14:30 no cabe
    expect(estado(h, '14:00')).toBe('fuera_horario')
  })
  it('tramos partidos: mañana y tarde', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00', '14:00'), t(1, '16:00', '20:00')] })
    expect(estado(h, '15:00')).toBe('fuera_horario')
    expect(estado(h, '16:00')).toBe('libre')
    expect(estado(h, '19:00')).toBe('libre')
    expect(estado(h, '20:00')).toBe('fuera_horario')
  })
  it('día sin tramos pero con horario en otros días: todo fuera de horario', () => {
    const h = generarHuecos({ ...base, fecha: MARTES, tramos: [t(1, '09:00', '14:00')] })
    expect(h.every((x) => x.estado === 'fuera_horario')).toBe(true)
  })
  it('acepta horas con segundos en los tramos', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00:00', '14:00:00')] })
    expect(estado(h, '09:00')).toBe('libre')
  })
})

describe('generarHuecos: ocupación', () => {
  it('una cita a las 10:00 solo ocupa las 10:00 cuando no hay medias', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: LUNES, hora: '10:00:00' }] })
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('libre')
  })
  it('una cita a las 10:00 con medias ocupa 09:30, 10:00 y 10:30', () => {
    const h = generarHuecos({ ...base, mediaHora: true, citas: [{ fecha: LUNES, hora: '10:00' }] })
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '09:30')).toBe('ocupado')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '10:30')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('libre')
  })
  it('una cita a las 10:30:00 (con segundos) ocupa 10:00, 10:30 y 11:00', () => {
    const h = generarHuecos({ ...base, mediaHora: true, citas: [{ fecha: LUNES, hora: '10:30:00' }] })
    expect(estado(h, '09:30')).toBe('libre')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '10:30')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('ocupado')
    expect(estado(h, '11:30')).toBe('libre')
  })
  it('las citas de otro día no ocupan', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: MARTES, hora: '10:00' }] })
    expect(estado(h, '10:00')).toBe('libre')
  })
  it('la cita que se está cambiando no ocupa', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: LUNES, hora: '10:00', accionId: 'a1' }], excluirAccionId: 'a1' })
    expect(estado(h, '10:00')).toBe('libre')
  })
  it('un bloqueo del día ocupa todas las horas', () => {
    const h = generarHuecos({ ...base, bloqueos: [{ inicio: LUNES, fin: LUNES }] })
    expect(h.every((x) => x.estado === 'ocupado')).toBe(true)
  })
  it('prioridad: ocupado > fuera_horario > media_hora', () => {
    const h = generarHuecos({
      ...base, incluirMedias: true,
      tramos: [t(1, '09:00', '14:00')],
      citas: [{ fecha: LUNES, hora: '16:00' }],
    })
    expect(estado(h, '16:00')).toBe('ocupado')        // ocupada aunque fuera de horario
    expect(estado(h, '15:30')).toBe('ocupado')        // solapa con la cita de las 16:00
    expect(estado(h, '17:30')).toBe('fuera_horario')  // media hora fuera de horario
    expect(estado(h, '10:30')).toBe('media_hora')     // media hora dentro de horario, sin permiso
  })
})

describe('generarHuecos: límite superior de la franja', () => {
  it('una cita a las 21:00 con medias ocupa 20:30, 21:00 y 21:30 (dura hasta las 22:00) y deja libre 20:00', () => {
    const h = generarHuecos({ ...base, mediaHora: true, citas: [{ fecha: LUNES, hora: '21:00' }] })
    expect(estado(h, '20:00')).toBe('libre')
    expect(estado(h, '20:30')).toBe('ocupado')
    expect(estado(h, '21:00')).toBe('ocupado')
    expect(estado(h, '21:30')).toBe('ocupado')
  })
})

describe('aplicarCitaLocal (estado optimista tras agendar o cambiar)', () => {
  it('tras agendar, la hora queda ocupada aunque Make aún no haya escrito la fila', () => {
    const datos = aplicarCitaLocal({ ...base }, { fecha: LUNES, hora: '10:00' })
    const h = generarHuecos({ ...datos, fecha: LUNES })
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('libre')
  })
  it('tras cambiar una cita, se libera la hora antigua y se ocupa la nueva', () => {
    const antes = { ...base, citas: [{ fecha: LUNES, hora: '10:00:00', accionId: 'a1' }] }
    const datos = aplicarCitaLocal(antes, { fecha: LUNES, hora: '12:00' }, 'a1')
    const h = generarHuecos({ ...datos, fecha: LUNES })
    expect(estado(h, '10:00')).toBe('libre')
    expect(estado(h, '12:00')).toBe('ocupado')
    expect(antes.citas).toHaveLength(1) // no muta la entrada
  })
})

describe('etiquetaMotivo', () => {
  it('Otros y nulo se muestran como Bloqueo', () => {
    expect(etiquetaMotivo('Otros')).toBe('Bloqueo')
    expect(etiquetaMotivo(null)).toBe('Bloqueo')
    expect(etiquetaMotivo('Vacaciones')).toBe('Vacaciones')
  })
})

describe('motivoAviso', () => {
  const ctx = { ...base, incluirMedias: true, nombrePsicologo: 'Marta', nombreCentro: 'San Blas' }
  it('sin fecha no hay aviso', () => {
    expect(motivoAviso({ ...ctx, fecha: '', hora: '' })).toBeNull()
  })
  it('día bloqueado', () => {
    expect(motivoAviso({ ...ctx, hora: '', bloqueos: [{ inicio: LUNES, fin: LUNES, motivo: 'Vacaciones' }] }))
      .toBe('la agenda de Marta está bloqueada ese día (Vacaciones)')
  })
  it('día no laborable', () => {
    expect(motivoAviso({ ...ctx, fecha: MARTES, hora: '10:00', tramos: [t(1, '09:00', '14:00')] }))
      .toBe('Marta no trabaja los martes en San Blas')
  })
  it('hora ocupada', () => {
    expect(motivoAviso({ ...ctx, hora: '10:00', citas: [{ fecha: LUNES, hora: '10:00:00' }] }))
      .toBe('Marta ya tiene una cita a las 10:00')
  })
  it('hora fuera de horario', () => {
    expect(motivoAviso({ ...ctx, hora: '16:00', tramos: [t(1, '09:00', '14:00')] }))
      .toBe('las 16:00 quedan fuera del horario de Marta en San Blas')
  })
  it('media hora no activa', () => {
    expect(motivoAviso({ ...ctx, hora: '10:30' })).toBe('Marta no tiene activadas las citas a y media')
  })
  it('hora libre o fuera de la rejilla (17:15) no avisa', () => {
    expect(motivoAviso({ ...ctx, hora: '10:00' })).toBeNull()
    expect(motivoAviso({ ...ctx, hora: '17:15' })).toBeNull()
  })
})
