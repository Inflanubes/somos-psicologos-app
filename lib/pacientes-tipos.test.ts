// lib/pacientes-tipos.test.ts
import { describe, it, expect } from 'vitest'
import {
  COLUMNA_PSICOLOGO, normalizarNombre, filtroPacientesDePsicologo, tiposDePaciente,
  tiposDisponibles, evaluarDuplicado, type PacienteExistente,
} from './pacientes-tipos'

const base = (over: Partial<PacienteExistente> = {}): PacienteExistente => ({
  id: 'p1', nombre: 'Ana Belén', telefono: '600111222', fecha_nacimiento: '1990-05-04',
  psicologo_adultos_id: 'psi-A', psicologo_pareja_id: null, psicologo_infantil_id: null, ...over,
})

describe('COLUMNA_PSICOLOGO', () => {
  it('mapea cada tipo a su columna', () => {
    expect(COLUMNA_PSICOLOGO.adulto).toBe('psicologo_adultos_id')
    expect(COLUMNA_PSICOLOGO.pareja).toBe('psicologo_pareja_id')
    expect(COLUMNA_PSICOLOGO.menor).toBe('psicologo_infantil_id')
  })
})

describe('normalizarNombre', () => {
  it('ignora tildes, mayúsculas y espacios de más', () => {
    expect(normalizarNombre('  Ana  BELÉN ')).toBe('ana belen')
    expect(normalizarNombre('ana belen')).toBe('ana belen')
  })
})

describe('filtroPacientesDePsicologo', () => {
  it('genera el or de las tres columnas', () => {
    expect(filtroPacientesDePsicologo('x')).toBe(
      'psicologo_adultos_id.eq.x,psicologo_pareja_id.eq.x,psicologo_infantil_id.eq.x',
    )
  })
})

describe('tiposDePaciente', () => {
  it('devuelve los tipos en los que ese psicólogo atiende al paciente', () => {
    const p = base({ psicologo_adultos_id: 'psi-A', psicologo_pareja_id: 'psi-A', psicologo_infantil_id: 'psi-B' })
    expect(tiposDePaciente(p, 'psi-A')).toEqual(['adulto', 'pareja'])
    expect(tiposDePaciente(p, 'psi-B')).toEqual(['menor'])
    expect(tiposDePaciente(p, 'psi-C')).toEqual([])
  })
})

describe('tiposDisponibles', () => {
  it('menor → solo menor si el psicólogo lo pasa', () => {
    expect(tiposDisponibles({ tipos_consulta: ['adulto', 'menor'] }, true)).toEqual(['menor'])
  })
  it('adulto → los tipos del psicólogo salvo menor', () => {
    expect(tiposDisponibles({ tipos_consulta: ['adulto', 'pareja', 'menor'] }, false)).toEqual(['adulto', 'pareja'])
  })
  it('sin tipos configurados → los tres (no bloquear al usuario)', () => {
    expect(tiposDisponibles({ tipos_consulta: [] }, null)).toEqual(['adulto', 'pareja', 'menor'])
    expect(tiposDisponibles(null, null)).toEqual(['adulto', 'pareja', 'menor'])
  })
})

describe('evaluarDuplicado', () => {
  it('sin coincidencias → ninguno', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '699000000', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r.tipo).toBe('ninguno')
  })
  it('adulto: mismo teléfono y mismo nombre (aunque cambie la forma) → bloquear', () => {
    const r = evaluarDuplicado(
      { nombre: 'ANA BELEN', telefono: '600111222', fechaNacimiento: '1990-05-04', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'mismo_telefono_y_nombre', paciente: { id: 'p1' } })
  })
  it('pareja: mismo teléfono y mismo nombre, otro psicólogo → confirmar suave (decisión de Sonia, 28-09-2026)', () => {
    const r = evaluarDuplicado(
      { nombre: 'Ana Belén', telefono: '600111222', fechaNacimiento: '1990-05-04', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', fuerza: 'suave', paciente: { id: 'p1' }, columnaOcupadaPor: null })
  })
  it('pareja: mismo teléfono y mismo nombre, ya en pareja con ESTE psicólogo → bloquear ya_en_tu_lista', () => {
    const r = evaluarDuplicado(
      { nombre: 'Ana Belén', telefono: '600111222', fechaNacimiento: '1990-05-04', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-Z' },
      [base({ psicologo_pareja_id: 'psi-Z' })],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'ya_en_tu_lista' })
  })
  it('pareja: mismo teléfono, otro nombre → confirmar suave, columna libre', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', fuerza: 'suave', paciente: { id: 'p1' }, columnaOcupadaPor: null })
  })
  it('adulto: mismo teléfono, otro nombre → confirmar fuerte', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', fuerza: 'fuerte' })
  })
  it('pareja: la ficha ya tiene otro psicólogo de pareja → confirmar con columnaOcupadaPor', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-B' },
      [base({ psicologo_pareja_id: 'psi-Z' })],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', columnaOcupadaPor: 'psi-Z' })
  })
  it('pareja: la ficha ya tiene a ESTE psicólogo de pareja → bloquear (ya está en su lista)', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-Z' },
      [base({ psicologo_pareja_id: 'psi-Z' })],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'ya_en_tu_lista' })
  })
  it('menor: mismo nombre y misma fecha → bloquear; el teléfono no cuenta', () => {
    const r = evaluarDuplicado(
      { nombre: 'ana belén', telefono: '', fechaNacimiento: '1990-05-04', esMenor: true, tipoConsulta: 'menor', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'menor_mismo_nombre_fecha' })
  })
  it('adulto: un candidato menor (teléfono del tutor) se ignora aunque coincida el teléfono', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base({ id: 'menor-1', nombre: 'Lucas Gómez', es_menor: true })],
    )
    expect(r.tipo).toBe('ninguno')
  })
  it('menor: misma fecha pero otro nombre → ninguno', () => {
    const r = evaluarDuplicado(
      { nombre: 'Pedro Ruiz', telefono: '', fechaNacimiento: '1990-05-04', esMenor: true, tipoConsulta: 'menor', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r.tipo).toBe('ninguno')
  })
})
