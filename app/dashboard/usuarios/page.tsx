'use client'

import { Fragment, useEffect, useRef, useState } from 'react'

// Tabla con scroll horizontal y una segunda barra de scroll ARRIBA sincronizada,
// para poder desplazarse aunque haya muchas filas (la barra de abajo queda fuera de pantalla).
function ScrollBox({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const activo = useRef<'top' | 'bottom' | null>(null)

  useEffect(() => {
    const bottom = bottomRef.current
    const spacer = spacerRef.current
    if (!bottom || !spacer) return
    const update = () => { spacer.style.width = bottom.scrollWidth + 'px' }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(bottom)
    if (bottom.firstElementChild) ro.observe(bottom.firstElementChild)
    return () => ro.disconnect()
  })

  const onTop = () => {
    if (activo.current === 'bottom') return
    activo.current = 'top'
    if (topRef.current && bottomRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft
    activo.current = null
  }
  const onBottom = () => {
    if (activo.current === 'top') return
    activo.current = 'bottom'
    if (topRef.current && bottomRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft
    activo.current = null
  }

  return (
    <>
      <div ref={topRef} onScroll={onTop} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      <div ref={bottomRef} onScroll={onBottom} style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </>
  )
}

type Psicologo = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; calendar_id: string | null; activo: boolean
  puede_bloquear: boolean | null
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

// Botones de acción con aspecto de botón real y transición al pasar el ratón.
const btnBase: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  fontFamily: 'inherit', border: '1.5px solid', whiteSpace: 'nowrap',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
}
const btnVariants = {
  default: {
    normal: { borderColor: 'rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae' },
    hover:  { borderColor: '#2f5aae', background: '#eef2fb', color: '#254d99' },
  },
  success: {
    normal: { borderColor: 'rgba(30,125,79,0.4)', background: '#fff', color: '#1e7d4f' },
    hover:  { borderColor: '#1e7d4f', background: '#eafaf1', color: '#155f3b' },
  },
  danger: {
    normal: { borderColor: 'rgba(185,28,28,0.3)', background: '#fff', color: '#b91c1c' },
    hover:  { borderColor: '#b91c1c', background: '#fef2f2', color: '#991b1b' },
  },
} as const

function ActionButton({ children, onClick, disabled, variant = 'default', title }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: keyof typeof btnVariants
  title?: string
}) {
  const [hover, setHover] = useState(false)
  const v = btnVariants[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnBase,
        ...(hover && !disabled ? v.hover : v.normal),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function UsuariosPage() {
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Resultado de un alta o restablecimiento, para mostrarlo una vez.
  // emailSent = se envió el email; password = contraseña temporal de respaldo.
  const [resultado, setResultado] = useState<
    { email: string; password?: string; emailSent?: boolean; contexto: 'alta' | 'reset' } | null
  >(null)

  // Formulario de alta
  const [tipo, setTipo] = useState<Tipo>('psicologo')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [centroId, setCentroId] = useState('')
  // Un psicólogo puede trabajar en varios centros (mismo calendario): se crea una fila
  // en `psicologos` por cada uno. Los agentes siguen teniendo un solo centro.
  const [centroIds, setCentroIds] = useState<string[]>([])

  function toggleCentroAlta(id: string) {
    setCentroIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

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
    if (tipo === 'psicologo' && centroIds.length === 0) { setError('Selecciona al menos un centro para el psicólogo'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nombre, email,
          telefono: telefono || null,
          centro_id: tipo === 'psicologo' ? centroIds[0] ?? null : centroId || null,
          centro_ids: tipo === 'psicologo' ? centroIds : null,
          calendar_id: tipo === 'psicologo' ? calendarId : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setResultado({ email: data.email ?? email, password: data.password, emailSent: data.emailSent, contexto: 'alta' })
      setNombre(''); setEmail(''); setTelefono(''); setCalendarId(''); setCentroId(''); setCentroIds([])
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

  // Permite / quita que el psicólogo pueda bloquear y desbloquear su agenda.
  // Se aplica a todas sus fichas de centro en el servidor.
  async function toggleBloqueo(id: string, actual: boolean) {
    await patchUsuario(id, { tipo: 'psicologo', puede_bloquear: !actual })
  }

  async function editarCalendario(id: string, actual: string | null) {
    const nuevo = window.prompt('Nuevo calendar_id:', actual ?? '')
    if (nuevo === null) return
    if (!nuevo.trim()) { setError('El calendar_id no puede quedar vacío'); return }
    await patchUsuario(id, { tipo: 'psicologo', calendar_id: nuevo.trim() })
  }

  async function restablecer(t: Tipo, id: string, metodo: 'email' | 'generar') {
    const confirmMsg = metodo === 'email'
      ? '¿Enviar a este usuario un email para que cree su contraseña?'
      : '¿Generar una contraseña temporal? La anterior dejará de funcionar y tendrás que entregársela tú al usuario.'
    if (!window.confirm(confirmMsg)) return
    setBusy(true); setError(null)
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
      setBusy(false)
    }
  }

  const centroMap = Object.fromEntries(centros.map((c) => [c.id, c.nombre]))
  const psicologosFiltrados =
    filtroCentro === 'todos' ? psicologos : psicologos.filter((p) => p.centro_id === filtroCentro)

  const pill = (activo: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
    borderColor: activo ? '#2f5aae' : 'rgba(47,90,174,0.2)',
    background: activo ? '#eef2fb' : '#fff', color: activo ? '#254d99' : '#4a5870',
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div className="page-pad" style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: 0, marginBottom: 6 }}>
          Usuarios
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Crea accesos, gestiona calendarios y genera contraseñas
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {resultado && (
        <div style={{ background: '#eef2fb', border: '1.5px solid #2f5aae', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
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
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {resultado.password && (
                <button
                  onClick={() => navigator.clipboard?.writeText(`Email: ${resultado.email}\nContraseña: ${resultado.password}`)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #2f5aae', background: '#fff', color: '#254d99', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Copiar
                </button>
              )}
              <button
                onClick={() => setResultado(null)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Hecho
              </button>
            </div>
          </div>
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
            <div style={{ fontSize: 11.5, color: '#8899bb', marginTop: 8 }}>
              Si trabaja en más de un centro se crea una ficha por centro, todas con el mismo email y el mismo calendario.
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
        <button type="submit" disabled={busy} style={{ justifySelf: 'start', padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creando...' : 'Crear y enviar acceso'}
        </button>
      </form>

      {/* Listas */}
      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#8899bb', fontSize: 14 }}>Cargando...</div>
      ) : (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Psicólogos</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => setFiltroCentro('todos')} style={pill(filtroCentro === 'todos')}>Todos los centros</button>
            {centros.map((c) => (
              <button key={c.id} onClick={() => setFiltroCentro(c.id)} style={pill(filtroCentro === c.id)}>{c.nombre}</button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#667799', margin: '0 0 12px' }}>
            {psicologosFiltrados.filter((p) => p.activo).length} activo{psicologosFiltrados.filter((p) => p.activo).length !== 1 ? 's' : ''} de {psicologosFiltrados.length} psicólogo{psicologosFiltrados.length !== 1 ? 's' : ''}
          </p>
          <div style={card}>
            <ScrollBox>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Centro', 'Email', 'Calendario', 'Estado'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {psicologosFiltrados.length === 0 ? (
                  <tr><td style={{ ...td, textAlign: 'center', color: '#8899bb' }} colSpan={5}>No hay psicólogos en este centro</td></tr>
                ) : psicologosFiltrados.map((p) => (
                  <Fragment key={p.id}>
                    <tr style={{ borderTop: '1px solid rgba(47,90,174,0.12)' }}>
                      <td style={{ ...td, paddingBottom: 6, fontWeight: 500, color: '#272626' }}>{p.nombre}</td>
                      <td style={{ ...td, paddingBottom: 6 }}>{centroMap[p.centro_id ?? ''] ?? '—'}</td>
                      <td style={{ ...td, paddingBottom: 6 }}>{p.email ?? '—'}</td>
                      <td style={{ ...td, paddingBottom: 6, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.calendar_id ?? '—'}</td>
                      <td style={{ ...td, paddingBottom: 6, whiteSpace: 'nowrap' }}>
                        <div>{p.activo ? 'Activo' : 'Inactivo'}</div>
                        <div style={{ fontSize: 11.5, color: p.puede_bloquear ? '#1e7d4f' : '#8899bb', marginTop: 2 }}>
                          {p.puede_bloquear ? '✓ Puede bloquear agenda' : 'Sin bloqueo de agenda'}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} style={{ padding: '0 20px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <ActionButton onClick={() => editarCalendario(p.id, p.calendar_id)} disabled={busy} title="Cambiar el calendario de Google del psicólogo">Calendario</ActionButton>
                          <ActionButton onClick={() => restablecer('psicologo', p.id, 'email')} disabled={busy} title="Enviar email para que el usuario cree su contraseña">Enviar acceso</ActionButton>
                          <ActionButton onClick={() => restablecer('psicologo', p.id, 'generar')} disabled={busy} title="Generar una contraseña temporal para entregar tú">Generar</ActionButton>
                          <ActionButton onClick={() => toggleBloqueo(p.id, !!p.puede_bloquear)} disabled={busy} variant={p.puede_bloquear ? 'default' : 'success'} title="Permitir o quitar que este psicólogo pueda bloquear y desbloquear su agenda">{p.puede_bloquear ? 'Quitar bloqueo' : 'Permitir bloqueo'}</ActionButton>
                          <ActionButton onClick={() => toggleActivo('psicologo', p.id, p.activo)} disabled={busy} variant={p.activo ? 'danger' : 'success'}>{p.activo ? 'Desactivar' : 'Activar'}</ActionButton>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            </ScrollBox>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Agentes</h2>
          <div style={card}>
            <ScrollBox>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Estado'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {agentes.map((a) => (
                  <Fragment key={a.id}>
                    <tr style={{ borderTop: '1px solid rgba(47,90,174,0.12)' }}>
                      <td style={{ ...td, paddingBottom: 6, fontWeight: 500, color: '#272626' }}>{a.nombre}</td>
                      <td style={{ ...td, paddingBottom: 6 }}>{a.email ?? '—'}</td>
                      <td style={{ ...td, paddingBottom: 6 }}>{a.telefono ?? '—'}</td>
                      <td style={{ ...td, paddingBottom: 6 }}>{a.activo ? 'Activo' : 'Inactivo'}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ padding: '0 20px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <ActionButton onClick={() => restablecer('agente', a.id, 'email')} disabled={busy} title="Enviar email para que el usuario cree su contraseña">Enviar acceso</ActionButton>
                          <ActionButton onClick={() => restablecer('agente', a.id, 'generar')} disabled={busy} title="Generar una contraseña temporal para entregar tú">Generar</ActionButton>
                          <ActionButton onClick={() => toggleActivo('agente', a.id, a.activo)} disabled={busy} variant={a.activo ? 'danger' : 'success'}>{a.activo ? 'Desactivar' : 'Activar'}</ActionButton>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            </ScrollBox>
          </div>
        </>
      )}
    </div>
  )
}
