// lib/consentimiento.test.ts
import { describe, it, expect } from 'vitest'
import {
  ENLACE_ADULTO, ENLACE_MENORES, enlaceConsentimiento, destinatariosReenvio, payloadReenvio,
  marcarFirmado, desmarcarFirmado, camposTutoresFirmados, textoEstadoConsentimiento, puedeDesmarcar,
  camposTutoresDesmarcados, opcionesDesmarcarTutores, textoConfirmReenvio,
} from './consentimiento'

describe('enlaceConsentimiento', () => {
  it('adulto y menores tienen cada uno su enlace exacto', () => {
    expect(enlaceConsentimiento(false)).toBe('https://www.somospsicologos.es/consentimiento/')
    expect(enlaceConsentimiento(true)).toBe('https://www.somospsicologos.es/consentimiento-menores/')
    expect(ENLACE_ADULTO).toBe(enlaceConsentimiento(false))
    expect(ENLACE_MENORES).toBe(enlaceConsentimiento(true))
  })
})

describe('destinatariosReenvio', () => {
  it('un adulto es su propio destinatario', () => {
    expect(destinatariosReenvio({ nombre: 'Ana', telefono: '600', es_menor: false }, null))
      .toEqual([{ nombre: 'Ana', telefono: '600' }])
  })
  it('un menor va a los tutores que tienen teléfono', () => {
    expect(destinatariosReenvio(
      { nombre: 'Leo', telefono: '611', es_menor: true },
      { T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: 'Ma', 'T2_teléfono': null },
    )).toEqual([{ nombre: 'Pa', telefono: '611' }])
    expect(destinatariosReenvio(
      { nombre: 'Leo', telefono: '611', es_menor: true },
      { T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: 'Ma', 'T2_teléfono': '622' },
    )).toEqual([{ nombre: 'Pa', telefono: '611' }, { nombre: 'Ma', telefono: '622' }])
  })
  it('sin teléfono no hay destinatarios', () => {
    expect(destinatariosReenvio({ nombre: 'X', telefono: null, es_menor: false }, null)).toEqual([])
    expect(destinatariosReenvio({ nombre: 'X', telefono: '  ', es_menor: false }, null)).toEqual([])
    expect(destinatariosReenvio({ nombre: 'Leo', telefono: '611', es_menor: true }, null)).toEqual([])
    expect(destinatariosReenvio(
      { nombre: 'Leo', telefono: '611', es_menor: true },
      { T1_nombre_completo: 'Pa', 'T1_teléfono': null, T2_nombre_completo: null, 'T2_teléfono': null },
    )).toEqual([])
  })
})

describe('payloadReenvio', () => {
  it('lleva la acción exacta, el psicólogo (Make lo busca antes de enrutar) y el enlace según es_menor', () => {
    const p = payloadReenvio(
      { id: 'p1', nombre: 'Leo', telefono: '611', es_menor: true, psicologo_id: 'psi-1', psicologo_nombre: 'Jaime', centro_id: 'c-1' },
      { T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: 'Ma', 'T2_teléfono': '622' },
      { nombre: 'Marta', id: 'u1', rol: 'agente' },
    )
    expect(p).toEqual({
      psicologo_id: 'psi-1',
      psicologo_nombre: 'Jaime',
      centro_id: 'c-1',
      accion: 'Reenviar consentimiento',
      paciente_id: 'p1',
      paciente_nombre: 'Leo',
      telefono: '611',
      es_menor: true,
      enlace: 'https://www.somospsicologos.es/consentimiento-menores/',
      tutor1_nombre: 'Pa',
      tutor1_telefono: '611',
      tutor2_nombre: 'Ma',
      tutor2_telefono: '622',
      created_by: 'Marta',
      created_by_id: 'u1',
      origen: 'agente',
    })
  })
  it('adulto sin tutores: campos de tutor vacíos y enlace de adulto', () => {
    const p = payloadReenvio(
      { id: 'p2', nombre: 'Ana', telefono: '600', es_menor: false, psicologo_id: 'psi-1', psicologo_nombre: 'Jaime', centro_id: null },
      null,
      { nombre: 'Jaime', id: null, rol: 'psicologo' },
    )
    expect(p.enlace).toBe('https://www.somospsicologos.es/consentimiento/')
    expect(p.centro_id).toBeNull()
    expect(p.tutor1_nombre).toBeNull()
    expect(p.tutor1_telefono).toBeNull()
    expect(p.tutor2_nombre).toBeNull()
    expect(p.tutor2_telefono).toBeNull()
    expect(p.created_by_id).toBeNull()
    expect(p.origen).toBe('psicologo')
  })
})

