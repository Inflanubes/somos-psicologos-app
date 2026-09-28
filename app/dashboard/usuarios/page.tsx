'use client'

import { useEffect, useState } from 'react'
import { ETIQUETA_TIPO, TIPOS_CONSULTA } from '@/lib/pacientes-tipos'
import type { TipoCita } from '@/types/database'
import {
  ActionButton, Aviso, EstadoBadge, FilasEsqueleto, Interruptor, card, cargarGestion, h1, input, patchUsuario,
  subtitulo, td, th,
  type AgenteGestion, type CentroGestion, type PsicologoGestion, type TipoUsuario,
} from '../_components/gestion'

// Usuarios: solo cuentas para entrar en la app (alta, enviar acceso, contraseña
// temporal y activar agentes / call center). Cómo trabaja cada psicólogo
// (centros, horario, permisos de agenda…) se gestiona en Psicólogos (/dashboard/equipo).

const PESTANAS: { tipo: TipoUsuario; etiqueta: string; singular: string }[] = [
  { tipo: 'psicologo', etiqueta: 'Psicólogos', singular: 'Psicólogo' },
  { tipo: 'agente', etiqueta: 'Agentes', singular: 'Agente' },
  { tipo: 'call_center', etiqueta: 'Call center', singular: 'Call center' },
]

