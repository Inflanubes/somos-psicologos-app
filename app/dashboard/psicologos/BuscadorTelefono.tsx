'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Centro, Psicologo, EstadoPaciente } from '@/types/database'
import { etiquetaOrigen, estadoCitaHistorico, sufijoBusquedaTelefono, type Rol } from '@/lib/call-center'
import { todayISODate } from '@/lib/eventos-activos'

/**
 * Buscador por teléfono (B3, tarea 43): arriba de Citas para agentes y call center.
 * Encuentra pacientes por su teléfono o por el de un tutor y muestra su histórico
 * de citas (sin comentarios ni datos clínicos). "Usar en el formulario" rellena
 * centro, psicólogo y paciente.
 */

const BRAND_BLUE = '#2f5aae'
const MIN_DIGITOS = 4
const RETARDO_MS = 300

type PacienteBusqueda = {
  id: string
  nombre: string
  iniciales: string | null
  telefono: string | null
  centro_id: string | null
  estado: EstadoPaciente
  es_menor: boolean
  origen: string | null
  operador: string | null
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
  /** true si coincidió por el teléfono de un tutor y no por el suyo. */
  porTutor?: boolean
}

type CitaHistorico = {
  id: string
  fecha_cita: string | null
  hora_cita: string | null
  psicologo_id: string | null
  centro_id: string | null
  activo: boolean | null
  origen: string | null
  operador: string | null
}

const COLUMNAS_PACIENTE =
  'id, nombre, iniciales, telefono, centro_id, estado, es_menor, origen, operador, psicologo_adultos_id, psicologo_pareja_id, psicologo_infantil_id'
const COLUMNAS_CITA = 'id, fecha_cita, hora_cita, psicologo_id, centro_id, activo, origen, operador'

const ETIQUETA_ESTADO_CITA = { activa: 'Activa', pasada: 'Pasada', anulada: 'Anulada' } as const
const COLOR_ESTADO_CITA = {
  activa: { bg: '#e8f4e8', fg: '#2a7a2a' },
  pasada: { bg: '#f1f3f7', fg: '#666' },
  anulada: { bg: '#fdeaea', fg: '#c0392b' },
} as const

/** "2026-10-27" → "27/10/2026" */
function fechaCorta(f: string | null): string {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return y && m && d ? `${d}/${m}/${y}` : f
}

