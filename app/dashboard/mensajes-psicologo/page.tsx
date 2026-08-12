'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getPerfilActual } from '@/lib/perfil'

// ─── Types ────────────────────────────────────────────────────────────────────
// Un psicólogo multi-centro tiene una fila en `psicologos` por centro (mismo
// email). Cada fila es una "variante"; elegir centro == elegir variante, y los
// pacientes se filtran por el psicologo_id de esa variante.
type Variante = {
  id: string
  nombre: string
  centro_id: string
  centro: string | null
}

type CentroMsg = {
  id: string
  nombre: string
  google_review_url: string | null
}

type PacienteMsg = {
  id: string
  nombre: string
  telefono: string
  email: string
}

type Modo = 'resena' | 'libre'

const PLANTILLA_RESENA =
  '¡Hola {{nombre}}! 😊 Esperamos que tu experiencia con nosotros haya sido positiva.\n\n' +
  'Si te apetece, nos ayudaría mucho que compartieras tu opinión dejando una reseña aquí {{link}}. ' +
  'Tu experiencia puede ser útil también para otras personas que estén buscando apoyo psicológico.\n\n' +
  '¡Muchas gracias por tu confianza! 💚\n\nSOMOS Psicólogos'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MensajesPsicologoPage() {
  const [variantes, setVariantes] = useState<Variante[]>([])
  const [centros, setCentros] = useState<CentroMsg[]>([])
  const [loading, setLoading] = useState(true)

  const [centroId, setCentroId] = useState('')
  const [pacientes, setPacientes] = useState<PacienteMsg[]>([])
  const [loadingPacientes, setLoadingPacientes] = useState(false)
  const [pacienteId, setPacienteId] = useState('')

  const [modo, setModo] = useState<Modo>('resena')
  const [mensajeLibre, setMensajeLibre] = useState('')

  // Keys `${modo}-${pacienteId}`: evita reenviar el mismo tipo de mensaje al
  // mismo paciente dentro de la sesión.
  const [enviando, setEnviando] = useState<Record<string, boolean>>({})
  const [enviados, setEnviados] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) {
        setLoading(false)
        return
      }

      const { data: vars } = await supabase
        .from('psicologos')
        .select('id, nombre, centro_id, centro')
        .eq('email', user.email)
        .eq('activo', true)
      let lista = (vars ?? []) as Variante[]

      // Fallback para fichas antiguas sin email: la fila que apunta el perfil.
      if (lista.length === 0) {
        const perfil = await getPerfilActual()
        if (perfil?.psicologo_id) {
          const { data: fila } = await supabase
            .from('psicologos')
            .select('id, nombre, centro_id, centro')
            .eq('id', perfil.psicologo_id)
            .maybeSingle()
          if (fila) lista = [fila as Variante]
        }
      }

      setVariantes(lista)
      if (lista.length > 0) {
        const { data: cen } = await supabase
          .from('centros')
          .select('id, nombre, google_review_url')
          .in('id', lista.map(v => v.centro_id))
        setCentros((cen ?? []) as CentroMsg[])
      }
      if (lista.length === 1) setCentroId(lista[0].centro_id)
      setLoading(false)
    }
    load()
  }, [])

  // Pacientes de la variante del centro elegido (solo con teléfono).
  useEffect(() => {
    const variante = variantes.find(v => v.centro_id === centroId)
    setPacienteId('')
    if (!variante) {
      setPacientes([])
      return
    }
    let cancelled = false
    setLoadingPacientes(true)
    supabase
      .from('pacientes')
      .select('id, nombre, telefono, email')
      .eq('psicologo_id', variante.id)
      .order('nombre')
      .then(({ data }) => {
        if (cancelled) return
        const lista = ((data ?? []) as PacienteMsg[]).filter(p => p.telefono?.trim())
        setPacientes(lista)
        setLoadingPacientes(false)
      })
    return () => {
      cancelled = true
    }
  }, [centroId, variantes])

  const varianteActiva = variantes.find(v => v.centro_id === centroId)
  const centroActivo = centros.find(c => c.id === centroId)
  const paciente = pacientes.find(p => p.id === pacienteId)
  const nombrePila = paciente ? paciente.nombre.split(' ')[0] : ''

  const mensajeResena = paciente
    ? PLANTILLA_RESENA
        .replace('{{nombre}}', nombrePila)
        .replace('{{link}}', centroActivo?.google_review_url ?? '')
    : ''

  function nombreCentro(v: Variante): string {
    return centros.find(c => c.id === v.centro_id)?.nombre ?? v.centro ?? 'Centro'
  }

  // ── Send webhook ─────────────────────────────────────────────────────────
  async function enviar(key: string, payload: Record<string, unknown> & { tipo: string }) {
    setEnviando(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch('/api/webhook/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setEnviados(prev => ({ ...prev, [key]: true }))
      if (payload.tipo === 'mensaje_libre') setMensajeLibre('')
    } catch {
      alert('Error al enviar el mensaje.')
    }
    setEnviando(prev => ({ ...prev, [key]: false }))
  }

  function enviarResena() {
    if (!paciente || !varianteActiva || !centroActivo?.google_review_url) return
    enviar(`resena-${paciente.id}`, {
      tipo: 'solicitar_resena',
      paciente: { nombre: paciente.nombre, telefono: paciente.telefono, email: paciente.email },
      centro: centroActivo.nombre,
      psicologo: { nombre: varianteActiva.nombre },
      review_url: centroActivo.google_review_url,
      mensaje: mensajeResena,
    })
  }

  function enviarLibre() {
    if (!paciente || !varianteActiva || !mensajeLibre.trim()) return
    enviar(`libre-${paciente.id}`, {
      tipo: 'mensaje_libre',
      paciente: { nombre: paciente.nombre, telefono: paciente.telefono, email: paciente.email },
      centro: centroActivo?.nombre ?? varianteActiva.centro ?? '',
      psicologo: { nombre: varianteActiva.nombre },
      mensaje: mensajeLibre.trim(),
    })
  }

  const keyActual = paciente ? `${modo}-${paciente.id}` : ''

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-pad" style={{ maxWidth: 760 }}>
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
          Mensajes
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Envía mensajes de WhatsApp a tus pacientes
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#8899bb', fontSize: 14 }}>Cargando...</div>
      ) : variantes.length === 0 ? (
        <Empty text="No se encontró tu ficha de psicólogo. Contacta con el equipo." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Paso 1: centro (solo multi-centro) */}
          {variantes.length > 1 && (
            <Card>
              <Label text="Centro" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {variantes.map(v => {
                  const activa = v.centro_id === centroId
                  return (
                    <button
                      key={v.id}
                      onClick={() => setCentroId(v.centro_id)}
                      style={{
                        padding: '7px 18px',
                        borderRadius: 30,
                        border: activa ? '1.5px solid #2f5aae' : '1.5px solid #d4e0e0',
                        background: activa ? '#2f5aae' : '#fff',
                        color: activa ? '#fff' : '#4a5870',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s, border 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {nombreCentro(v)}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Paso 2: paciente */}
          {centroId && (
            <Card>
              <Label text="Paciente" />
              {loadingPacientes ? (
                <div style={{ color: '#8899bb', fontSize: 13 }}>Cargando pacientes...</div>
              ) : pacientes.length === 0 ? (
                <div style={{ color: '#8899bb', fontSize: 13 }}>
                  No tienes pacientes con teléfono en este centro.
                </div>
              ) : (
                <select
                  value={pacienteId}
                  onChange={e => setPacienteId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #d4e0e0',
                    fontSize: 13.5,
                    color: '#272626',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    background: '#fff',
                  }}
                >
                  <option value="">Selecciona un paciente...</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {p.telefono}
                    </option>
                  ))}
                </select>
              )}
            </Card>
          )}

          {/* Paso 3: mensaje */}
          {paciente && (
            <Card>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                gap: 4,
                borderBottom: '2px solid rgba(47,90,174,0.1)',
                marginBottom: 18,
              }}>
                {([
                  { key: 'resena', label: 'Solicitar reseña' },
                  { key: 'libre', label: 'Mensaje libre' },
                ] as { key: Modo; label: string }[]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setModo(t.key)}
                    style={{
                      padding: '8px 18px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: modo === t.key ? 700 : 500,
                      color: modo === t.key ? '#272626' : '#667799',
                      borderBottom: modo === t.key ? '2px solid #2f5aae' : '2px solid transparent',
                      marginBottom: -2,
                      transition: 'color 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {modo === 'resena' ? (
                <>
                  {centroActivo?.google_review_url ? (
                    <div style={{
                      background: '#f7f9f9',
                      border: '1px solid rgba(47,90,174,0.12)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 13,
                      color: '#4a5870',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap',
                      marginBottom: 14,
                    }}>
                      {mensajeResena}
                    </div>
                  ) : (
                    <div style={{
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      marginBottom: 14,
                    }}>
                      Este centro no tiene configurado el enlace de reseñas de Google.
                      Avisa al equipo para añadirlo.
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {enviados[keyActual] ? (
                      <Badge text="✓ Enviado" color="blue" />
                    ) : (
                      <SendButton
                        loading={enviando[keyActual]}
                        disabled={!centroActivo?.google_review_url}
                        label="Enviar solicitud de reseña"
                        onClick={enviarResena}
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    placeholder={`Hola ${nombrePila}, quería comentarte que...`}
                    value={mensajeLibre}
                    onChange={e => setMensajeLibre(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #d4e0e0',
                      fontSize: 13,
                      color: '#272626',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      marginBottom: 14,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {enviados[keyActual] ? (
                      <Badge text="✓ Enviado" color="blue" />
                    ) : (
                      <SendButton
                        loading={enviando[keyActual]}
                        disabled={!mensajeLibre.trim()}
                        label="Enviar mensaje"
                        onClick={enviarLibre}
                      />
                    )}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────
function Label({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#8899bb',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 10,
    }}>
      {text}
    </div>
  )
}

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

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    amber: { bg: '#fef3c7', fg: '#92400e' },
    blue: { bg: '#dbeafe', fg: '#1e40af' },
    gray: { bg: '#f3f4f6', fg: '#374151' },
  }
  const c = colors[color] ?? colors.gray
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.fg,
    }}>
      {text}
    </span>
  )
}

function SendButton({
  label, loading, onClick, disabled,
}: {
  label: string
  loading?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        padding: '7px 16px',
        borderRadius: 30,
        border: 'none',
        background: loading || disabled ? '#a0b0cc' : '#2f5aae',
        color: '#fff',
        fontSize: 13,
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
