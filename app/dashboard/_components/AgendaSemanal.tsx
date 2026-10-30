'use client'

import { useEffect, useRef, useState } from 'react'
import { etiquetaMotivo } from '@/lib/disponibilidad'
import {
  FILAS_HORA, FILAS_POR_CITA, filaDeHora, COLORES_ESTADO, estadoVisual, etiquetaDia, etiquetaTipoCita,
  distribuirColumnas, textoChip, type EventoCalendario,
} from '@/lib/calendario'

const BRAND_BLUE = '#2f5aae'
/** Alto en píxeles de cada fila de media hora. Una cita (60 min) ocupa dos filas; un hueco libre, una. */
const ALTO_FILA = 30
const ALTO_REJILLA = FILAS_HORA.length * ALTO_FILA
const FILAS_POR_LIBRE = 1

const cabecera: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '10px 6px', textAlign: 'center',
  fontSize: 12, fontWeight: 700, color: '#4a5870', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(47,90,174,0.15)',
}
const celdaHora: React.CSSProperties = {
  fontSize: 11, color: '#8899bb', padding: '4px 6px 0 0', textAlign: 'right', whiteSpace: 'nowrap',
}

export type ClickLibre = {
  psicologoId: string
  /** Centro del hueco; si el hueco está libre en varios centros, el primero (y `centros` trae todos). */
  centroId: string
  centros?: string[]
  fecha: string
  hora: string
}

type Props = {
  /** Días visibles ('YYYY-MM-DD'): 7 en escritorio, 1 en móvil. */
  dias: string[]
  /** Citas, anuladas, bloqueos por hora y libres, ya filtrados. */
  eventos: EventoCalendario[]
  /** true (sin filtro de centro ni psicólogo): los libres se resumen en un chip "N libres" por media hora. */
  contador: boolean
  hoy: string
  nombreCentro: Map<string, string>
  onClickLibre?: (h: ClickLibre) => void
  onClickCita?: (e: EventoCalendario) => void
  /** Ancho mínimo de cada columna de día en escritorio (px). */
  anchoColumnaMin?: number
}

const ANCHO_COLUMNA_MIN = 150

function nombreCentros(e: EventoCalendario, nombreCentro: Map<string, string>): string {
  const ids = e.centros ?? (e.centroId ? [e.centroId] : [])
  return ids.map((id) => nombreCentro.get(id) ?? '').filter(Boolean).join(' / ')
}

function clickDeLibre(e: EventoCalendario, centroId?: string): ClickLibre {
  return {
    psicologoId: e.psicologoId,
    centroId: centroId ?? e.centroId ?? e.centros?.[0] ?? '',
    centros: e.centros,
    fecha: e.fecha ?? '',
    hora: e.hora ?? '',
  }
}

function Bloque({
  e, nombreCentro, style, onClick,
}: { e: EventoCalendario; nombreCentro: Map<string, string>; style?: React.CSSProperties; onClick?: () => void }) {
  const c = COLORES_ESTADO[estadoVisual(e)]
  const centro = nombreCentros(e, nombreCentro)
  const esCita = e.tipo === 'cita' || e.tipo === 'anulada'
  let titulo: string
  let linea1: string
  let linea2: string | null
  if (e.tipo === 'libre') {
    titulo = `Libre · ${e.psicologoNombre}${centro ? ` · ${centro}` : ''} · ${e.hora}`
    linea1 = `Libre · ${e.psicologoNombre}${centro ? ` · ${centro}` : ''}`
    linea2 = null
  } else if (esCita) {
    titulo = `${e.tipo === 'anulada' ? 'Anulada · ' : e.primera ? 'Primera cita · ' : ''}${e.psicologoNombre} · ${centro} · ${e.hora} · ${etiquetaTipoCita(e.tipoCita)}${e.iniciales ? ` · ${e.iniciales}` : ''}`
    linea1 = `${e.hora} ${e.psicologoNombre}`
    linea2 = `${e.iniciales ?? '—'} · ${etiquetaTipoCita(e.tipoCita)}${centro ? ` · ${centro}` : ''}`
  } else {
    titulo = `${e.psicologoNombre} · ${etiquetaMotivo(e.motivo)} · ${e.hora}`
    linea1 = `${e.psicologoNombre} · ${etiquetaMotivo(e.motivo)}`
    linea2 = null
  }
  const pulsable = !!onClick
  return (
    <div
      title={titulo}
      role={pulsable ? 'button' : undefined}
      tabIndex={pulsable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={pulsable ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick?.() } } : undefined}
      className={pulsable ? 'cal-bloque cal-bloque-pulsable' : 'cal-bloque'}
      style={{
        background: c.fondo, borderLeft: `3px ${c.bordeEstilo ?? 'solid'} ${c.borde}`, color: c.texto, borderRadius: 6,
        padding: '3px 6px', fontSize: 11.5, lineHeight: 1.3, overflow: 'hidden',
        textDecoration: c.tachado ? 'line-through' : undefined,
        border: c.bordeEstilo ? `1px ${c.bordeEstilo} ${c.borde}` : undefined,
        borderLeftWidth: 3,
        boxSizing: 'border-box', ...style,
      }}
    >
      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linea1}</div>
      {linea2 && (
        <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linea2}</div>
      )}
    </div>
  )
}

