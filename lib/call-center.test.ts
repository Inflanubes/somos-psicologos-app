import { describe, expect, it } from 'vitest'
import {
  ACCIONES_SOLICITUD,
  ACCIONES_SOLICITUD_ACTIVAS,
  ETIQUETA_SOLICITUD,
  citasMismoDia,
  comentarioAvisoCita,
  comentarioCambioPsicologo,
  patronBusquedaTelefono,
  psicologoActualExistente,
  accionAltaExistente,
  operadorParaEnvio,
  guardarOperador,
  leerOperador,
  esAccionSolicitud,
  estadoCitaHistorico,
  etiquetaOrigen,
  normalizarTelefono,
  puedeGestionarCita,
  sufijoBusquedaTelefono,
  textoAvisoMismoDia,
} from './call-center'

describe('puedeGestionarCita', () => {
  it('call center no gestiona citas de psicólogo; origen nulo sí', () => {
    expect(puedeGestionarCita('call_center', 'psicologo')).toBe(false)
    expect(puedeGestionarCita('call_center', null)).toBe(true)
    expect(puedeGestionarCita('call_center', 'dante')).toBe(true)
    expect(puedeGestionarCita('call_center', 'call_center')).toBe(true)
    expect(puedeGestionarCita('agente', 'psicologo')).toBe(true)
    expect(puedeGestionarCita('psicologo', 'psicologo')).toBe(true)
  })
})

describe('acciones de solicitud', () => {
  it('lista exacta de Make, las cuatro activas (Jaime, 31-10-2026), etiquetas de pantalla', () => {
    expect([...ACCIONES_SOLICITUD]).toEqual(['Otro', 'Sin disponibilidad', 'hablar con psicologo', 'Cambio solicitado'])
    expect([...ACCIONES_SOLICITUD_ACTIVAS]).toEqual(['Sin disponibilidad', 'hablar con psicologo', 'Cambio solicitado', 'Otro'])
    expect(ETIQUETA_SOLICITUD).toEqual({
      Otro: 'Otros (aviso al equipo)',
      'Sin disponibilidad': 'Sin cita disponible',
      'hablar con psicologo': 'Pendiente de psicólogo',
      'Cambio solicitado': 'Cambio de psicólogo',
    })
  })
  it('esAccionSolicitud distingue las acciones de cita', () => {
    expect(esAccionSolicitud('Otro')).toBe(true)
    expect(esAccionSolicitud('Cambio solicitado')).toBe(true)
    expect(esAccionSolicitud('Agendar cita')).toBe(false)
    expect(esAccionSolicitud('')).toBe(false)
  })
})

describe('teléfono', () => {
  it('normalizarTelefono y sufijo', () => {
    expect(normalizarTelefono('+34 600-11 22 33')).toBe('34600112233')
    expect(sufijoBusquedaTelefono('+34 600-11 22 33')).toBe('600112233')
    expect(sufijoBusquedaTelefono('6001')).toBe('6001')
    expect(sufijoBusquedaTelefono('abc')).toBe('')
  })
})

describe('citasMismoDia', () => {
  const c = (id: string, hora: string) => ({
    id,
    fecha: '2026-10-27',
    hora,
    psicologoNombre: 'Jaime',
    psicologoId: 'j',
    centroId: null,
  })
  it('misma fecha, seguida a ±60 min, excluye la propia', () => {
    const r = citasMismoDia([c('a', '10:00:00'), c('b', '13:00')], '2026-10-27', '11:00')
    expect(r.map((x) => [x.cita.id, x.seguida])).toEqual([
      ['a', true],
      ['b', false],
    ])
    expect(citasMismoDia([c('a', '10:00')], '2026-10-27', '11:00', 'a')).toEqual([])
    expect(citasMismoDia([c('a', '10:00')], '2026-10-28', '11:00')).toEqual([])
  })
  it('la hora posterior también cuenta como seguida; la misma hora no', () => {
    const r = citasMismoDia([c('a', '12:00')], '2026-10-27', '11:00')
    expect(r[0].seguida).toBe(true)
    expect(citasMismoDia([c('a', '11:00')], '2026-10-27', '11:00')[0].seguida).toBe(false)
  })
})

describe('estadoCitaHistorico', () => {
  it('anulada, pasada, activa', () => {
    expect(estadoCitaHistorico({ activo: false, fecha_cita: '2026-12-01' }, '2026-10-26')).toBe('anulada')
    expect(estadoCitaHistorico({ activo: true, fecha_cita: '2026-10-01' }, '2026-10-26')).toBe('pasada')
    expect(estadoCitaHistorico({ activo: true, fecha_cita: '2026-10-26' }, '2026-10-26')).toBe('activa')
    expect(estadoCitaHistorico({ activo: true, fecha_cita: null }, '2026-10-26')).toBe('activa')
  })
})

describe('etiquetaOrigen', () => {
  it('muestra el operador solo al agente', () => {
    expect(etiquetaOrigen('call_center', 'Ana', 'agente')).toBe('Call center (Ana)')
    expect(etiquetaOrigen('call_center', 'Ana', 'psicologo')).toBe('Call center')
    expect(etiquetaOrigen('call_center', 'Ana', 'call_center')).toBe('Call center')
    expect(etiquetaOrigen('call_center', null, 'agente')).toBe('Call center')
    expect(etiquetaOrigen('call_center', '  ', 'agente')).toBe('Call center')
    expect(etiquetaOrigen('dante', null, 'agente')).toBe('Dante')
    expect(etiquetaOrigen('psicologo', null, 'agente')).toBe('Psicólogo')
    expect(etiquetaOrigen('agente', null, 'agente')).toBe('Agente')
    expect(etiquetaOrigen(null, null, 'agente')).toBe('')
  })
})

