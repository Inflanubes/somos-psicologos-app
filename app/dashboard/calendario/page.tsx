'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPerfilActual } from '@/lib/perfil'
import type { Centro, Psicologo, PsicologoCentro, Rol } from '@/types/database'
import { TIPOS_CITA_FILTRO, type EventoCalendario, type FiltrosCalendario } from '@/lib/calendario'
import CalendarioAgenda from '../_components/CalendarioAgenda'
import type { ClickLibre } from '../_components/AgendaSemanal'
import { esGestor } from '@/lib/roles'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', padding: 20, marginBottom: 20,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit',
  border: '1.5px solid #dde1ea', background: '#fff', color: '#272626', cursor: 'pointer',
}

/**
 * Agenda semanal de todos los psicólogos: citas, bloqueos y huecos libres,
 * con filtros de centro, tipo de cita y psicólogo. Un clic en un hueco o en
 * una cita lleva a Citas con el formulario relleno.
 */
export default function CalendarioPage() {
  const router = useRouter()
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [psicologosCentros, setPsicologosCentros] = useState<PsicologoCentro[]>([])
  // Sin fila en perfiles = agente. Hasta que llega, no se pinta la agenda.
  const [rol, setRol] = useState<Rol | null>(null)
  const [filtros, setFiltros] = useState<FiltrosCalendario>({ centroId: '', tipoCita: '', psicologoId: '' })
  const [cargandoBase, setCargandoBase] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Centros, TODAS las fichas de psicólogo (también inactivas: sus citas se ven) y en qué
  // centros trabaja cada uno (migración 014).
  useEffect(() => {
    Promise.all([
      supabase.from('centros').select('*').order('nombre'),
      supabase.from('psicologos').select('*').order('nombre'),
      supabase.from('psicologos_centros').select('psicologo_id, centro_id, activo'),
      getPerfilActual(),
    ]).then(([c, p, pc, perfil]) => {
      if (c.error || p.error || pc.error) setError(c.error?.message ?? p.error?.message ?? pc.error?.message ?? 'Error al cargar')
      setCentros((c.data ?? []) as Centro[])
      setPsicologos((p.data ?? []) as Psicologo[])
      setPsicologosCentros((pc.data ?? []) as PsicologoCentro[])
      setRol(perfil?.rol ?? 'agente')
      setCargandoBase(false)
    })
  }, [])

  const nombreCentro = useMemo(() => new Map(centros.map((c) => [c.id, c.nombre])), [centros])
  const centrosDe = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const pc of psicologosCentros) m.set(pc.psicologo_id, [...(m.get(pc.psicologo_id) ?? []), pc.centro_id])
    return m
  }, [psicologosCentros])
  const esAgente = esGestor(rol)

  // Psicólogos cuya agenda se enseña: los del centro filtrado (o todos). El call center ve
  // las citas de los inactivos pero no sus huecos (lo decide CalendarioAgenda por rol).
  const psicologosVisibles = useMemo(
    () => psicologos.filter((p) => !filtros.centroId || (centrosDe.get(p.id) ?? []).includes(filtros.centroId)),
    [psicologos, filtros.centroId, centrosDe],
  )
  // Desplegable: el agente puede elegir también a los inactivos (marcados); el call center, solo activos.
  const psicologosFiltro = psicologosVisibles.filter((p) => p.activo || esAgente)

  function cambiarFiltro(campo: keyof FiltrosCalendario, valor: string) {
    setFiltros((prev) => {
      const siguiente = { ...prev, [campo]: valor }
      // Al cambiar de centro, el psicólogo elegido solo se conserva si sigue en la lista.
      if (campo === 'centroId' && prev.psicologoId) {
        const sigue = psicologos.some((p) => p.id === prev.psicologoId && (!valor || (centrosDe.get(p.id) ?? []).includes(valor)))
        if (!sigue) siguiente.psicologoId = ''
      }
      return siguiente
    })
  }

  function irAAgendar(h: ClickLibre) {
    const q = new URLSearchParams({ accion: 'agendar', centro: h.centroId, psicologo: h.psicologoId, fecha: h.fecha, hora: h.hora })
    router.push(`/dashboard/psicologos?${q.toString()}`)
  }
  function irACambiar(e: EventoCalendario) {
    router.push(`/dashboard/psicologos?${new URLSearchParams({ accion: 'cambiar', cita: e.id }).toString()}`)
  }

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: '0 0 6px' }}>
          Calendario
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Citas, bloqueos y huecos libres de todos los psicólogos. Pulsa un hueco para agendar o una cita para cambiarla.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filtros */}
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
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.activo ? '' : ' (inactivo)'}
                {filtros.centroId ? '' : ` · ${(centrosDe.get(p.id) ?? []).map((id) => nombreCentro.get(id) ?? '').filter(Boolean).join(' · ')}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargandoBase || rol === null ? (
        <div style={{ ...card, padding: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28, borderRadius: 6, marginBottom: 8 }} />
          ))}
        </div>
      ) : (
        <CalendarioAgenda
          rol={rol}
          filtros={filtros}
          psicologosVisibles={psicologosVisibles}
          centros={centros}
          onClickLibre={irAAgendar}
          onClickCita={irACambiar}
        />
      )}
    </div>
  )
}
