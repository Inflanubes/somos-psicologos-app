'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayISODate } from '@/lib/eventos-activos'
import type { Centro, Psicologo } from '@/types/database'
import type { Tramo } from '@/lib/horarios'
import {
  lunesDeSemana, sumarDias, diasDeSemana, etiquetaRangoSemana, etiquetaDia, filtrarEventos, colorCentro,
  TIPOS_CITA_FILTRO, type EventoCalendario, type FiltrosCalendario,
} from '@/lib/calendario'
import AgendaSemanal from './AgendaSemanal'

const BRAND_BLUE = '#2f5aae'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', padding: 20, marginBottom: 20,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit',
  border: '1.5px solid #dde1ea', background: '#fff', color: '#272626', cursor: 'pointer',
}
const btnNav: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid rgba(47,90,174,0.3)', background: '#fff', color: BRAND_BLUE, cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

/**
 * Agenda semanal de todos los psicólogos (citas activas y bloqueos) leída de
 * `acciones_psicologos`. Entra mostrando todo; se filtra por centro, tipo de
 * cita y psicólogo. Solo muestra lo gestionado desde la app (no lo que un
 * psicólogo apunte a mano en Google Calendar).
 */
export default function CalendarioPage() {
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [lunes, setLunes] = useState(() => lunesDeSemana(todayISODate()))
  const [filtros, setFiltros] = useState<FiltrosCalendario>({ centroId: '', tipoCita: '', psicologoId: '' })
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  // Semana (lunes) cuyos eventos están cargados; mientras no coincide con `lunes`, se está cargando.
  const [semanaCargada, setSemanaCargada] = useState<string | null>(null)
  // Horario de la ficha filtrada; se ignora si el filtro ha cambiado desde que se cargó.
  const [tramosDe, setTramosDe] = useState<{ id: string; tramos: Tramo[] } | null>(null)
  const [cargandoBase, setCargandoBase] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [esMovil, setEsMovil] = useState(false)
  const [diaMovil, setDiaMovil] = useState(0)

  // Móvil: se muestra un solo día con flechas.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)')
    const aplicar = () => setEsMovil(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  // Centros y TODAS las fichas de psicólogo (también inactivas, para nombrar citas antiguas).
  useEffect(() => {
    Promise.all([
      supabase.from('centros').select('*').order('nombre'),
      supabase.from('psicologos').select('*').order('nombre'),
    ]).then(([c, p]) => {
      if (c.error || p.error) setError(c.error?.message ?? p.error?.message ?? 'Error al cargar')
      setCentros((c.data ?? []) as Centro[])
      setPsicologos((p.data ?? []) as Psicologo[])
      setCargandoBase(false)
    })
  }, [])

  // Citas y bloqueos de la semana visible.
  useEffect(() => {
    if (cargandoBase) return
    let cancelado = false
    const domingo = sumarDias(lunes, 6)
    const psi = new Map(psicologos.map((p) => [p.id, p]))

    async function cargarSemana(): Promise<EventoCalendario[]> {
      const [citas, bloqueos] = await Promise.all([
        supabase
          .from('acciones_psicologos')
          .select('id, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita')
          .eq('accion', 'Agendar cita')
          .eq('activo', true)
          .gte('fecha_cita', lunes)
          .lte('fecha_cita', domingo),
        supabase
          .from('acciones_psicologos')
          .select('id, psicologo_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
          .eq('accion', 'Bloquear agenda')
          .eq('activo', true)
          .lte('fecha_bloqueo_inicio', domingo)
          .or(`fecha_bloqueo_fin.gte.${lunes},fecha_bloqueo_fin.is.null`),
      ])
      if (citas.error) throw citas.error
      if (bloqueos.error) throw bloqueos.error

      const idsPacientes = Array.from(
        new Set((citas.data ?? []).map((c) => c.paciente_id).filter((x): x is string => !!x)),
      )
      const iniciales = new Map<string, string | null>()
      if (idsPacientes.length > 0) {
        const pac = await supabase.from('pacientes').select('id, iniciales').in('id', idsPacientes)
        if (pac.error) throw pac.error
        for (const p of pac.data ?? []) iniciales.set(p.id, p.iniciales)
      }

      const lista: EventoCalendario[] = []
      for (const c of citas.data ?? []) {
        if (!c.fecha_cita || !c.hora_cita) continue
        const p = c.psicologo_id ? psi.get(c.psicologo_id) : undefined
        lista.push({
          id: c.id, tipo: 'cita', psicologoId: c.psicologo_id ?? '', psicologoNombre: p?.nombre ?? 'Psicólogo',
          centroId: p?.centro_id ?? null, fecha: c.fecha_cita, hora: c.hora_cita.slice(0, 5), tipoCita: c.tipo_cita,
          iniciales: c.paciente_id ? (iniciales.get(c.paciente_id) ?? null) : null, inicio: null, fin: null, motivo: null,
        })
      }
      for (const b of bloqueos.data ?? []) {
        if (!b.fecha_bloqueo_inicio) continue
        const p = b.psicologo_id ? psi.get(b.psicologo_id) : undefined
        lista.push({
          id: b.id, tipo: 'bloqueo', psicologoId: b.psicologo_id ?? '', psicologoNombre: p?.nombre ?? 'Psicólogo',
          centroId: p?.centro_id ?? null, fecha: null, hora: null, tipoCita: null, iniciales: null,
          inicio: b.fecha_bloqueo_inicio, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo,
        })
      }
      return lista
    }

    cargarSemana()
      .then((lista) => {
        if (cancelado) return
        setEventos(lista)
        setError(null)
        setSemanaCargada(lunes)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setEventos([])
        setError(e instanceof Error ? e.message : 'No se pudo cargar la semana')
        setSemanaCargada(lunes)
      })
    return () => { cancelado = true }
  }, [lunes, cargandoBase, psicologos])

  // Horario de la ficha filtrada (sombreado de sus horas de trabajo).
  useEffect(() => {
    const id = filtros.psicologoId
    if (!id) return
    let cancelado = false
    supabase
      .from('horarios_psicologos')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('psicologo_id', id)
      .then(({ data }) => { if (!cancelado) setTramosDe({ id, tramos: (data ?? []) as Tramo[] }) })
    return () => { cancelado = true }
  }, [filtros.psicologoId])

  const cargando = cargandoBase || semanaCargada !== lunes
  const tramos = filtros.psicologoId && tramosDe?.id === filtros.psicologoId ? tramosDe.tramos : []
  const dias = useMemo(() => diasDeSemana(lunes), [lunes])
  const indiceCentro = useMemo(() => new Map(centros.map((c, i) => [c.id, i])), [centros])
  const nombreCentro = useMemo(() => new Map(centros.map((c) => [c.id, c.nombre])), [centros])
  const psicologosFiltro = psicologos.filter((p) => p.activo && (!filtros.centroId || p.centro_id === filtros.centroId))
  const visibles = useMemo(() => filtrarEventos(eventos, filtros), [eventos, filtros])
  const hoy = todayISODate()
  const diasVisibles = esMovil ? [dias[Math.min(Math.max(diaMovil, 0), 6)]] : dias

  function cambiarFiltro(campo: keyof FiltrosCalendario, valor: string) {
    setFiltros((prev) => {
      const siguiente = { ...prev, [campo]: valor }
      // Al cambiar de centro, el psicólogo elegido solo se conserva si sigue en la lista.
      if (campo === 'centroId' && prev.psicologoId) {
        const sigue = psicologos.some((p) => p.id === prev.psicologoId && (!valor || p.centro_id === valor))
        if (!sigue) siguiente.psicologoId = ''
      }
      return siguiente
    })
  }

  function irAHoy() {
    setLunes(lunesDeSemana(hoy))
    setDiaMovil(diasDeSemana(lunesDeSemana(hoy)).indexOf(hoy))
  }

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: '0 0 6px' }}>
          Calendario
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Citas y bloqueos de todos los psicólogos. Filtra por centro, tipo de cita o psicólogo para ver la disponibilidad.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filtros + leyenda */}
      <div style={card}>
        <div className="cal-filtros">
          <select value={filtros.centroId} onChange={(e) => cambiarFiltro('centroId', e.target.value)} style={selectStyle} aria-label="Centro">
            <option value="">Todos los centros</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filtros.tipoCita} onChange={(e) => cambiarFiltro('tipoCita', e.target.value)} style={selectStyle} aria-label="Tipo de cita">
            {TIPOS_CITA_FILTRO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filtros.psicologoId} onChange={(e) => cambiarFiltro('psicologoId', e.target.value)} style={selectStyle} aria-label="Psicólogo">
            <option value="">Todos los psicólogos</option>
            {psicologosFiltro.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{filtros.centroId ? '' : ` · ${nombreCentro.get(p.centro_id) ?? ''}`}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          {centros.map((c, i) => {
            const col = colorCentro(i)
            return (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a5870' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: col.fondo, borderLeft: `3px solid ${col.borde}` }} />
                {c.nombre}
              </span>
            )
          })}
        </div>
        {filtros.psicologoId && (
          <div style={{ fontSize: 12, color: '#667799', marginTop: 10 }}>
            {tramos.length > 0
              ? 'Las celdas sombreadas en azul son las horas de trabajo de este psicólogo en este centro.'
              : 'Este psicólogo no tiene horario definido en Usuarios.'}
          </div>
        )}
      </div>

      {/* Navegación de semana */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, -7))}>‹ Semana anterior</button>
          <button type="button" style={btnNav} onClick={irAHoy}>Hoy</button>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, 7))}>Semana siguiente ›</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#272626' }}>{etiquetaRangoSemana(lunes)}</div>
        {esMovil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button type="button" style={btnNav} onClick={() => setDiaMovil((d) => Math.max(0, d - 1))} disabled={diaMovil === 0}>‹ Día</button>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: BRAND_BLUE }}>{etiquetaDia(diasVisibles[0])}</span>
            <button type="button" style={btnNav} onClick={() => setDiaMovil((d) => Math.min(6, d + 1))} disabled={diaMovil === 6}>Día ›</button>
          </div>
        )}
      </div>

      {/* Agenda */}
      <div style={{ ...card, padding: 12 }}>
        {cargandoBase || cargando ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${diasVisibles.length}, 1fr)`, gap: 6, marginBottom: 8 }}>
                {Array.from({ length: diasVisibles.length + 1 }).map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
                ))}
              </div>
            ))}
            <style>{`
              .skeleton { background: linear-gradient(90deg, #ede9e2 25%, #e4dfd7 50%, #ede9e2 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
              @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `}</style>
          </div>
        ) : (
          <>
            {visibles.length === 0 && (
              <div style={{ fontSize: 13, color: '#8899bb', padding: '8px 10px' }}>
                No hay citas ni bloqueos esta semana con los filtros elegidos.
              </div>
            )}
            <AgendaSemanal
              dias={diasVisibles}
              eventos={visibles}
              tramos={tramos}
              indiceCentro={indiceCentro}
              nombreCentro={nombreCentro}
              hoy={hoy}
            />
          </>
        )}
      </div>
    </div>
  )
}
