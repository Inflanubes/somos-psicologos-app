'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayISODate } from '@/lib/eventos-activos'
import { ahoraMadrid } from '@/lib/fechas'
import type { Centro, Psicologo, Rol } from '@/types/database'
import type { CitaOcupada } from '@/lib/disponibilidad'
import {
  lunesDeSemana, sumarDias, diasDeSemana, etiquetaRangoSemana, etiquetaDia, filtrarEventos, modoContador,
  COLORES_ESTADO, LEYENDA, type EventoCalendario, type FiltrosCalendario,
} from '@/lib/calendario'
import {
  calcularLibres, bloqueosPorHora, marcarPrimeras, aplicarAccionLocal, type AccionLocal, type PsicologoAgenda,
} from '@/lib/calendario-huecos'
import { cargarSemanaCalendario, type SemanaCalendario } from '@/lib/calendario-datos'
import AgendaSemanal, { type ClickLibre } from './AgendaSemanal'

const BRAND_BLUE = '#2f5aae'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', padding: 20, marginBottom: 20,
}
const btnNav: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid rgba(47,90,174,0.3)', background: '#fff', color: BRAND_BLUE, cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

/** Tras un envío, Make escribe segundos después del webhook: se recarga ahora y dos veces más. */
const RECARGAS_MS = [4000, 10000]

export type Props = {
  rol: Rol
  /** '' = todos. */
  filtros: FiltrosCalendario
  /** Psicólogos cuyas citas y bloqueos se enseñan (ya filtrados por rol y centro por quien lo usa). */
  psicologosVisibles: Psicologo[]
  centros: Centro[]
  onClickLibre?: (h: ClickLibre) => void
  onClickCita?: (e: EventoCalendario) => void
  /** Cambia → recarga inmediata y de nuevo a los 4 s y 10 s. */
  recargaKey?: number
  /** Último cambio hecho desde el formulario (varios en una serie); se aplica en local sin esperar a Make. */
  cambioLocal?: AccionLocal | AccionLocal[] | null
  /** Ancho mínimo de cada columna de día en escritorio (px). Más estrecho junto al formulario de Citas. */
  anchoColumnaMin?: number
}

function aplicarCambios(citas: EventoCalendario[], cambio: AccionLocal | AccionLocal[] | null): EventoCalendario[] {
  if (!cambio) return citas
  return (Array.isArray(cambio) ? cambio : [cambio]).reduce(aplicarAccionLocal, citas)
}

