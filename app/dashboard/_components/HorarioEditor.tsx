'use client'

import { useState } from 'react'
import { DIAS_SEMANA, validarTramos, type Tramo } from '@/lib/horarios'
import { pill, type CentroGestion } from './gestion'

// Horas seleccionables en el editor: de 08:00 a 22:00 en pasos de 30 minutos.
const HORAS: string[] = []
for (let h = 8; h <= 22; h++) {
  HORAS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 22) HORAS.push(`${String(h).padStart(2, '0')}:30`)
}

const SUBTITULO = 'Cada franja pertenece a un centro. Una franja de Online puede coincidir con una presencial; dos presenciales no.'

const select: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
  border: '1px solid rgba(47,90,174,0.25)', background: '#fff', cursor: 'pointer',
}
const btnPeq: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae', cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

type Props = {
  titulo: string
  /** Centros del psicólogo (solo esos), ordenados por nombre. */
  centros: CentroGestion[]
  tramosIniciales: Tramo[]
  busy: boolean
  /** Recibe TODAS las franjas de todos los centros (la validación de solapes ve el conjunto). */
  onGuardar: (tramos: Tramo[]) => Promise<void>
  onCancelar: () => void
}

/**
 * Panel modal para editar el horario semanal de un psicólogo, centro a centro.
 * Arriba se elige el centro; cada día muestra editables las franjas de ese
 * centro y, en gris, las de los demás. Valida el conjunto antes de guardar.
 */
export default function HorarioEditor({ titulo, centros, tramosIniciales, busy, onGuardar, onCancelar }: Props) {
  const [tramos, setTramos] = useState<Tramo[]>(() =>
    tramosIniciales.map((t) => ({ ...t, hora_inicio: t.hora_inicio.slice(0, 5), hora_fin: t.hora_fin.slice(0, 5) })),
  )
  const [centroActual, setCentroActual] = useState<string | null>(centros[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const nombreCentro = (id: string | undefined) => centros.find((c) => c.id === id)?.nombre ?? 'Otro centro'

  function añadir(dia: number) {
    if (!centroActual) return
    setTramos((prev) => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '14:00', centro_id: centroActual }])
  }
  function quitar(indice: number) {
    setTramos((prev) => prev.filter((_, i) => i !== indice))
  }
  function cambiar(indice: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setTramos((prev) => prev.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)))
  }
  async function guardar() {
    const mensaje = validarTramos(tramos, centros)
    if (mensaje) { setError(mensaje); return }
    setError(null)
    await onGuardar(tramos)
  }

  return (
    <div
      onClick={busy ? undefined : onCancelar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(39,38,38,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Horario de ${titulo}`}
        style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#272626' }}>Horario de {titulo}</div>
        <div style={{ fontSize: 12.5, color: '#667799', marginBottom: 12 }}>{SUBTITULO}</div>

        {centros.length === 0 ? (
          <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>Asigna al menos un centro al psicólogo antes de definir su horario.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }} role="tablist" aria-label="Centro">
            {centros.map((c) => (
              <button type="button" key={c.id} role="tab" aria-selected={centroActual === c.id} onClick={() => setCentroActual(c.id)} style={pill(centroActual === c.id)}>
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        {DIAS_SEMANA.map((nombre, i) => {
          const dia = i + 1
          const delDia = tramos.map((t, indice) => ({ t, indice })).filter(({ t }) => t.dia_semana === dia)
          const editables = delDia.filter(({ t }) => t.centro_id === centroActual)
          const otros = delDia.filter(({ t }) => t.centro_id !== centroActual)
          return (
            <div key={dia} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'start', padding: '10px 0', borderTop: '1px solid rgba(47,90,174,0.1)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4a5870', paddingTop: 7 }}>{nombre}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {delDia.length === 0 && <div style={{ fontSize: 12.5, color: '#8899bb', paddingTop: 7 }}>No trabaja</div>}
                {editables.map(({ t, indice }) => (
                  <div key={indice} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={t.hora_inicio} onChange={(e) => cambiar(indice, 'hora_inicio', e.target.value)} style={select} aria-label="Hora de inicio">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span style={{ color: '#8899bb' }}>–</span>
                    <select value={t.hora_fin} onChange={(e) => cambiar(indice, 'hora_fin', e.target.value)} style={select} aria-label="Hora de fin">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <button type="button" onClick={() => quitar(indice)} style={{ ...btnPeq, color: '#b91c1c', borderColor: 'rgba(185,28,28,0.3)' }}>Quitar</button>
                  </div>
                ))}
                {otros.map(({ t, indice }) => (
                  <div key={indice} style={{ fontSize: 12.5, color: '#8899bb', paddingTop: 2 }} title="Franja de otro centro: elige ese centro arriba para editarla">
                    {nombreCentro(t.centro_id)} {t.hora_inicio}–{t.hora_fin}
                  </div>
                ))}
                {centroActual && (
                  <div>
                    <button type="button" onClick={() => añadir(dia)} style={btnPeq}>+ Añadir tramo</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onCancelar} disabled={busy} style={{ ...btnPeq, padding: '9px 16px' }}>Cancelar</button>
          <button
            type="button"
            onClick={guardar}
            disabled={busy}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {busy ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
  )
}
