'use client'

import { useCallback, useEffect, useState } from 'react'
import { resumenHorario, type Tramo } from '@/lib/horarios'
import { ETIQUETA_TIPO } from '@/lib/pacientes-tipos'
import HorarioEditor from '../_components/HorarioEditor'
import FichaPsicologo from './FichaPsicologo'
import {
  Aviso, FilasEsqueleto, Interruptor, card, cargarGestion, h1, patchUsuario, pill, subtitulo, td, th,
  type CentroGestion, type PsicologoGestion,
} from '../_components/gestion'

// Psicólogos: cómo trabaja cada uno (centros, tipos, horario, permisos de agenda,
// calendario y si está activo). Las cuentas y contraseñas están en Usuarios.
export default function EquipoPage() {
  const [psicologos, setPsicologos] = useState<PsicologoGestion[]>([])
  const [centros, setCentros] = useState<CentroGestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avisoHorarios, setAvisoHorarios] = useState<string | null>(null)
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [editandoHorario, setEditandoHorario] = useState(false)
  // Filas con un guardado en curso: solo se bloquean esas, no la página entera.
  const [guardando, setGuardando] = useState<Set<string>>(new Set())

  useEffect(() => {
    cargarGestion().then(({ datos, error }) => {
      if (datos) {
        setPsicologos(datos.psicologos)
        setCentros(datos.centros)
        setAvisoHorarios(datos.aviso_horarios)
      }
      setError(error ?? null)
      setLoading(false)
    })
  }, [])

  // Guarda y, si fue bien, actualiza solo esa fila en pantalla (sin recargar todo).
  async function guardar(id: string, body: Record<string, unknown>): Promise<string | null> {
    setGuardando((s) => new Set(s).add(id))
    const err = await patchUsuario(id, { tipo: 'psicologo', ...body })
    setGuardando((s) => { const n = new Set(s); n.delete(id); return n })
    if (err) return err
    const nombreCentro = new Map(centros.map((c) => [c.id, c.nombre]))
    setPsicologos((lista) => lista.map((p) => {
      if (p.id !== id) return p
      const nuevo = { ...p, ...body } as PsicologoGestion
      if (body.centro_ids) nuevo.centros_nombres = nuevo.centro_ids.map((c) => nombreCentro.get(c) ?? '—')
      return nuevo
    }))
    return null
  }

  async function toggleActivoFila(p: PsicologoGestion) {
    if (p.activo && !window.confirm(`¿Desactivar a ${p.nombre}? Dejará de aparecer para nuevas citas. Sus citas ya dadas no cambian.`)) return
    const err = await guardar(p.id, { activo: !p.activo })
    setError(err)
  }

  const cerrarFicha = useCallback(() => setAbiertoId(null), [])

  const filtrados = filtroCentro === 'todos' ? psicologos : psicologos.filter((p) => p.centro_ids.includes(filtroCentro))
  const activos = filtrados.filter((p) => p.activo).length
  const abierto = psicologos.find((p) => p.id === abiertoId) ?? null

  return (
    <div className={`page-pad${abierto ? ' con-ficha' : ''}`} style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={h1}>Psicólogos</h1>
        <p style={subtitulo}>Dónde, cuándo y qué consulta pasa cada psicólogo. Pulsa uno para ver y cambiar su ficha.</p>
      </div>

      {error && <Aviso tipo="error" onCerrar={() => setError(null)}>{error}</Aviso>}
      {avisoHorarios && <Aviso tipo="aviso">{avisoHorarios}</Aviso>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" onClick={() => setFiltroCentro('todos')} style={pill(filtroCentro === 'todos')}>Todos los centros</button>
        {centros.map((c) => (
          <button type="button" key={c.id} onClick={() => setFiltroCentro(c.id)} style={pill(filtroCentro === c.id)}>{c.nombre}</button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: '#667799', margin: '0 0 12px' }}>
        {loading ? ' ' : `${activos} activo${activos !== 1 ? 's' : ''} de ${filtrados.length} psicólogo${filtrados.length !== 1 ? 's' : ''}`}
      </p>

      <div style={card}>
        <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
              <th style={th}>Nombre</th>
              <th style={th}>Centros y tipos</th>
              <th style={th}>Horario</th>
              <th style={th}>Activo</th>
              <th style={th} aria-label="Abrir ficha" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <FilasEsqueleto columnas={5} />
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} data-label="" style={{ ...td, textAlign: 'center', color: '#8899bb', padding: 40 }}>No hay psicólogos en este centro</td></tr>
            ) : filtrados.map((p) => {
              const ocupado = guardando.has(p.id)
              return (
                <tr
                  key={p.id}
                  className="fila-clic"
                  onClick={() => setAbiertoId(p.id)}
                  aria-selected={p.id === abiertoId}
                  style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}
                >
                  <td data-label="Nombre" style={td}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272626' }}>{p.nombre}</div>
                    {(p.citas_media_hora || p.puede_bloquear) && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {p.citas_media_hora && <span className="etiqueta-mini" title="Puede tener citas a las medias horas">30&apos;</span>}
                        {p.puede_bloquear && <span className="etiqueta-mini ambar" title="Puede bloquear y desbloquear su agenda">Bloquea agenda</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="Centros y tipos" style={td}>
                    <div>{p.centros_nombres.length ? p.centros_nombres.join(' · ') : <span style={{ color: '#b91c1c' }}>Sin centro</span>}</div>
                    <div style={{ fontSize: 11.5, marginTop: 2, color: p.tipos_consulta.length ? '#667799' : '#b91c1c' }}>
                      {p.tipos_consulta.length ? p.tipos_consulta.map((t) => ETIQUETA_TIPO[t]).join(' · ') : 'Sin tipos de consulta'}
                    </div>
                  </td>
                  <td data-label="Horario" style={{ ...td, fontSize: 12.5 }}>
                    {p.horarios.length ? resumenHorario(p.horarios) : <span style={{ color: '#8899bb' }}>Sin horario</span>}
                  </td>
                  <td data-label="Activo" style={td}>
                    <Interruptor activo={p.activo} disabled={ocupado} etiqueta={`${p.activo ? 'Desactivar' : 'Activar'} a ${p.nombre}`} onChange={() => toggleActivoFila(p)} />
                  </td>
                  <td data-label="" style={{ ...td, textAlign: 'right', color: '#8899bb', fontSize: 18 }}>›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {abierto && (
        <FichaPsicologo
          key={abierto.id}
          psicologo={abierto}
          centros={centros}
          guardando={guardando.has(abierto.id)}
          onGuardar={(body) => guardar(abierto.id, body)}
          onEditarHorario={() => setEditandoHorario(true)}
          onCerrar={cerrarFicha}
        />
      )}

      {abierto && editandoHorario && (
        <HorarioEditor
          titulo={abierto.nombre}
          subtitulo={`Centros: ${abierto.centros_nombres.join(' · ') || '—'}. El horario es del psicólogo y vale para todos sus centros.`}
          tramosIniciales={abierto.horarios}
          busy={guardando.has(abierto.id)}
          onGuardar={async (tramos: Tramo[]) => {
            const err = await guardar(abierto.id, { horarios: tramos })
            if (err) setError(err)
            else setEditandoHorario(false)
          }}
          onCancelar={() => setEditandoHorario(false)}
        />
      )}
    </div>
  )
}