export default function BuscadorTelefono({
  rol,
  centros,
  psicologos,
  onSeleccionar,
}: {
  rol: Rol
  centros: Centro[]
  psicologos: Psicologo[]
  onSeleccionar: (s: { centroId: string; psicologoId: string; pacienteId: string }) => void
}) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<PacienteBusqueda[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Histórico desplegado por paciente: 'cargando' mientras llega.
  const [historico, setHistorico] = useState<Record<string, CitaHistorico[] | 'cargando'>>({})
  const [abierto, setAbierto] = useState<string | null>(null)
  const [usando, setUsando] = useState<string | null>(null)

  const sufijo = sufijoBusquedaTelefono(texto)
  const nombrePsi = (id: string | null) => (id ? psicologos.find((p) => p.id === id)?.nombre ?? '—' : null)
  const nombreCentro = (id: string | null) => (id ? centros.find((c) => c.id === id)?.nombre ?? '—' : '—')

  // Búsqueda con retardo: por teléfono del paciente y por el de los tutores (menores).
  useEffect(() => {
    if (sufijo.length < MIN_DIGITOS) {
      setResultados(null)
      setBuscando(false)
      setError(null)
      return
    }
    let cancelado = false
    setBuscando(true)
    const t = setTimeout(async () => {
      try {
        const patron = `%${sufijo}%`
        const [{ data: propios, error: e1 }, { data: tutores, error: e2 }] = await Promise.all([
          supabase.from('pacientes').select(COLUMNAS_PACIENTE).ilike('telefono', patron).limit(10),
          supabase.from('asociados_menores').select('id_menor').or(`"T1_teléfono".ilike.${patron},"T2_teléfono".ilike.${patron}`).limit(10),
        ])
        if (e1 || e2) throw e1 ?? e2
        const lista = ((propios ?? []) as PacienteBusqueda[]).slice()
        const vistos = new Set(lista.map((p) => p.id))
        const idsMenores = ((tutores ?? []) as { id_menor: string }[]).map((r) => r.id_menor).filter((id) => id && !vistos.has(id))
        if (idsMenores.length > 0) {
          const { data: menores, error: e3 } = await supabase.from('pacientes').select(COLUMNAS_PACIENTE).in('id', idsMenores)
          if (e3) throw e3
          for (const m of (menores ?? []) as PacienteBusqueda[]) lista.push({ ...m, porTutor: true })
        }
        if (!cancelado) { setResultados(lista); setError(null) }
      } catch {
        if (!cancelado) { setResultados([]); setError('No se pudo buscar. Inténtalo de nuevo.') }
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, RETARDO_MS)
    return () => { cancelado = true; clearTimeout(t) }
  }, [sufijo])

  async function cargarHistorico(pacienteId: string) {
    setHistorico((h) => ({ ...h, [pacienteId]: 'cargando' }))
    const { data } = await supabase
      .from('acciones_psicologos')
      .select(COLUMNAS_CITA)
      .eq('paciente_id', pacienteId)
      .eq('accion', 'Agendar cita')
      .order('fecha_cita', { ascending: false })
      .order('hora_cita', { ascending: false })
      .limit(20)
    setHistorico((h) => ({ ...h, [pacienteId]: (data ?? []) as CitaHistorico[] }))
  }

  function alternarHistorico(p: PacienteBusqueda) {
    if (abierto === p.id) { setAbierto(null); return }
    setAbierto(p.id)
    if (!historico[p.id]) void cargarHistorico(p.id)
  }

  // Centro y psicólogo de la próxima cita activa; si no hay, los de la ficha.
  async function usar(p: PacienteBusqueda) {
    setUsando(p.id)
    try {
      const { data } = await supabase
        .from('acciones_psicologos')
        .select('psicologo_id, centro_id')
        .eq('paciente_id', p.id)
        .eq('accion', 'Agendar cita')
        .eq('activo', true)
        .gte('fecha_cita', todayISODate())
        .order('fecha_cita', { ascending: true })
        .order('hora_cita', { ascending: true })
        .limit(1)
        .maybeSingle()
      const cita = (data ?? null) as { psicologo_id: string | null; centro_id: string | null } | null
      const psicologoFicha = p.psicologo_adultos_id ?? p.psicologo_pareja_id ?? p.psicologo_infantil_id ?? ''
      onSeleccionar({
        centroId: cita?.centro_id ?? p.centro_id ?? '',
        psicologoId: cita?.psicologo_id ?? psicologoFicha,
        pacienteId: p.id,
      })
    } finally {
      setUsando(null)
    }
  }

  const hoy = todayISODate()

  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '6px 6px 30px rgba(0,0,0,0.10)', padding: '18px 22px', marginBottom: 24 }}>
      <label htmlFor="buscar-telefono" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: BRAND_BLUE, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Buscar por teléfono
      </label>
      <input
        id="buscar-telefono"
        type="tel"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Teléfono del paciente o de un tutor (mín. 4 dígitos)"
        autoComplete="off"
        style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #dde1ea', borderRadius: 8, fontSize: 14, color: '#272626', background: '#fff', outline: 'none', fontFamily: "'Montserrat', inherit", boxSizing: 'border-box' }}
      />
      {sufijo.length > 0 && sufijo.length < MIN_DIGITOS && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Escribe al menos {MIN_DIGITOS} dígitos.</div>
      )}
      {error && <div style={{ fontSize: 12.5, color: '#c0392b', marginTop: 8 }}>{error}</div>}

      {buscando && resultados === null && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      )}

      {resultados !== null && !buscando && resultados.length === 0 && !error && (
        <div style={{ fontSize: 13, color: '#888', marginTop: 12 }}>Ningún paciente con ese teléfono.</div>
      )}

      {resultados !== null && resultados.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, opacity: buscando ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {resultados.map((p) => {
            const hist = historico[p.id]
            const psis = [
              p.psicologo_adultos_id && `Adultos: ${nombrePsi(p.psicologo_adultos_id)}`,
              p.psicologo_pareja_id && `Pareja: ${nombrePsi(p.psicologo_pareja_id)}`,
              p.psicologo_infantil_id && `Infantil: ${nombrePsi(p.psicologo_infantil_id)}`,
            ].filter(Boolean).join(' · ') || 'Sin psicólogo asignado'
            const quien = etiquetaOrigen(p.origen, p.operador, rol)
            return (
              <div key={p.id} style={{ border: '1px solid #dde1ea', borderRadius: 10, padding: '10px 12px', background: '#fafbfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272626' }}>
                      {p.nombre}
                      {p.iniciales && <span style={{ color: '#888', fontWeight: 400, marginLeft: 6 }}>{p.iniciales}</span>}
                      {p.es_menor && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fef3c7', borderRadius: 10, padding: '1px 7px' }}>menor</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#4a5870', marginTop: 3 }}>
                      {p.telefono ?? '—'}{p.porTutor && ' (teléfono de un tutor)'} · {nombreCentro(p.centro_id)} · {p.estado}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#4a5870', marginTop: 2 }}>{psis}</div>
                    {quien && <div style={{ fontSize: 12, color: '#8899bb', marginTop: 2 }}>Añadido por: {quien}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => alternarHistorico(p)}
                      style={{ padding: '6px 12px', borderRadius: 16, border: `1px solid ${BRAND_BLUE}`, background: abierto === p.id ? '#eef2fb' : '#fff', color: BRAND_BLUE, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {abierto === p.id ? 'Ocultar citas' : 'Ver citas'}
                    </button>
                    <button
                      type="button"
                      onClick={() => usar(p)}
                      disabled={usando !== null}
                      style={{ padding: '6px 12px', borderRadius: 16, border: 'none', background: BRAND_BLUE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: usando ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {usando === p.id ? 'Cargando…' : 'Usar en el formulario'}
                    </button>
                  </div>
                </div>

                {abierto === p.id && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #e6e9f0', paddingTop: 8 }}>
                    {hist === 'cargando' || !hist ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 14, borderRadius: 4, width: i === 0 ? '80%' : '65%' }} />)}
                      </div>
                    ) : hist.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#888' }}>Sin citas registradas.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {hist.map((c) => {
                          const estado = estadoCitaHistorico({ activo: c.activo !== false, fecha_cita: c.fecha_cita }, hoy)
                          const col = COLOR_ESTADO_CITA[estado]
                          const quienCita = etiquetaOrigen(c.origen, c.operador, rol)
                          return (
                            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: '#4a5870' }}>
                              <span style={{ fontWeight: 600, color: '#272626', whiteSpace: 'nowrap' }}>
                                {fechaCorta(c.fecha_cita)} {c.hora_cita ? c.hora_cita.slice(0, 5) : ''}
                              </span>
                              <span>{nombrePsi(c.psicologo_id) ?? '—'}</span>
                              <span style={{ color: '#8899bb' }}>{nombreCentro(c.centro_id)}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, background: col.bg, color: col.fg, borderRadius: 10, padding: '1px 8px' }}>
                                {ETIQUETA_ESTADO_CITA[estado]}
                              </span>
                              {quienCita && <span style={{ color: '#8899bb', fontSize: 11.5 }}>{quienCita}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
