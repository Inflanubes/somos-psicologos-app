'use client'

import type { Tramo } from '@/lib/horarios'
import { aMinutos } from '@/lib/horarios'
import { etiquetaMotivo, diaSemanaISO } from '@/lib/disponibilidad'
import {
  FILAS_HORA, FILAS_POR_CITA, filaDeHora, bloqueoCubreDia, colorCentro, etiquetaDia, etiquetaTipoCita,
  distribuirColumnas, type EventoCalendario,
} from '@/lib/calendario'

const BRAND_BLUE = '#2f5aae'
/** Alto en píxeles de cada fila de media hora. Una cita (60 min) ocupa dos filas. */
const ALTO_FILA = 30
const ALTO_REJILLA = FILAS_HORA.length * ALTO_FILA
const INICIO_MIN = aMinutos(FILAS_HORA[0])

const cabecera: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '10px 6px', textAlign: 'center',
  fontSize: 12, fontWeight: 700, color: '#4a5870', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(47,90,174,0.15)',
}
const celdaHora: React.CSSProperties = {
  fontSize: 11, color: '#8899bb', padding: '4px 6px 0 0', textAlign: 'right', whiteSpace: 'nowrap',
}

type Props = {
  /** Días visibles ('YYYY-MM-DD'): 7 en escritorio, 1 en móvil. */
  dias: string[]
  eventos: EventoCalendario[]
  /** Horario de la ficha filtrada, para sombrear sus horas de trabajo. Vacío = sin sombreado. */
  tramos: Tramo[]
  indiceCentro: Map<string, number>
  nombreCentro: Map<string, string>
  hoy: string
}

function Bloque({
  e, indiceCentro, nombreCentro, style,
}: { e: EventoCalendario; indiceCentro: Map<string, number>; nombreCentro: Map<string, string>; style?: React.CSSProperties }) {
  const c = colorCentro(e.centroId ? (indiceCentro.get(e.centroId) ?? 7) : 7)
  const centro = e.centroId ? (nombreCentro.get(e.centroId) ?? '') : ''
  const esCita = e.tipo === 'cita'
  const titulo = esCita
    ? `${e.psicologoNombre} · ${centro} · ${e.hora} · ${etiquetaTipoCita(e.tipoCita)}${e.iniciales ? ` · ${e.iniciales}` : ''}`
    : `${e.psicologoNombre} · ${centro} · ${etiquetaMotivo(e.motivo)}`
  return (
    <div
      title={titulo}
      style={{
        background: c.fondo, borderLeft: `3px solid ${c.borde}`, color: c.texto, borderRadius: 6,
        padding: '3px 6px', fontSize: 11.5, lineHeight: 1.3, overflow: 'hidden', cursor: 'default',
        boxSizing: 'border-box', ...style,
      }}
    >
      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {esCita ? `${e.hora} ${e.psicologoNombre}` : e.psicologoNombre}
      </div>
      <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {esCita ? `${e.iniciales ?? '—'} · ${etiquetaTipoCita(e.tipoCita)}` : etiquetaMotivo(e.motivo)}
      </div>
    </div>
  )
}

/** Franjas de horario del día (top y alto en px dentro de la rejilla), recortadas a la franja visible. */
function franjasDeTrabajo(tramos: Tramo[], fecha: string): { top: number; alto: number }[] {
  const dia = diaSemanaISO(fecha)
  return tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => {
      const ini = Math.max(aMinutos(t.hora_inicio), INICIO_MIN)
      const fin = Math.min(aMinutos(t.hora_fin), INICIO_MIN + FILAS_HORA.length * 30)
      return { top: ((ini - INICIO_MIN) / 30) * ALTO_FILA, alto: ((fin - ini) / 30) * ALTO_FILA }
    })
    .filter((f) => f.alto > 0)
}

export default function AgendaSemanal({ dias, eventos, tramos, indiceCentro, nombreCentro, hoy }: Props) {
  const unDia = dias.length === 1
  // Líneas de fondo: una tenue cada media hora y una más marcada cada hora.
  const fondoRejilla =
    `repeating-linear-gradient(to bottom, rgba(47,90,174,0.14) 0, rgba(47,90,174,0.14) 1px, transparent 1px, transparent ${ALTO_FILA * 2}px), ` +
    `repeating-linear-gradient(to bottom, transparent 0, transparent ${ALTO_FILA}px, rgba(47,90,174,0.06) ${ALTO_FILA}px, rgba(47,90,174,0.06) ${ALTO_FILA + 1}px)`

  return (
    <div className="cal-scroll">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dias.length}, minmax(${unDia ? '0' : '150px'}, 1fr))`,
          minWidth: unDia ? 0 : 56 + 150 * 7,
        }}
      >
        {/* Cabecera de días */}
        <div style={cabecera} />
        {dias.map((d) => (
          <div key={d} style={{ ...cabecera, color: d === hoy ? BRAND_BLUE : '#4a5870', background: d === hoy ? '#eef2fb' : '#fff' }}>
            {etiquetaDia(d)}
          </div>
        ))}

        {/* Bloqueos de día completo */}
        <div style={{ ...celdaHora, paddingTop: 6 }}>Día</div>
        {dias.map((d) => (
          <div key={`b-${d}`} style={{ minHeight: 30, padding: 2, borderLeft: '1px solid rgba(47,90,174,0.08)', borderBottom: '1px solid rgba(47,90,174,0.15)', background: '#fafbfd' }}>
            {eventos.filter((e) => bloqueoCubreDia(e, d)).map((e) => (
              <Bloque key={e.id} e={e} indiceCentro={indiceCentro} nombreCentro={nombreCentro} style={{ marginBottom: 3 }} />
            ))}
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

        {/* Un contenedor por día: citas colocadas por su hora, con alto de 60 min */}
        {dias.map((d) => {
          const citasDia = eventos
            .filter((e) => e.tipo === 'cita' && e.fecha === d)
            .map((e) => ({ e, fila: filaDeHora(e.hora ?? '') }))
            .filter((x) => x.fila >= 0)
          const columnas = distribuirColumnas(citasDia.map((x) => ({ id: x.e.id, fila: x.fila })))
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
              {franjasDeTrabajo(tramos, d).map((f, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: f.top, height: f.alto, background: 'rgba(47,90,174,0.09)' }} />
              ))}
              {citasDia.map(({ e, fila }) => {
                const pos = columnas.get(e.id) ?? { col: 0, total: 1 }
                const ancho = 100 / pos.total
                return (
                  <Bloque
                    key={e.id}
                    e={e}
                    indiceCentro={indiceCentro}
                    nombreCentro={nombreCentro}
                    style={{
                      position: 'absolute',
                      top: fila * ALTO_FILA + 1,
                      height: FILAS_POR_CITA * ALTO_FILA - 3,
                      left: `calc(${pos.col * ancho}% + 2px)`,
                      width: `calc(${ancho}% - 4px)`,
                    }}
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
