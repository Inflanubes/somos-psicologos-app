import { describe, it, expect } from 'vitest'
import {
  citasDelPeriodo, tasa, horasTramos, horasBloqueo, horasAbiertas, kpisResumen, parejasNuevas, serieBarras,
  contarPor, ocupacionPor, anulacionPor, horasBloqueoPor, esAnulada,
  type CitaKpi, type PacienteKpi, type BloqueoKpi, type TramoKpi,
} from './kpis'

// Octubre 2026 (el 1 es jueves: 22 días laborables). Psicólogo A: L–V 9–14 en C1.
// Psicólogo B: sin horario. Bloqueo de A del lunes 5 al viernes 9 (vacaciones).
const OCT = { desde: '2026-10-01', hasta: '2026-10-31' }
const LIM = { primero: '2026-01-01', ultimo: '2026-12-31' }
const DIAS_OCT = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
const tramosA: TramoKpi[] = [1, 2, 3, 4, 5].map((d) => ({
  psicologo_id: 'A', centro_id: 'C1', dia_semana: d, hora_inicio: '09:00', hora_fin: '14:00',
}))
const cita = (
  id: string, psi: string, pac: string, fecha: string, anulada = false, tipo: CitaKpi['tipo_cita'] = 'adulto',
): CitaKpi => ({ id, paciente_id: pac, psicologo_id: psi, centro_id: 'C1', fecha_cita: fecha, tipo_cita: tipo, anulada })
const citas: CitaKpi[] = [
  cita('1', 'A', 'p1', '2026-10-13'),
  cita('2', 'A', 'p1', '2026-10-20'),
  cita('3', 'A', 'p2', '2026-10-14', false, 'pareja'),
  cita('4', 'A', 'p2', '2026-10-21', false, null),
  cita('5', 'A', 'p2', '2026-10-22', true),
  cita('6', 'B', 'p3', '2026-10-15', false, 'menor'),
  cita('7', 'A', 'p9', '2026-11-03'), // fuera del periodo
]
const bloqueoA: BloqueoKpi = {
  psicologo_id: 'A', fecha_bloqueo_inicio: '2026-10-05', fecha_bloqueo_fin: '2026-10-09',
  motivo_bloqueo: 'Vacaciones', creado_en: '2026-09-20T10:00:00Z',
}
const pac = (id: string, fecha: string, extra: Partial<PacienteKpi> = {}): PacienteKpi => ({
  id, fecha_incorporacion: fecha, es_menor: false, centro_id: 'C1', origen: 'agente', psicologo_adultos_id: null,
  psicologo_pareja_id: null, psicologo_infantil_id: null, pareja_de: null, estado: 'Agendado', ...extra,
})
const pacientes: PacienteKpi[] = [
  pac('n1', '2026-10-10', { es_menor: true, origen: 'dante', psicologo_infantil_id: 'B' }),
  pac('n2', '2026-10-12', { psicologo_pareja_id: 'A' }),
  pac('n3', '2026-10-12', { psicologo_pareja_id: 'A', pareja_de: 'n2' }),
  pac('viejo', '2026-09-01'),
]

