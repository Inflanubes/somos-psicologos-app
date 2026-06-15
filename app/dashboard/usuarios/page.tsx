'use client'

import { useEffect, useState } from 'react'

type Psicologo = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; calendar_id: string | null; activo: boolean
}
type Agente = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; activo: boolean; auth_user_id: string | null
}
type Centro = { id: string; nombre: string }
type Tipo = 'psicologo' | 'agente'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', overflow: 'hidden', marginBottom: 28,
}
const th: React.CSSProperties = {
  padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#667799', textTransform: 'uppercase', letterSpacing: '0.07em',
}
const td: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#4a5870' }
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid rgba(47,90,174,0.25)', fontFamily: 'inherit',
}

export default function UsuariosPage() {
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Formulario de alta
  const [tipo, setTipo] = useState<Tipo>('psicologo')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [centroId, setCentroId] = useState('')

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Error cargando'); return }
      setPsicologos(data.psicologos)
      setAgentes(data.agentes)
      setCentros(data.centros ?? [])
    } catch {
      setError('Error de conexión al cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (tipo === 'psicologo' && !centroId) { setError('Selecciona un centro para el psicólogo'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, email,
          telefono: telefono || null,
          centro_id: centroId || null,
          calendar_id: tipo === 'psicologo' ? calendarId : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setNombre(''); setEmail(''); setTelefono(''); setCalendarId(''); setCentroId('')
      await cargar()
    } catch {
      setError('Error de conexión al crear')
    } finally {
      setBusy(false)
    }
  }

  // PATCH compartido para editar/desactivar: siempre limpia busy y muestra errores.
  async function patchUsuario(id: string, body: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo guardar el cambio')
        return
      }
      await cargar()
    } catch {
      setError('Error de conexión al guardar')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActivo(t: Tipo, id: string, activo: boolean) {
    await patchUsuario(id, { tipo: t, activo: !activo })
  }

  async function editarCalendario(id: string, actual: string | null) {
    const nuevo = window.prompt('Nuevo calendar_id:', actual ?? '')
    if (nuevo === null) return
    if (!nuevo.trim()) { setError('El calendar_id no puede quedar vacío'); return }
    await patchUsuario(id, { tipo: 'psicologo', calendar_id: nuevo.trim() })
  }

  async function reenviar(t: Tipo, id: string) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: t }),
      })
      alert(res.ok ? 'Email de acceso enviado' : 'No se pudo enviar el email')
    } catch {
      alert('Error de conexión al enviar el email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: 0, marginBottom: 6 }}>
          Usuarios
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Crea accesos, gestiona calendarios y reenvía contraseñas
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Alta */}
      <form onSubmit={crear} style={{ ...card, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5870' }}>
            <input type="radio" checked={tipo === 'psicologo'} onChange={() => setTipo('psicologo')} /> Psicólogo
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5870' }}>
            <input type="radio" checked={tipo === 'agente'} onChange={() => setTipo('agente')} /> Agente
          </label>
        </div>
        <input style={input} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input style={input} placeholder="Email de acceso" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={input} placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <select style={input} value={centroId} onChange={(e) => setCentroId(e.target.value)} required={tipo === 'psicologo'}>
          <option value="">{tipo === 'psicologo' ? 'Centro (obligatorio)' : 'Centro (opcional)'}</option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        {tipo === 'psicologo' && (
          <input style={input} placeholder="calendar_id (Google Calendar)" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} required />
        )}
        <button type="submit" disabled={busy} style={{ justifySelf: 'start', padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creando...' : 'Crear y enviar invitación'}
        </button>
      </form>

      {/* Listas */}
      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#8899bb', fontSize: 14 }}>Cargando...</div>
      ) : (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Psicólogos</h2>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Calendario', 'Estado', 'Acciones'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {psicologos.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                    <td style={{ ...td, fontWeight: 500, color: '#272626' }}>{p.nombre}</td>
                    <td style={td}>{p.email ?? '—'}</td>
                    <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.calendar_id ?? '—'}</td>
                    <td style={td}>{p.activo ? 'Activo' : 'Inactivo'}</td>
                    <td style={td}>
                      <button onClick={() => editarCalendario(p.id, p.calendar_id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Calendario</button>
                      <button onClick={() => reenviar('psicologo', p.id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Reenviar</button>
                      <button onClick={() => toggleActivo('psicologo', p.id, p.activo)} disabled={busy} style={{ cursor: 'pointer' }}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Agentes</h2>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Estado', 'Acciones'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {agentes.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                    <td style={{ ...td, fontWeight: 500, color: '#272626' }}>{a.nombre}</td>
                    <td style={td}>{a.email ?? '—'}</td>
                    <td style={td}>{a.telefono ?? '—'}</td>
                    <td style={td}>{a.activo ? 'Activo' : 'Inactivo'}</td>
                    <td style={td}>
                      <button onClick={() => reenviar('agente', a.id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Reenviar</button>
                      <button onClick={() => toggleActivo('agente', a.id, a.activo)} disabled={busy} style={{ cursor: 'pointer' }}>{a.activo ? 'Desactivar' : 'Activar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