export default function CalendarioAgenda({
  rol, filtros, psicologosVisibles, centros, onClickLibre, onClickCita, recargaKey = 0, cambioLocal = null, anchoColumnaMin,
}: Props) {
  const [lunes, setLunes] = useState(() => lunesDeSemana(todayISODate()))
  const [verAnuladas, setVerAnuladas] = useState(false)
  const [datos, setDatos] = useState<SemanaCalendario | null>(null)
  // Citas con el estado optimista aplicado (cambioLocal) y la marca de primera cita.
  const [citas, setCitas] = useState<EventoCalendario[]>([])
  // Semana (lunes) y clave de los datos cargados; mientras no coinciden, se está cargando.
  const [cargadoPara, setCargadoPara] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [esMovil, setEsMovil] = useState(false)
  // En móvil se abre en el día de hoy (índice dentro de la semana actual).
  const [diaMovil, setDiaMovil] = useState(() => {
    const hoy = todayISODate()
    return Math.max(0, diasDeSemana(lunesDeSemana(hoy)).indexOf(hoy))
  })

  const claveIds = psicologosVisibles.map((p) => p.id).sort().join(',')
  const clave = `${lunes}|${verAnuladas}|${claveIds}|${tick}`

  // Móvil: se muestra un solo día con flechas.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)')
    const aplicar = () => setEsMovil(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  // Recargas tras un envío correcto (recargaKey cambia): ahora, a los 4 s y a los 10 s.
  const primeraKey = useRef(recargaKey)
  useEffect(() => {
    if (recargaKey === primeraKey.current) return
    setTick((t) => t + 1)
    const timers = RECARGAS_MS.map((ms) => setTimeout(() => setTick((t) => t + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [recargaKey])

  // Carga de la semana.
  const cambioRef = useRef(cambioLocal)
  cambioRef.current = cambioLocal
  useEffect(() => {
    let cancelado = false
    const psicologos = psicologosVisibles.map((p) => ({ id: p.id, nombre: p.nombre }))
    cargarSemanaCalendario(supabase, { lunes, psicologos, verAnuladas })
      .then((d) => {
        if (cancelado) return
        setDatos(d)
        let lista = marcarPrimeras(d.citas, d.historial)
        // Hasta que Make haya escrito, el último cambio del formulario se vuelve a aplicar (es idempotente).
        lista = aplicarCambios(lista, cambioRef.current)
        setCitas(lista)
        setError(null)
        setCargadoPara(clave)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatos(null)
        setCitas([])
        setError(e instanceof Error ? e.message : 'No se pudo cargar la semana')
        setCargadoPara(clave)
      })
    return () => { cancelado = true }
    // psicologosVisibles cambia de identidad en cada render de la página: se usa su clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Cambio local nuevo: se aplica sobre las citas cargadas sin esperar a la recarga.
  useEffect(() => {
    if (!cambioLocal) return
    setCitas((prev) => aplicarCambios(prev, cambioLocal))
  }, [cambioLocal])

  const cargando = cargadoPara !== clave
  const dias = useMemo(() => diasDeSemana(lunes), [lunes])
  const hoy = todayISODate()
  const nombreCentro = useMemo(() => new Map(centros.map((c) => [c.id, c.nombre])), [centros])

  const eventos = useMemo(() => {
    if (!datos) return []
    const citasActivas = citas.filter((e) => e.tipo === 'cita')
    const citasDe = new Map<string, CitaOcupada[]>()
    for (const c of citasActivas) {
      if (!c.fecha || !c.hora) continue
      citasDe.set(c.psicologoId, [...(citasDe.get(c.psicologoId) ?? []), { fecha: c.fecha, hora: c.hora, accionId: c.id }])
    }
    // Libres: solo de los psicólogos que pueden recibir citas (call center no ve los de inactivos).
    const paraLibres: PsicologoAgenda[] = psicologosVisibles
      .filter((p) => !filtros.psicologoId || p.id === filtros.psicologoId)
      .filter((p) => rol !== 'call_center' || p.activo)
      .map((p) => ({
        id: p.id, nombre: p.nombre, activo: p.activo, mediaHora: !!p.citas_media_hora,
        tramos: datos.tramosDe.get(p.id) ?? [], citas: citasDe.get(p.id) ?? [], bloqueos: datos.bloqueosDe.get(p.id) ?? [],
        centrosApagados: datos.apagadosDe.get(p.id) ?? [],
      }))
    const libres = calcularLibres(paraLibres, dias, ahoraMadrid(), filtros.centroId || null)
    const bloqueosHora = bloqueosPorHora(datos.bloqueos, datos.tramosDe, dias)
    const anuladasLocales = citas.filter((e) => e.tipo === 'anulada')
    const anuladas = verAnuladas ? [...datos.anuladas, ...anuladasLocales] : []
    return filtrarEventos([...citasActivas, ...anuladas, ...bloqueosHora, ...libres], filtros)
  }, [datos, citas, psicologosVisibles, filtros, rol, dias, verAnuladas])

  const diasVisibles = esMovil ? [dias[Math.min(Math.max(diaMovil, 0), 6)]] : dias
  const contador = modoContador(filtros)

  const irAHoy = useCallback(() => {
    setLunes(lunesDeSemana(hoy))
    setDiaMovil(diasDeSemana(lunesDeSemana(hoy)).indexOf(hoy))
  }, [hoy])

  return (
    <div>
      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Navegación de semana, leyenda y anuladas */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, -7))}>‹ Semana anterior</button>
          <button type="button" style={btnNav} onClick={irAHoy}>Hoy</button>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, 7))}>Semana siguiente ›</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#272626' }}>{etiquetaRangoSemana(lunes)}</div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4a5870', cursor: 'pointer' }}>
          <input type="checkbox" checked={verAnuladas} onChange={(e) => setVerAnuladas(e.target.checked)} />
          Ver anuladas
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
          {LEYENDA.map((l) => {
            const c = COLORES_ESTADO[l.estado]
            return (
              <span key={l.estado} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a5870' }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 3, background: c.fondo, boxSizing: 'border-box',
                  border: c.bordeEstilo ? `1px ${c.bordeEstilo} ${c.borde}` : undefined, borderLeft: `3px solid ${c.borde}`,
                }} />
                <span style={{ textDecoration: c.tachado ? 'line-through' : undefined }}>{l.etiqueta}</span>
              </span>
            )
          })}
        </div>
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
        {cargando && !datos ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${diasVisibles.length}, 1fr)`, gap: 6, marginBottom: 8 }}>
                {Array.from({ length: diasVisibles.length + 1 }).map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {eventos.length === 0 && (
              <div style={{ fontSize: 13, color: '#8899bb', padding: '8px 10px' }}>
                No hay citas ni huecos esta semana con los filtros elegidos.
              </div>
            )}
            <AgendaSemanal
              dias={diasVisibles}
              eventos={eventos}
              contador={contador}
              hoy={hoy}
              nombreCentro={nombreCentro}
              onClickLibre={onClickLibre}
              onClickCita={onClickCita}
              anchoColumnaMin={anchoColumnaMin}
            />
          </div>
        )}
      </div>
    </div>
  )
}