/** Chip "N libres" de una media hora; al pulsarlo se despliega la lista de psicólogos (uno por centro). */
function ChipLibres({
  libres, abierto, onToggle, nombreCentro, onClickLibre, style,
}: {
  libres: EventoCalendario[]
  abierto: boolean
  onToggle: () => void
  nombreCentro: Map<string, string>
  onClickLibre?: (h: ClickLibre) => void
  style: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const cerrar = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onToggle()
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto, onToggle])

  const lineas = libres.flatMap((e) =>
    (e.centros ?? [e.centroId ?? '']).map((centroId) => ({ e, centroId, texto: `${e.psicologoNombre} · ${nombreCentro.get(centroId) ?? ''}` })),
  )
  return (
    <div ref={ref} style={{ ...style, zIndex: abierto ? 5 : 1 }}>
      <button type="button" className="cal-chip" onClick={onToggle} aria-expanded={abierto}>
        {textoChip(libres.length)}
      </button>
      {abierto && (
        <div className="cal-popover" role="menu">
          {lineas.map((l, i) => (
            <button
              key={`${l.e.id}:${l.centroId}:${i}`}
              type="button"
              role="menuitem"
              className="cal-popover-item"
              onClick={() => { onToggle(); onClickLibre?.(clickDeLibre(l.e, l.centroId)) }}
              disabled={!onClickLibre}
            >
              {l.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgendaSemanal({
  dias, eventos, contador, hoy, nombreCentro, onClickLibre, onClickCita, anchoColumnaMin = ANCHO_COLUMNA_MIN,
}: Props) {
  const unDia = dias.length === 1
  const [abierto, setAbierto] = useState<{ fecha: string; hora: string } | null>(null)
  // Líneas de fondo: una tenue cada media hora y una más marcada cada hora.
  const fondoRejilla =
    `repeating-linear-gradient(to bottom, rgba(47,90,174,0.14) 0, rgba(47,90,174,0.14) 1px, transparent 1px, transparent ${ALTO_FILA * 2}px), ` +
    `repeating-linear-gradient(to bottom, transparent 0, transparent ${ALTO_FILA}px, rgba(47,90,174,0.06) ${ALTO_FILA}px, rgba(47,90,174,0.06) ${ALTO_FILA + 1}px)`

  return (
    <div className="cal-scroll">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dias.length}, minmax(${unDia ? '0' : `${anchoColumnaMin}px`}, 1fr))`,
          minWidth: unDia ? 0 : 56 + anchoColumnaMin * 7,
        }}
      >
        {/* Cabecera de días */}
        <div style={cabecera} />
        {dias.map((d) => (
          <div key={d} style={{ ...cabecera, color: d === hoy ? BRAND_BLUE : '#4a5870', background: d === hoy ? '#eef2fb' : '#fff' }}>
            {etiquetaDia(d)}
          </div>
        ))}

        {/* Columna de horas */}
        <div style={{ position: 'relative', height: ALTO_REJILLA }}>
          {FILAS_HORA.map((h, fila) =>
            h.endsWith(':00') ? (
              <div key={h} style={{ ...celdaHora, position: 'absolute', top: fila * ALTO_FILA, right: 0 }}>
                {h}
              </div>
            ) : null,
          )}
        </div>

        {/* Un contenedor por día: bloques colocados por su hora */}
        {dias.map((d) => {
          const delDia = eventos
            .filter((e) => e.fecha === d)
            .map((e) => ({ e, fila: filaDeHora(e.hora ?? ''), filas: e.tipo === 'libre' ? FILAS_POR_LIBRE : FILAS_POR_CITA }))
            .filter((x) => x.fila >= 0)
          const libresDia = delDia.filter((x) => x.e.tipo === 'libre')
          // En modo contador los libres no se pintan como bloques: un chip por media hora.
          const bloques = contador ? delDia.filter((x) => x.e.tipo !== 'libre') : delDia
          const columnas = distribuirColumnas(bloques.map((x) => ({ id: x.e.id, fila: x.fila, filas: x.filas })))
          const libresPorFila = new Map<number, EventoCalendario[]>()
          if (contador) {
            for (const x of libresDia) libresPorFila.set(x.fila, [...(libresPorFila.get(x.fila) ?? []), x.e])
          }
          return (
            <div
              key={d}
              style={{
                position: 'relative',
                height: ALTO_REJILLA,
                borderLeft: '1px solid rgba(47,90,174,0.08)',
                background: d === hoy ? '#fbfcff' : '#fff',
                backgroundImage: fondoRejilla,
              }}
            >
              {bloques.map(({ e, fila, filas }) => {
                const pos = columnas.get(e.id) ?? { col: 0, total: 1 }
                const ancho = 100 / pos.total
                const onClick =
                  e.tipo === 'libre' && onClickLibre ? () => onClickLibre(clickDeLibre(e))
                  : e.tipo === 'cita' && onClickCita ? () => onClickCita(e)
                  : undefined
                return (
                  <Bloque
                    key={e.id}
                    e={e}
                    nombreCentro={nombreCentro}
                    onClick={onClick}
                    style={{
                      position: 'absolute',
                      top: fila * ALTO_FILA + 1,
                      height: filas * ALTO_FILA - 3,
                      left: `calc(${pos.col * ancho}% + 2px)`,
                      width: `calc(${ancho}% - 4px)`,
                    }}
                  />
                )
              })}
              {Array.from(libresPorFila.entries()).map(([fila, libres]) => {
                const hora = FILAS_HORA[fila]
                const estaAbierto = abierto?.fecha === d && abierto.hora === hora
                return (
                  <ChipLibres
                    key={`chip-${d}-${hora}`}
                    libres={libres}
                    abierto={estaAbierto}
                    onToggle={() => setAbierto(estaAbierto ? null : { fecha: d, hora })}
                    nombreCentro={nombreCentro}
                    onClickLibre={onClickLibre}
                    style={{ position: 'absolute', top: fila * ALTO_FILA + 3, right: 3 }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