describe('kpis', () => {
  it('citasDelPeriodo separa por fecha_cita', () => {
    const { activas, anuladas } = citasDelPeriodo(citas, OCT)
    expect(activas).toHaveLength(5)
    expect(anuladas).toHaveLength(1)
  })

  it('citasDelPeriodo: anulada con fecha_cita en el periodo cuenta aunque se agendara antes', () => {
    const { anuladas } = citasDelPeriodo([cita('x', 'A', 'p', '2026-10-02', true)], OCT)
    expect(anuladas).toHaveLength(1)
  })

  it('tasa', () => {
    expect(tasa(1, 6)).toBe(17)
    expect(tasa(0, 0)).toBeNull()
  })

  it('horasTramos: lunes 5 h, sábado 0, tramo a y media', () => {
    expect(horasTramos(tramosA, '2026-10-05')).toBe(5)
    expect(horasTramos(tramosA, '2026-10-10')).toBe(0)
    expect(horasTramos([{ ...tramosA[0], hora_fin: '14:30' }], '2026-10-05')).toBe(5.5)
  })

  it('horasBloqueo cuenta solo días del rango con tramo', () => {
    expect(horasBloqueo(bloqueoA, tramosA, OCT, LIM)).toBe(25)
    expect(horasBloqueo(bloqueoA, tramosA, { desde: '2026-10-07', hasta: '2026-10-31' }, LIM)).toBe(15)
    expect(horasBloqueo(bloqueoA, tramosA, { desde: '', hasta: '' }, LIM)).toBe(25)
    // Solo los tramos de su psicólogo.
    expect(horasBloqueo({ ...bloqueoA, psicologo_id: 'B' }, tramosA, OCT, LIM)).toBe(0)
    // Sin fecha de fin: un solo día.
    expect(horasBloqueo({ ...bloqueoA, fecha_bloqueo_fin: null }, tramosA, OCT, LIM)).toBe(5)
  })

  it('horasAbiertas de A en octubre (22 laborables − 5 bloqueados) = 85 h', () => {
    expect(horasAbiertas(tramosA, DIAS_OCT, [bloqueoA])).toBe(85)
    expect(horasAbiertas(tramosA, DIAS_OCT, [{ ...bloqueoA, psicologo_id: 'B' }])).toBe(110)
  })

  it('kpisResumen', () => {
    const k = kpisResumen({
      citas, pacientes, bloqueos: [bloqueoA], tramos: tramosA, psicologosActivos: ['A', 'B'], rango: OCT, limites: LIM,
    })
    expect(k.pacientesCitados).toBe(3) // 2 de A + 1 de B
    expect(k.citasAgendadas).toBe(5)
    expect(k.tasaAnulacion).toBe(17) // 1 / 6
    expect(k.pacientesNuevos).toBe(3)
    expect(k.menoresNuevos).toBe(1)
    expect(k.parejasNuevas).toBe(1)
    expect(k.psicologosActivos).toBe(2)
    expect(k.huecos).toBe(85)
    expect(k.ocupacion).toBe(6) // 5 / 85
  })

  it('kpisResumen: psicólogo inactivo no suma huecos; sin huecos la ocupación es null', () => {
    const k = kpisResumen({
      citas, pacientes, bloqueos: [], tramos: tramosA, psicologosActivos: ['B'], rango: OCT, limites: LIM,
    })
    expect(k.huecos).toBe(0)
    expect(k.ocupacion).toBeNull()
  })

  it('parejasNuevas: enlace en cualquier sentido cuenta una vez', () => {
    expect(parejasNuevas(pacientes)).toBe(1)
    expect(
      parejasNuevas([
        pac('a', '2026-10-01', { psicologo_pareja_id: 'A', pareja_de: 'b' }),
        pac('b', '2026-10-01', { psicologo_pareja_id: 'A' }),
      ]),
    ).toBe(1)
    expect(
      parejasNuevas([
        pac('a', '2026-10-01', { psicologo_pareja_id: 'A' }),
        pac('b', '2026-10-01', { psicologo_pareja_id: 'A' }),
      ]),
    ).toBe(2)
  })

  it('ocupacionPor psicólogo: B sin horario → null; por centro C1 → 5/85', () => {
    const { activas } = citasDelPeriodo(citas, OCT)
    const porPsi = ocupacionPor(activas, tramosA, DIAS_OCT, [bloqueoA], 'psicologo')
    expect(porPsi.get('A')).toBe(5) // 4 / 85
    expect(porPsi.get('B')).toBeNull()
    expect(ocupacionPor(activas, tramosA, DIAS_OCT, [bloqueoA], 'centro').get('C1')).toBe(6)
  })

  it('ocupacionPor centro: psicólogo con horario en dos centros solo suma los tramos del centro', () => {
    const tramos2: TramoKpi[] = [
      ...tramosA,
      { psicologo_id: 'A', centro_id: 'C2', dia_semana: 6, hora_inicio: '10:00', hora_fin: '12:00' },
    ]
    const dias = ['2026-10-05', '2026-10-10'] // lunes y sábado
    const m = ocupacionPor([{ ...cita('s', 'A', 'p', '2026-10-10'), centro_id: 'C2' }], tramos2, dias, [], 'centro')
    expect(m.get('C2')).toBe(50) // 1 / 2
    expect(m.get('C1')).toBe(0) // 0 / 5
  })

  it('anulacionPor psicólogo: A = 20, B = 0', () => {
    const { activas, anuladas } = citasDelPeriodo(citas, OCT)
    const m = anulacionPor([...activas, ...anuladas], 'psicologo')
    expect(m.get('A')).toBe(20)
    expect(m.get('B')).toBe(0)
  })

  it('serieBarras incluye activos sin datos con 0, ordena y deja null al final', () => {
    const nombres = new Map([['A', 'Ana'], ['B', 'Bea'], ['C', 'Carla'], ['D', 'Dani']])
    const valores = new Map<string, number | null>([['A', 3], ['B', null], ['D', 7]])
    expect(serieBarras(valores, nombres, ['A', 'B', 'C', 'D'])).toEqual([
      { etiqueta: 'Dani', valor: 7 },
      { etiqueta: 'Ana', valor: 3 },
      { etiqueta: 'Carla', valor: 0 },
      { etiqueta: 'Bea', valor: null },
    ])
    // Un id con valor que no está en la lista (p. ej. un psicólogo ya inactivo) también sale.
    expect(serieBarras(new Map([['X', 2]]), nombres, [])).toEqual([{ etiqueta: 'X', valor: 2 }])
    // Para la ocupación, el que falta es "sin horario" (null), no 0.
    expect(serieBarras(new Map(), nombres, ['C'], null)).toEqual([{ etiqueta: 'Carla', valor: null }])
  })

  it('contarPor y horasBloqueoPor', () => {
    const m = contarPor(pacientes, (p) => p.origen, 'Sin dato')
    expect(m.get('agente')).toBe(3)
    expect(m.get('dante')).toBe(1)
    expect(contarPor([{ o: null }], (x) => x.o, 'Sin dato').get('Sin dato')).toBe(1)
    expect(horasBloqueoPor([bloqueoA], tramosA, OCT, LIM, 'motivo').get('Vacaciones')).toBe(25)
    expect(horasBloqueoPor([bloqueoA], tramosA, OCT, LIM, 'psicologo').get('A')).toBe(25)
    expect(horasBloqueoPor([{ ...bloqueoA, motivo_bloqueo: null }], tramosA, OCT, LIM, 'motivo').get('Otros')).toBe(25)
  })

  it('esAnulada: Cancelar cita sí; activo=false solo si el historial tiene su anulación', () => {
    const canceladas = new Set(['c2'])
    expect(esAnulada({ id: 'c1', accion: 'Cancelar cita', activo: true }, canceladas)).toBe(true)
    // activo=false de la migración 003 (cita pasada, atendida): no es anulación.
    expect(esAnulada({ id: 'c3', accion: 'Agendar cita', activo: false }, canceladas)).toBe(false)
    expect(esAnulada({ id: 'c2', accion: 'Agendar cita', activo: false }, canceladas)).toBe(true)
    expect(esAnulada({ id: 'c4', accion: 'Agendar cita', activo: true }, canceladas)).toBe(false)
  })
})