describe('comentarios y textos', () => {
  it('comentarioAvisoCita y comentarioCambioPsicologo', () => {
    expect(
      comentarioAvisoCita({ fecha: '2026-10-27', hora: '10:00', psicologoNombre: 'Jaime' }, 'el paciente no puede'),
    ).toBe(
      'Solicita cambiar o anular la cita del 27/10/2026 a las 10:00 con Jaime (creada por el psicólogo): el paciente no puede',
    )
    expect(
      comentarioAvisoCita({ fecha: '2026-10-27', hora: '10:00:00', psicologoNombre: 'Jaime' }, ' x '),
    ).toBe('Solicita cambiar o anular la cita del 27/10/2026 a las 10:00 con Jaime (creada por el psicólogo): x')
    expect(comentarioCambioPsicologo('Marta', 'Ana')).toBe('Pide pasar a Marta. Operador: Ana.')
    expect(comentarioCambioPsicologo('Marta', null)).toBe('Pide pasar a Marta.')
    expect(comentarioCambioPsicologo('Marta', '  ')).toBe('Pide pasar a Marta.')
  })
  it('textoAvisoMismoDia con el día como "lunes 27/10"', () => {
    expect(
      textoAvisoMismoDia({ id: 'a', fecha: '2026-10-27', hora: '10:00:00', psicologoNombre: 'Jaime', psicologoId: 'j', centroId: null }),
    ).toBe(
      'Este paciente ya tiene cita el martes 27/10 a las 10:00 con Jaime. ¿Quieres modificarla o es otra cita (por ejemplo, de pareja)?',
    )
  })
})

describe('operador recordado en el navegador', () => {
  function conLocalStorage(store: Record<string, string> | null) {
    const ls = store && {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    }
    ;(globalThis as { window?: unknown }).window = store
      ? { localStorage: ls }
      : { get localStorage(): Storage { throw new Error('bloqueado') } }
  }
  it('guarda por usuario, borra al vaciar y recuerda', () => {
    const store: Record<string, string> = {}
    conLocalStorage(store)
    guardarOperador('u1', 'Ana')
    expect(leerOperador('u1')).toBe('Ana')
    expect(leerOperador('u2')).toBe('')
    guardarOperador('u1', '   ')
    expect(leerOperador('u1')).toBe('')
    expect(Object.keys(store)).toEqual([])
  })
  it('sin localStorage no rompe', () => {
    conLocalStorage(null)
    expect(() => guardarOperador('u1', 'Ana')).not.toThrow()
    expect(leerOperador('u1')).toBe('')
  })
})

describe('correcciones de la revisión B3', () => {
  it('patronBusquedaTelefono encuentra teléfonos guardados con espacios, guiones o prefijo', () => {
    expect(patronBusquedaTelefono('600112233')).toBe('%6%0%0%1%1%2%2%3%3%')
    expect(patronBusquedaTelefono('+34 600-11 22 33')).toBe('%6%0%0%1%1%2%2%3%3%')
    expect(patronBusquedaTelefono('6001')).toBe('%6%0%0%1%')
  })
  it('psicologoActualExistente: el que ocupa la columna, si no el primero de la ficha', () => {
    const p = { psicologo_adultos_id: 'a', psicologo_pareja_id: null, psicologo_infantil_id: 'i' }
    expect(psicologoActualExistente(p, 'x')).toBe('x')
    expect(psicologoActualExistente(p, null)).toBe('a')
    expect(psicologoActualExistente({ psicologo_adultos_id: null, psicologo_pareja_id: null, psicologo_infantil_id: 'i' }, null)).toBe('i')
    expect(psicologoActualExistente({ psicologo_adultos_id: null, psicologo_pareja_id: null, psicologo_infantil_id: null }, null)).toBe(null)
  })
  it('accionAltaExistente: el call center pide cambio solo si el tipo ya tiene otro psicólogo y aún no lo ha visto', () => {
    // columna libre (alta normal de pareja): vincula como los demás
    expect(accionAltaExistente('call_center', false, false)).toBe('vincular')
    // otro psicólogo en ese tipo, sin cita pasada: puede solicitar el cambio
    expect(accionAltaExistente('call_center', true, false)).toBe('solicitar_cambio')
    // otro psicólogo y el paciente ya tuvo cita con él: debe escribirlo en Otros
    expect(accionAltaExistente('call_center', true, true)).toBe('escribir_en_otros')
    expect(accionAltaExistente('agente', true, true)).toBe('vincular')
    expect(accionAltaExistente('psicologo', true, false)).toBe('vincular')
  })
})

describe('operadorParaEnvio', () => {
  it('call center: el nombre escrito o "agente en general" si va vacío; otros roles: null', () => {
    expect(operadorParaEnvio('call_center', ' Ana ')).toBe('Ana')
    expect(operadorParaEnvio('call_center', '')).toBe('agente en general')
    expect(operadorParaEnvio('call_center', '   ')).toBe('agente en general')
    expect(operadorParaEnvio('agente', 'Ana')).toBe(null)
    expect(operadorParaEnvio('psicologo', '')).toBe(null)
  })
})
