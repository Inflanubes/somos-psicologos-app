'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Psicologo, Centro } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────
type PacienteBase = {
  id: string
  nombre: string
  telefono: string
  email: string
  estado: string
  psicologo_id: string | null
  centro_id: string | null
  fecha_cambio_estado: string | null
}

type PacienteConExtra = PacienteBase & {
  psicologo_nombre: string
  centro_nombre: string
  dias_espera: number
}

type Tab = 'psicologo' | 'dudoso' | 'espera' | 'sin-disp'

const MENSAJES_ESPERA: Record<string, string> = {
  'En espera':
    'Hola {{nombre}}, sabemos que estás en lista de espera. Nos pondremos en contacto contigo lo antes posible. ¡Gracias por tu paciencia!',
  'Cambio solicitado':
    'Hola {{nombre}}, hemos recibido tu solicitud de cambio y la estamos gestionando. Te avisamos en cuanto esté resuelto.',
  'Psicólogo sin disponibilidad':
    'Hola {{nombre}}, tu psicólogo no tiene disponibilidad en este momento. Estamos buscando la mejor solución para ti y te contactaremos pronto.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function diasDesde(fecha: string | null): number {
  if (!fecha) return 0
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
}

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    amber: { bg: '#fef3c7', fg: '#92400e' },
    red: { bg: '#fee2e2', fg: '#991b1b' },
    blue: { bg: '#dbeafe', fg: '#1e40af' },
    gray: { bg: '#f3f4f6', fg: '#374151' },
  }
  const c = colors[color] ?? colors.gray
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 10,
      fontSize: 11.5,
      fontWeight: 600,
      background: c.bg,
      color: c.fg,
    }}>
      {text}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MensajesPage() {
  const [tab, setTab] = useState<Tab>('psicologo')
  const [pacientes, setPacientes] = useState<PacienteConExtra[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)

  // dudoso messages
  const [mensajesDudoso, setMensajesDudoso] = useState<Record<string, string>>({})
  // sending state
  const [enviando, setEnviando] = useState<Record<string, boolean>>({})
  const [enviados, setEnviados] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const [{ data: pac }, { data: psi }, { data: cen }] = await Promise.all([
        supabase
          .from('pacientes')
          .select('id,nombre,telefono,email,estado,psicologo_id,centro_id,fecha_cambio_estado')
          .in('estado', [
            'Psicólogo',
            'En espera',
            'Cambio solicitado',
            'Psicólogo sin disponibilidad',
            'Sin disponibilidad',
            'Dudoso',
            'Dudoso contactado',
          ]),
        supabase.from('psicologos').select('*'),
        supabase.from('centros').select('*'),
      ])

      const psiList = (psi ?? []) as Psicologo[]
      const cenList = (cen ?? []) as Centro[]
      const psiMap = Object.fromEntries(psiList.map(p => [p.id, p.nombre]))
      const cenMap = Object.fromEntries(cenList.map(c => [c.id, c.nombre]))

      const lista: PacienteConExtra[] = (pac ?? []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        telefono: p.telefono,
        email: p.email ?? '',
        estado: p.estado,
        psicologo_id: p.psicologo_id,
        centro_id: p.centro_id,
        fecha_cambio_estado: p.fecha_cambio_estado,
        psicologo_nombre: p.psicologo_id ? (psiMap[p.psicologo_id] ?? '—') : '—',
        centro_nombre: p.centro_id ? (cenMap[p.centro_id] ?? '—') : '—',
        dias_espera: diasDesde(p.fecha_cambio_estado),
      }))

      setPacientes(lista)
      setPsicologos(psiList)
      setCentros(cenList)
      setLoading(false)
    }
    load()
  }, [])

  // Patients with estado 'Psicólogo' are those waiting for a psychologist callback
  const pacientesPsicologo = pacientes.filter(p => p.estado === 'Psicólogo')

  const pacientesDudoso = pacientes.filter(
    p => p.estado === 'Dudoso' || p.estado === 'Dudoso contactado'
  )
  const pacientesEspera = pacientes.filter(
    p => ['En espera', 'Cambio solicitado', 'Psicólogo sin disponibilidad'].includes(p.estado)
  )
  const pacientesSinDisp = pacientes.filter(p => p.estado === 'Sin disponibilidad')

  // ── Update patient in Supabase after sending ─────────────────────────────
  async function actualizarPaciente(pacienteId: string, tipo: 'psicologo' | 'dudoso' | 'espera' | 'sin-disp') {
    const ahora = new Date().toISOString()
    if (tipo === 'dudoso') {
      await supabase
        .from('pacientes')
        .update({ estado: 'Dudoso contactado', fecha_cambio_estado: ahora })
        .eq('id', pacienteId)
      // Also log in historial_estados
      await supabase.from('historial_estados').insert({
        paciente_id: pacienteId,
        estado_anterior: 'Dudoso',
        estado_nuevo: 'Dudoso contactado',
        fecha_cambio: ahora,
        origen: 'comunicaciones',
        comentario: 'Contactado desde panel de comunicaciones',
      })
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId
          ? { ...p, estado: 'Dudoso contactado', fecha_cambio_estado: ahora }
          : p
      ))
    } else if (tipo === 'sin-disp') {
      await supabase
        .from('pacientes')
        .update({ estado: 'En espera', fecha_cambio_estado: ahora })
        .eq('id', pacienteId)
      await supabase.from('historial_estados').insert({
        paciente_id: pacienteId,
        estado_anterior: 'Sin disponibilidad',
        estado_nuevo: 'En espera',
        fecha_cambio: ahora,
        origen: 'comunicaciones',
        comentario: 'Movido a En espera desde panel de comunicaciones',
      })
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId
          ? { ...p, estado: 'En espera', fecha_cambio_estado: ahora, dias_espera: 0 }
          : p
      ))
    } else if (tipo === 'espera') {
      // For 'espera': reset fecha_cambio_estado to record when they were last contacted
      await supabase
        .from('pacientes')
        .update({ fecha_cambio_estado: ahora })
        .eq('id', pacienteId)
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId
          ? { ...p, fecha_cambio_estado: ahora, dias_espera: 0 }
          : p
      ))
    }
    // For 'psicologo': no Supabase update — keep the date so days-waiting counter stays accurate

  }

  // ── Send webhook ─────────────────────────────────────────────────────────
  async function enviar(id: string, payload: Record<string, unknown> & { tipo: string }, pacienteId?: string) {
    setEnviando(prev => ({ ...prev, [id]: true }))
    try {
      await fetch('/api/webhook/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setEnviados(prev => ({ ...prev, [id]: true }))
      // Update Supabase after successful send
      if (pacienteId) {
        const tipo = payload.tipo === 'mensaje_dudoso' ? 'dudoso'
          : payload.tipo === 'notificar_psicologo' ? 'psicologo'
          : payload.tipo === 'mensaje_sin_disponibilidad' ? 'sin-disp'
          : 'espera'
        await actualizarPaciente(pacienteId, tipo)
      }
    } catch {
      alert('Error al enviar el mensaje.')
    }
    setEnviando(prev => ({ ...prev, [id]: false }))
  }

  async function enviarTodosEspera(estado: string) {
    const lista = pacientesEspera.filter(p => p.estado === estado)
    const mensajeBase = MENSAJES_ESPERA[estado] ?? ''
    for (const p of lista) {
      const mensaje = mensajeBase.replace('{{nombre}}', p.nombre.split(' ')[0])
      await enviar(`espera-${p.id}`, {
        tipo: 'mensaje_espera',
        estado,
        paciente: { nombre: p.nombre, telefono: p.telefono, email: p.email },
        mensaje,
      }, p.id)
    }
  }

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'psicologo', label: 'Hablar con Psicólogo', count: pacientesPsicologo.length, color: '#f59e0b' },
    { key: 'dudoso', label: 'Dudosos', count: pacientesDudoso.length, color: '#6366f1' },
    { key: 'espera', label: 'En Espera', count: pacientesEspera.length, color: '#2f5aae' },
    { key: 'sin-disp', label: 'Sin disponibilidad', count: pacientesSinDisp.length, color: '#dc2626' },
  ]

  return (
    <div className="page-pad" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
          fontSize: 26,
          fontWeight: 600,
          color: '#272626',
          margin: 0,
          marginBottom: 6,
        }}>
          Comunicaciones
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Envía mensajes a pacientes y psicólogos según su estado
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        borderBottom: '2px solid rgba(47,90,174,0.1)',
        marginBottom: 28,
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#272626' : '#667799',
              borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'color 0.15s',
            }}
          >
            {t.label}
            <span style={{
              padding: '1px 7px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              background: tab === t.key ? t.color : '#e8eded',
              color: tab === t.key ? '#fff' : '#667799',
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#8899bb', fontSize: 14 }}>Cargando...</div>
      ) : (
        <>
          {/* ── Tab: Hablar con psicólogo ── */}
          {tab === 'psicologo' && (
            <div>
              <p style={{ fontSize: 13, color: '#667799', marginBottom: 20 }}>
                Pacientes que llevan más de 1 día esperando que un psicólogo les llame.
                El mensaje se envía <strong>al psicólogo</strong> con los datos del paciente.
              </p>
              {pacientesPsicologo.length === 0 ? (
                <Empty text="No hay pacientes pendientes de llamada" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pacientesPsicologo.map(p => (
                    <Card key={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#272626', marginBottom: 4 }}>{p.nombre}</div>
                          <div style={{ fontSize: 13, color: '#4a5870' }}>📞 {p.telefono} · {p.centro_nombre}</div>
                          <div style={{ fontSize: 13, color: '#4a5870', marginTop: 2 }}>
                            Psicólogo asignado: <strong>{p.psicologo_nombre}</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge text={`${p.dias_espera} día${p.dias_espera !== 1 ? 's' : ''} esperando`} color="amber" />
                          {enviados[p.id] ? (
                            <Badge text="✓ Enviado" color="blue" />
                          ) : (
                            <SendButton
                              loading={enviando[p.id]}
                              label="Notificar psicólogo"
                              onClick={() => {
                                const psi = psicologos.find(ps => ps.id === p.psicologo_id)
                                enviar(p.id, {
                                  // sin tilde: el filtro del router de Make compara texto exacto
                                  tipo: 'notificar_psicologo',
                                  paciente: { nombre: p.nombre, telefono: p.telefono, email: p.email },
                                  psicologo: { nombre: p.psicologo_nombre, telefono: psi?.telefono ?? null },
                                  centro: p.centro_nombre,
                                  dias_espera: p.dias_espera,
                                  mensaje: `Tienes una llamada pendiente con ${p.nombre} (${p.telefono}). Llevan ${p.dias_espera} día(s) esperando.`,
                                }, p.id)
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Dudosos ── */}
          {tab === 'dudoso' && (
            <div>
              <p style={{ fontSize: 13, color: '#667799', marginBottom: 20 }}>
                Pacientes indecisos. Escribe un mensaje personalizado para cada uno
                y se enviará al <strong>número del paciente</strong>.
              </p>
              {pacientesDudoso.length === 0 ? (
                <Empty text="No hay pacientes dudosos" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pacientesDudoso.map(p => (
                    <Card key={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 200 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#272626', marginBottom: 4 }}>{p.nombre}</div>
                          <div style={{ fontSize: 13, color: '#4a5870' }}>📞 {p.telefono}</div>
                          <div style={{ marginTop: 6 }}>
                            <Badge text={p.estado} color={p.estado === 'Dudoso' ? 'amber' : 'gray'} />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <textarea
                            placeholder={`Hola ${p.nombre.split(' ')[0]}, quería preguntarte si...`}
                            value={mensajesDudoso[p.id] ?? ''}
                            onChange={e => setMensajesDudoso(prev => ({ ...prev, [p.id]: e.target.value }))}
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #d4e0e0',
                              fontSize: 13,
                              color: '#272626',
                              resize: 'vertical',
                              outline: 'none',
                              boxSizing: 'border-box',
                              fontFamily: 'inherit',
                            }}
                          />
                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                            {enviados[p.id] ? (
                              <Badge text="✓ Enviado" color="blue" />
                            ) : (
                              <SendButton
                                loading={enviando[p.id]}
                                disabled={!mensajesDudoso[p.id]?.trim()}
                                label="Enviar mensaje"
                                onClick={() => enviar(p.id, {
                                  tipo: 'mensaje_dudoso',
                                  paciente: { nombre: p.nombre, telefono: p.telefono, email: p.email },
                                  estado: p.estado,
                                  mensaje: mensajesDudoso[p.id],
                                }, p.id)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Sin disponibilidad ── */}
          {tab === 'sin-disp' && (
            <div>
              <p style={{ fontSize: 13, color: '#667799', marginBottom: 20 }}>
                Pacientes sin disponibilidad. Al pulsar el botón se envía un mensaje al
                paciente y su estado pasa a <strong>En espera</strong>.
              </p>
              {pacientesSinDisp.length === 0 ? (
                <Empty text="No hay pacientes sin disponibilidad" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pacientesSinDisp.map(p => {
                    const nombrePila = p.nombre.split(' ')[0]
                    const mensaje = `Hola ${nombrePila}, sigues en lista de espera para una cita en ${p.centro_nombre}. Te avisaremos en cuanto haya disponibilidad.`
                    return (
                      <Card key={p.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#272626', marginBottom: 4 }}>{p.nombre}</div>
                            <div style={{ fontSize: 13, color: '#4a5870' }}>📞 {p.telefono} · {p.centro_nombre}</div>
                            <div style={{ fontSize: 13, color: '#4a5870', marginTop: 2 }}>
                              Psicólogo asignado: <strong>{p.psicologo_nombre}</strong>
                            </div>
                            <div style={{
                              marginTop: 10,
                              background: '#f7f9f9',
                              border: '1px solid rgba(47,90,174,0.12)',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 12.5,
                              color: '#4a5870',
                              fontStyle: 'italic',
                            }}>
                              {mensaje}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {enviados[p.id] ? (
                              <Badge text="✓ Movido a En espera" color="blue" />
                            ) : (
                              <SendButton
                                loading={enviando[p.id]}
                                label="Mover a En espera"
                                onClick={() => enviar(p.id, {
                                  tipo: 'mensaje_sin_disponibilidad',
                                  paciente: { nombre: p.nombre, telefono: p.telefono, email: p.email },
                                  centro: p.centro_nombre,
                                  mensaje,
                                }, p.id)}
                              />
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: En espera ── */}
          {tab === 'espera' && (
            <div>
              <p style={{ fontSize: 13, color: '#667799', marginBottom: 20 }}>
                Mensajes estándar enviados automáticamente a cada paciente.
                Make personaliza el nombre en cada envío.
              </p>
              {(['En espera', 'Cambio solicitado', 'Psicólogo sin disponibilidad'] as const).map(estado => {
                const lista = pacientesEspera.filter(p => p.estado === estado)
                if (lista.length === 0) return null
                const allSent = lista.every(p => enviados[`espera-${p.id}`])
                return (
                  <div key={estado} style={{ marginBottom: 28 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#272626' }}>{estado}</span>
                        <span style={{ fontSize: 13, color: '#8899bb', marginLeft: 8 }}>{lista.length} paciente{lista.length !== 1 ? 's' : ''}</span>
                      </div>
                      {allSent ? (
                        <Badge text="✓ Todos enviados" color="blue" />
                      ) : (
                        <SendButton
                          label={`Enviar a todos (${lista.length})`}
                          loading={lista.some(p => enviando[`espera-${p.id}`])}
                          onClick={() => enviarTodosEspera(estado)}
                        />
                      )}
                    </div>
                    {/* Preview message */}
                    <div style={{
                      background: '#f7f9f9',
                      border: '1px solid rgba(47,90,174,0.12)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#4a5870',
                      marginBottom: 12,
                      fontStyle: 'italic',
                    }}>
                      {MENSAJES_ESPERA[estado]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lista.map(p => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 16px',
                            background: '#fff',
                            borderRadius: 8,
                            border: '1px solid rgba(47,90,174,0.1)',
                            fontSize: 13,
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500, color: '#272626' }}>{p.nombre}</span>
                            <span style={{ color: '#8899bb', marginLeft: 10 }}>📞 {p.telefono}</span>
                          </div>
                          {enviados[`espera-${p.id}`] ? (
                            <Badge text="✓ Enviado" color="blue" />
                          ) : (
                            <SendButton
                              small
                              loading={enviando[`espera-${p.id}`]}
                              label="Enviar"
                              onClick={() => {
                                const mensaje = (MENSAJES_ESPERA[estado] ?? '').replace('{{nombre}}', p.nombre.split(' ')[0])
                                enviar(`espera-${p.id}`, {
                                  tipo: 'mensaje_espera',
                                  estado,
                                  paciente: { nombre: p.nombre, telefono: p.telefono, email: p.email },
                                  mensaje,
                                }, p.id)
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      border: '1px solid rgba(47,90,174,0.13)',
      padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(47,90,174,0.05)',
    }}>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 20px',
      color: '#8899bb',
      fontSize: 14,
      background: '#fff',
      borderRadius: 10,
      border: '1px solid rgba(47,90,174,0.1)',
    }}>
      {text}
    </div>
  )
}

function SendButton({
  label, loading, onClick, disabled, small,
}: {
  label: string
  loading?: boolean
  onClick?: () => void
  disabled?: boolean
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        padding: small ? '5px 12px' : '7px 16px',
        borderRadius: 30,
        border: 'none',
        background: loading || disabled ? '#a0b0cc' : '#2f5aae',
        color: '#fff',
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
        fontFamily: '"Varela Round", inherit',
        boxShadow: '0 4px 14px rgba(47,90,174,0.30)',
      }}
    >
      {loading ? 'Enviando...' : label}
    </button>
  )
}
