'use client'

import { Fragment } from 'react'
import type { Tramo } from '@/lib/horarios'
import { etiquetaMotivo } from '@/lib/disponibilidad'
import {
  FILAS_HORA, filaDeHora, bloqueoCubreDia, tramoCubreCelda, colorCentro, etiquetaDia, etiquetaTipoCita,
  type EventoCalendario,
} from '@/lib/calendario'

const BRAND_BLUE = '#2f5aae'

const cabecera: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '10px 6px', textAlign: 'center',
  fontSize: 12, fontWeight: 700, color: '#4a5870', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(47,90,174,0.15)',
}
const celdaHora: React.CSSProperties = {
  fontSize: 11, color: '#8899bb', padding: '4px 6px 0 0', textAlign: 'right', whiteSpace: 'nowrap',
}
const celda: React.CSSProperties = {
  minHeight: 30, padding: 2, borderLeft: '1px solid rgba(47,90,174,0.08)',
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

function Bloque({ e, indiceCentro, nombreCentro }: { e: EventoCalendario; indiceCentro: Map<string, number>; nombreCentro: Map<string, string> }) {
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
        padding: '3px 6px', fontSize: 11.5, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden',
        transition: 'transform 0.12s', cursor: 'default',
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

export default function AgendaSemanal({ dias, eventos, tramos, indiceCentro, nombreCentro, hoy }: Props) {
  const unDia = dias.length === 1
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
          <div key={`b-${d}`} style={{ ...celda, borderBottom: '1px solid rgba(47,90,174,0.15)', background: '#fafbfd' }}>
            {eventos.filter((e) => bloqueoCubreDia(e, d)).map((e) => (
              <Bloque key={e.id} e={e} indiceCentro={indiceCentro} nombreCentro={nombreCentro} />
            ))}
          </div>
        ))}

        {/* Filas de media hora */}
        {FILAS_HORA.map((h, fila) => {
          const enPunto = h.endsWith(':00')
          return (
            <Fragment key={h}>
              <div style={{ ...celdaHora, borderTop: enPunto ? '1px solid rgba(47,90,174,0.12)' : '1px solid transparent' }}>
                {enPunto ? h : ''}
              </div>
              {dias.map((d) => {
                const citas = eventos.filter((e) => e.tipo === 'cita' && e.fecha === d && filaDeHora(e.hora ?? '') === fila)
                const trabaja = tramos.length > 0 && tramoCubreCelda(tramos, d, h)
                return (
                  <div
                    key={d}
                    style={{
                      ...celda,
                      borderTop: enPunto ? '1px solid rgba(47,90,174,0.12)' : '1px dashed rgba(47,90,174,0.06)',
                      background: trabaja ? '#eef2fb' : d === hoy ? '#fbfcff' : '#fff',
                    }}
                  >
                    {citas.map((e) => (
                      <Bloque key={e.id} e={e} indiceCentro={indiceCentro} nombreCentro={nombreCentro} />
                    ))}
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