export default function UsuariosPage() {
  const [psicologos, setPsicologos] = useState<PsicologoGestion[]>([])
  const [agentes, setAgentes] = useState<AgenteGestion[]>([])
  const [callCenter, setCallCenter] = useState<AgenteGestion[]>([])
  const [centros, setCentros] = useState<CentroGestion[]>([])
  const [pestana, setPestana] = useState<TipoUsuario>('psicologo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Filas con una operación en curso: solo se bloquean esas.
  const [ocupados, setOcupados] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [mostrarAlta, setMostrarAlta] = useState(false)
  // Resultado de un alta o restablecimiento, para mostrarlo una vez.
  // emailSent = se envió el email; password = contraseña temporal de respaldo.
  const [resultado, setResultado] = useState<
    { email: string; password?: string; emailSent?: boolean; contexto: 'alta' | 'reset' } | null
  >(null)

  // Formulario de alta
  const [tipo, setTipo] = useState<TipoUsuario>('psicologo')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [centroId, setCentroId] = useState('')
  // Un psicólogo es una sola ficha con varios centros y varios tipos de consulta.
  // Los agentes siguen teniendo un solo centro.
  const [centroIds, setCentroIds] = useState<string[]>([])
  const [tiposConsulta, setTiposConsulta] = useState<TipoCita[]>(['adulto'])

  function toggleCentroAlta(id: string) {
    setCentroIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }
  function toggleTipoAlta(t: TipoCita) {
    setTiposConsulta((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  // Sin esqueleto al recargar tras un alta: la tabla se queda y se actualiza al llegar.
  async function cargar() {
    const { datos, error } = await cargarGestion()
    if (datos) {
      setPsicologos(datos.psicologos)
      setAgentes(datos.agentes)
      setCallCenter(datos.call_center)
      setCentros(datos.centros)
    }
    if (error) setError(error)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function marcar(id: string, si: boolean) {
    setOcupados((s) => { const n = new Set(s); if (si) n.add(id); else n.delete(id); return n })
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (tipo === 'psicologo' && centroIds.length === 0) { setError('Selecciona al menos un centro para el psicólogo'); return }
    if (tipo === 'psicologo' && tiposConsulta.length === 0) { setError('Selecciona al menos un tipo de consulta'); return }
    setCreando(true); setError(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, email,
          telefono: telefono || null,
          centro_id: tipo === 'psicologo' ? null : centroId || null,
          centro_ids: tipo === 'psicologo' ? centroIds : null,
          tipos_consulta: tipo === 'psicologo' ? tiposConsulta : null,
          calendar_id: tipo === 'psicologo' ? calendarId : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setResultado({ email: data.email ?? email, password: data.password, emailSent: data.emailSent, contexto: 'alta' })
      setNombre(''); setEmail(''); setTelefono(''); setCalendarId(''); setCentroId(''); setCentroIds([]); setTiposConsulta(['adulto'])
      setMostrarAlta(false)
      setPestana(tipo)
      await cargar()
    } catch {
      setError('Error de conexión al crear')
    } finally {
      setCreando(false)
    }
  }

  async function toggleActivoAgente(t: 'agente' | 'call_center', a: AgenteGestion) {
    if (a.activo && !window.confirm(`¿Desactivar a ${a.nombre}? Quedará marcado como inactivo, pero podrá seguir entrando en la app.`)) return
    marcar(a.id, true); setError(null)
    const err = await patchUsuario(a.id, { tipo: t, activo: !a.activo })
    marcar(a.id, false)
    if (err) { setError(err); return }
    const actualizar = (lista: AgenteGestion[]) => lista.map((x) => (x.id === a.id ? { ...x, activo: !a.activo } : x))
    if (t === 'agente') setAgentes(actualizar)
    else setCallCenter(actualizar)
  }

  async function restablecer(t: TipoUsuario, id: string, metodo: 'email' | 'generar') {
    const confirmMsg = metodo === 'email'
      ? '¿Enviar a este usuario un email para que cree su contraseña?'
      : '¿Generar una contraseña temporal? La anterior dejará de funcionar y tendrás que entregársela tú al usuario.'
    if (!window.confirm(confirmMsg)) return
    marcar(id, true); setError(null)
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: t, metodo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo restablecer el acceso'); return }
      setResultado({ email: data.email, password: data.password, emailSent: metodo === 'email', contexto: 'reset' })
    } catch {
      setError('Error de conexión al restablecer el acceso')
    } finally {
      marcar(id, false)
    }
  }

  function botonesAcceso(t: TipoUsuario, id: string) {
    const ocupado = ocupados.has(id)
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <ActionButton onClick={() => restablecer(t, id, 'email')} disabled={ocupado} title="Enviar email para que el usuario cree su contraseña">Enviar acceso</ActionButton>
        <ActionButton onClick={() => restablecer(t, id, 'generar')} disabled={ocupado} title="Generar una contraseña temporal para entregar tú">Generar contraseña</ActionButton>
      </div>
    )
  }

  const nombreCentro = new Map(centros.map((c) => [c.id, c.nombre]))
  const cuenta: Record<TipoUsuario, number> = { psicologo: psicologos.length, agente: agentes.length, call_center: callCenter.length }
  const listaAgentes = pestana === 'agente' ? agentes : callCenter

  return (
    <div className="page-pad" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={h1}>Usuarios</h1>
          <p style={subtitulo}>Cuentas para entrar en la app: altas, accesos y contraseñas</p>
        </div>
        <ActionButton variant={mostrarAlta ? 'default' : 'primary'} onClick={() => setMostrarAlta((v) => !v)}>
          {mostrarAlta ? 'Cerrar' : '+ Nuevo usuario'}
        </ActionButton>
      </div>

      {error && <Aviso tipo="error" onCerrar={() => setError(null)}>{error}</Aviso>}

      {resultado && (
        <div style={{ background: '#eef2fb', border: '1.5px solid #2f5aae', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#254d99', marginBottom: 8 }}>
                {resultado.contexto === 'alta' ? 'Usuario creado' : 'Acceso restablecido'}
              </div>
              <div style={{ fontSize: 13, color: '#3a4a6b', marginBottom: 6 }}>
                <strong>Email:</strong> <span style={{ fontFamily: 'monospace' }}>{resultado.email}</span>
              </div>

              {resultado.emailSent && (
                <div style={{ fontSize: 13, color: '#1e7d4f', fontWeight: 600, marginBottom: 6 }}>
                  📧 Le hemos enviado un email para que cree su propia contraseña.
                </div>
              )}

              {resultado.password && (
                <div style={{ fontSize: 13, color: '#3a4a6b' }}>
                  <strong>{resultado.emailSent ? 'Contraseña temporal de respaldo' : 'Contraseña temporal'}:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(47,90,174,0.25)' }}>
                    {resultado.password}
                  </span>
                  {resultado.emailSent && (
                    <div style={{ fontSize: 12, color: '#667799', marginTop: 6 }}>
                      Úsala solo si el email no le llega. No volverá a mostrarse.
                    </div>
                  )}
                </div>
              )}
              {resultado.contexto === 'alta' && tipo === 'psicologo' && (
                <div style={{ fontSize: 12, color: '#667799', marginTop: 8 }}>
                  Su horario y sus permisos de agenda se configuran en Psicólogos.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {resultado.password && (
                <ActionButton onClick={() => navigator.clipboard?.writeText(`Email: ${resultado.email}\nContraseña: ${resultado.password}`)}>
                  Copiar
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={() => setResultado(null)}>Hecho</ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Alta */}
      {mostrarAlta && (
        <form onSubmit={crear} style={{ ...card, padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#272626' }}>Nuevo usuario</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {PESTANAS.map((p) => (
              <label key={p.tipo} style={{ fontSize: 13, fontWeight: 600, color: '#4a5870' }}>
                <input type="radio" checked={tipo === p.tipo} onChange={() => setTipo(p.tipo)} /> {p.singular}
              </label>
            ))}
          </div>
          {tipo === 'call_center' && (
            <div style={{ fontSize: 12, color: '#667799', background: '#eef2fb', borderRadius: 8, padding: '8px 12px' }}>
              Un usuario de call center solo ve el formulario de Citas y puede agendar, cambiar o cancelar
              citas de cualquier centro y psicólogo. Crea un acceso por persona para saber quién hizo cada cita.
            </div>
          )}
          <input style={input} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <input style={input} placeholder="Email de acceso" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          {tipo === 'psicologo' ? (
            <div style={{ border: '1px solid rgba(47,90,174,0.25)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5870', marginBottom: 8 }}>
                Centros (uno o varios)
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {centros.map((c) => (
                  <label key={c.id} style={{ fontSize: 13, color: '#4a5870', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={centroIds.includes(c.id)} onChange={() => toggleCentroAlta(c.id)} />
                    {c.nombre}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5870', margin: '12px 0 8px' }}>Tipos de consulta</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {TIPOS_CONSULTA.map((t) => (
                  <label key={t} style={{ fontSize: 13, color: '#4a5870', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={tiposConsulta.includes(t)} onChange={() => toggleTipoAlta(t)} />
                    {ETIQUETA_TIPO[t]}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#8899bb', marginTop: 8 }}>
                Una sola ficha; los centros, los tipos y el horario se cambian después en Psicólogos.
              </div>
            </div>
          ) : (
            <select style={input} value={centroId} onChange={(e) => setCentroId(e.target.value)}>
              <option value="">Centro (opcional)</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
          {tipo === 'psicologo' && (
            <input style={input} placeholder="calendar_id (Google Calendar)" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} required />
          )}
          <div>
            <ActionButton type="submit" variant="primary" disabled={creando}>
              {creando ? 'Creando…' : 'Crear y enviar acceso'}
            </ActionButton>
          </div>
        </form>
      )}

      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.tipo} type="button" role="tab" className="pestana" aria-selected={pestana === p.tipo} onClick={() => setPestana(p.tipo)}>
            {p.etiqueta}{!loading && <small>{cuenta[p.tipo]}</small>}
          </button>
        ))}
      </div>

      <div style={card}>
        {pestana === 'psicologo' ? (
          <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
              <th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Centros</th><th style={th}>Estado</th>
              <th style={{ ...th, textAlign: 'right' }}>Acceso</th>
            </tr></thead>
            <tbody>
              {loading ? <FilasEsqueleto columnas={5} /> : psicologos.length === 0 ? (
                <tr><td colSpan={5} data-label="" style={{ ...td, textAlign: 'center', color: '#8899bb', padding: 40 }}>No hay psicólogos</td></tr>
              ) : psicologos.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                  <td data-label="Nombre" style={{ ...td, fontWeight: 600, color: '#272626' }}>{p.nombre}</td>
                  <td data-label="Email" style={td}>{p.email ?? '—'}</td>
                  <td data-label="Centros" style={{ ...td, fontSize: 12, color: '#667799' }}>{p.centros_nombres.join(' · ') || '—'}</td>
                  <td data-label="Estado" style={td}><EstadoBadge activo={p.activo} title="Se cambia en Psicólogos" /></td>
                  <td data-label="" style={td}>{botonesAcceso('psicologo', p.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="r-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
              <th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Centro</th><th style={th}>Activo</th>
              <th style={{ ...th, textAlign: 'right' }}>Acceso</th>
            </tr></thead>
            <tbody>
              {loading ? <FilasEsqueleto columnas={5} /> : listaAgentes.length === 0 ? (
                <tr><td colSpan={5} data-label="" style={{ ...td, textAlign: 'center', color: '#8899bb', padding: 40 }}>
                  {pestana === 'agente' ? 'No hay agentes' : 'Todavía no hay usuarios de call center'}
                </td></tr>
              ) : listaAgentes.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                  <td data-label="Nombre" style={{ ...td, fontWeight: 600, color: '#272626' }}>{a.nombre}</td>
                  <td data-label="Email" style={td}>{a.email ?? '—'}</td>
                  <td data-label="Centro" style={{ ...td, fontSize: 12, color: '#667799' }}>{(a.centro_id && nombreCentro.get(a.centro_id)) || '—'}</td>
                  <td data-label="Activo" style={td}>
                    <Interruptor
                      activo={a.activo}
                      disabled={ocupados.has(a.id)}
                      etiqueta={`${a.activo ? 'Desactivar' : 'Activar'} a ${a.nombre}`}
                      onChange={() => toggleActivoAgente(pestana as 'agente' | 'call_center', a)}
                    />
                  </td>
                  <td data-label="" style={td}>{botonesAcceso(pestana, a.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