describe('marcar y desmarcar', () => {
  it('marcarFirmado guarda quién, cuándo y que fue manual', () => {
    const m = marcarFirmado({ nombre: 'Jaime', id: 'u2', rol: 'psicologo' }, new Date('2026-10-26T10:00:00Z'))
    expect(m).toEqual({
      consentimiento: true,
      consentimiento_origen: 'manual',
      consentimiento_marcado_por: 'Jaime',
      consentimiento_marcado_en: '2026-10-26T10:00:00.000Z',
    })
  })
  it('desmarcarFirmado deja todo a false/null', () => {
    expect(desmarcarFirmado()).toEqual({
      consentimiento: false,
      consentimiento_origen: null,
      consentimiento_marcado_por: null,
      consentimiento_marcado_en: null,
    })
  })
  it('camposTutoresFirmados marca uno o dos tutores', () => {
    expect(camposTutoresFirmados(true)).toEqual({ T1_consentimiento: true })
    expect(camposTutoresFirmados(false)).toEqual({ T1_consentimiento: true, T2_consentimiento: true })
  })
  it('solo el agente puede desmarcar', () => {
    expect(puedeDesmarcar('agente')).toBe(true)
    expect(puedeDesmarcar('psicologo')).toBe(false)
    expect(puedeDesmarcar('call_center')).toBe(false)
  })
})

describe('textoEstadoConsentimiento', () => {
  it('firmado a mano dice quién y cuándo (fecha de Madrid)', () => {
    expect(textoEstadoConsentimiento({
      consentimiento: true, consentimiento_origen: 'manual', consentimiento_marcado_por: 'Jaime', consentimiento_marcado_en: '2026-10-26T10:00:00Z',
    })).toBe('Firmado a mano por Jaime el 26/10/2026')
    // 23:30 UTC del 26 ya es día 27 en Madrid
    expect(textoEstadoConsentimiento({
      consentimiento: true, consentimiento_origen: 'manual', consentimiento_marcado_por: 'Jaime', consentimiento_marcado_en: '2026-10-26T23:30:00Z',
    })).toBe('Firmado a mano por Jaime el 27/10/2026')
  })
  it('firmado por formulario y pendiente', () => {
    expect(textoEstadoConsentimiento({ consentimiento: true, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })).toBe('Firmado')
    expect(textoEstadoConsentimiento({ consentimiento: false, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })).toBe('Pendiente')
    expect(textoEstadoConsentimiento({ consentimiento: null, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })).toBe('Pendiente')
  })
})

describe('desmarcar en un menor: por tutor (decisión de Sonia, 30-10-2026)', () => {
  it('camposTutoresDesmarcados quita la firma del tutor elegido o de los dos', () => {
    expect(camposTutoresDesmarcados('T1')).toEqual({ T1_consentimiento: false })
    expect(camposTutoresDesmarcados('T2')).toEqual({ T2_consentimiento: false })
    expect(camposTutoresDesmarcados('ambos')).toEqual({ T1_consentimiento: false, T2_consentimiento: false })
  })
  it('opcionesDesmarcarTutores ofrece solo los tutores que existen y "los dos" si hay dos', () => {
    expect(opcionesDesmarcarTutores({ T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: 'Ma', 'T2_teléfono': null }))
      .toEqual([{ cual: 'T1', etiqueta: 'Pa' }, { cual: 'T2', etiqueta: 'Ma' }, { cual: 'ambos', etiqueta: 'Los dos' }])
    expect(opcionesDesmarcarTutores({ T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: null, 'T2_teléfono': null }))
      .toEqual([{ cual: 'T1', etiqueta: 'Pa' }])
    expect(opcionesDesmarcarTutores({ T1_nombre_completo: null, 'T1_teléfono': null, T2_nombre_completo: null, 'T2_teléfono': null }))
      .toEqual([{ cual: 'T1', etiqueta: 'Tutor 1' }])
  })
})

describe('textoConfirmReenvio', () => {
  it('avisa si ya está firmado', () => {
    expect(textoConfirmReenvio('Ana', false)).toBe('¿Enviar de nuevo el consentimiento a Ana?')
    expect(textoConfirmReenvio('Ana', true)).toBe('El consentimiento de Ana ya está firmado. ¿Enviarlo de nuevo igualmente?')
  })
})
