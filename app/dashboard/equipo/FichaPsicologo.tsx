'use client'

import { useEffect, useState } from 'react'
import { resumenHorario } from '@/lib/horarios'
import { ETIQUETA_TIPO, TIPOS_CONSULTA } from '@/lib/pacientes-tipos'
import type { TipoCita } from '@/types/database'
import { ActionButton, Interruptor, input, type CentroGestion, type PsicologoGestion } from '../_components/gestion'

type Props = {
  psicologo: PsicologoGestion
  centros: CentroGestion[]
  guardando: boolean
  // Guarda campos del psicólogo; devuelve el error o null si fue bien.
  onGuardar: (body: Record<string, unknown>) => Promise<string | null>
  onEditarHorario: () => void
  onCerrar: () => void
}

const seccion: React.CSSProperties = {
  padding: '16px 0', borderBottom: '1px solid rgba(47,90,174,0.07)', display: 'grid', gap: 14,
}
const tituloSeccion: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.07em',
}
const etiqueta: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#272626' }
const pista: React.CSSProperties = { fontSize: 11.5, color: '#8899bb', marginTop: 2, lineHeight: 1.4 }
const fila: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 16, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        border: '1.5px solid', borderColor: activo ? '#2f5aae' : 'rgba(47,90,174,0.2)',
        background: activo ? '#eef2fb' : '#fff', color: activo ? '#254d99' : '#4a5870',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Ficha lateral de un psicólogo: todo lo que define cómo trabaja.
 * Los interruptores se guardan al pulsarlos; centros, tipos y calendario se
 * guardan juntos con "Guardar cambios". Se monta con key={id}, así que al
 * cambiar de psicólogo el borrador se reinicia.
 */
export default function FichaPsicologo({ psicologo: p, centros, guardando, onGuardar, onEditarHorario, onCerrar }: Props) {
  const [centroIds, setCentroIds] = useState<string[]>(p.centro_ids)
  const [tipos, setTipos] = useState<TipoCita[]>(p.tipos_consulta)
  const [calendar, setCalendar] = useState(p.calendar_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  const cambiaCentros = !mismos(centroIds, p.centro_ids)
  const cambiaTipos = !mismos(tipos, p.tipos_consulta)
  const cambiaCalendar = calendar.trim() !== (p.calendar_id ?? '')
  const hayCambios = cambiaCentros || cambiaTipos || cambiaCalendar

  async function guardar(body: Record<string, unknown>) {
    setError(null); setGuardado(false)
    const err = await onGuardar(body)
    if (err) setError(err)
    else setGuardado(true)
    return err
  }

  async function guardarBorrador() {
    if (centroIds.length === 0) { setError('Un psicólogo necesita al menos un centro'); return }
    if (tipos.length === 0) { setError('Un psicólogo necesita al menos un tipo de consulta'); return }
    if (!calendar.trim()) { setError('El calendario de Google no puede quedar vacío'); return }
    const body: Record<string, unknown> = {}
    if (cambiaCentros) body.centro_ids = centroIds
    if (cambiaTipos) body.tipos_consulta = tipos
    if (cambiaCalendar) body.calendar_id = calendar.trim()
    await guardar(body)
  }

  function cambiarActivo() {
    if (p.activo && !window.confirm(`¿Desactivar a ${p.nombre}? Dejará de aparecer para nuevas citas. Sus citas ya dadas no cambian.`)) return
    guardar({ activo: !p.activo })
  }

  const alternar = <T extends string>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  return (
    <aside className="ficha-lateral" aria-label={`Ficha de ${p.nombre}`}>
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(47,90,174,0.13)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 20, fontWeight: 600, color: '#272626', margin: '0 0 4px' }}>{p.nombre}</h2>
          <div style={{ fontSize: 12, color: '#8899bb', overflowWrap: 'anywhere' }}>{p.email ?? 'Sin email de contacto'}</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha" style={{ border: 0, background: 'none', fontSize: 24, lineHeight: 1, color: '#667799', cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ padding: '0 22px', overflowY: 'auto', flex: 1 }}>
        <div style={seccion}>
          <h3 style={tituloSeccion}>Consulta</h3>
          <div>
            <div style={{ ...etiqueta, marginBottom: 8 }}>Centros</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {centros.map((c) => (
                <Chip key={c.id} activo={centroIds.includes(c.id)} onClick={() => setCentroIds((l) => alternar(l, c.id))}>{c.nombre}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...etiqueta, marginBottom: 8 }}>Tipos de consulta</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIPOS_CONSULTA.map((t) => (
                <Chip key={t} activo={tipos.includes(t)} onClick={() => setTipos((l) => alternar(l, t))}>{ETIQUETA_TIPO[t]}</Chip>
              ))}
            </div>
          </div>
          <div style={{ ...fila, alignItems: 'flex-start' }}>
            <div>
              <div style={etiqueta}>Horario</div>
              <div style={{ ...pista, fontSize: 12.5, color: p.horarios.length ? '#4a5870' : '#8899bb' }}>
                {p.horarios.length ? resumenHorario(p.horarios) : 'Sin horario'}
              </div>
            </div>
            <ActionButton onClick={onEditarHorario} disabled={guardando}>Editar horario</ActionButton>
          </div>
          <div style={fila}>
            <div>
              <div style={etiqueta}>Citas a las medias horas</div>
              <div style={pista}>Permite dar citas a las 9:30, 10:30…</div>
            </div>
            <Interruptor activo={!!p.citas_media_hora} disabled={guardando} etiqueta="Citas a las medias horas"
              onChange={() => guardar({ citas_media_hora: !p.citas_media_hora })} />
          </div>
        </div>

        <div style={seccion}>
          <h3 style={tituloSeccion}>Agenda</h3>
          <div style={fila}>
            <div>
              <div style={etiqueta}>Puede bloquear su agenda</div>
              <div style={pista}>Bloquear y desbloquear huecos desde su cuenta</div>
            </div>
            <Interruptor activo={!!p.puede_bloquear} disabled={guardando} etiqueta="Puede bloquear su agenda"
              onChange={() => guardar({ puede_bloquear: !p.puede_bloquear })} />
          </div>
          <div>
            <label htmlFor="ficha-calendar" style={{ ...etiqueta, display: 'block', marginBottom: 6 }}>Calendario de Google</label>
            <input id="ficha-calendar" style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              value={calendar} onChange={(e) => setCalendar(e.target.value)} placeholder="calendar_id" />
          </div>
        </div>

        <div style={{ ...seccion, borderBottom: 0 }}>
          <h3 style={tituloSeccion}>Estado</h3>
          <div style={fila}>
            <div>
              <div style={etiqueta}>Activo</div>
              <div style={pista}>Si lo desactivas deja de salir para nuevas citas. Sus citas ya dadas no cambian.</div>
            </div>
            <Interruptor activo={p.activo} disabled={guardando} etiqueta="Activo" onChange={cambiarActivo} />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(47,90,174,0.13)', display: 'grid', gap: 8 }}>
        {error && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 12, color: guardado && !hayCambios ? '#1e7d4f' : '#8899bb' }}>
            {guardando ? 'Guardando…' : guardado && !hayCambios ? '✓ Guardado' : hayCambios ? 'Tienes cambios sin guardar' : 'Contraseña y acceso, en Usuarios'}
          </span>
          <ActionButton variant="primary" onClick={guardarBorrador} disabled={!hayCambios || guardando}>Guardar cambios</ActionButton>
        </div>
      </div>
    </aside>
  )
}
