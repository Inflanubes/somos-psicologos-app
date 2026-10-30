'use client'

// Botones del consentimiento informado (bloque B4): Reenviar, Marcar firmado y
// Desmarcar (solo agentes). Se usan en Pacientes y en Comunicaciones; el call
// center nunca entra en estas pantallas.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AsociadoMenor, Paciente, Rol } from '@/types/database'
import {
  camposTutoresDesmarcados, camposTutoresFirmados, desmarcarFirmado, destinatariosReenvio, marcarFirmado,
  opcionesDesmarcarTutores, payloadReenvio, puedeDesmarcar, textoConfirmReenvio, textoEstadoConsentimiento,
  type Actor, type CualTutor, type Tutores,
} from '@/lib/consentimiento'

export type PacienteConsentimiento = Pick<
  Paciente,
  'id' | 'nombre' | 'telefono' | 'es_menor' | 'consentimiento' | 'consentimiento_origen' | 'consentimiento_marcado_por' | 'consentimiento_marcado_en'
> & {
  /** Psicólogo de referencia del paciente: Make lo busca antes de enrutar la acción. */
  psicologo_id: string | null
  psicologo_nombre: string | null
  centro_id: string | null
}

const SIN_TELEFONO = 'Este paciente no tiene teléfono al que enviar el consentimiento.'

type TutoresRow = Pick<AsociadoMenor, 'T1_nombre_completo' | 'T1_teléfono' | 'T2_nombre_completo' | 'T2_teléfono'>

async function cargarTutores(idMenor: string): Promise<TutoresRow | null> {
  const { data } = await supabase
    .from('asociados_menores')
    .select('T1_nombre_completo, "T1_teléfono", T2_nombre_completo, "T2_teléfono"')
    .eq('id_menor', idMenor)
    .maybeSingle()
  return (data as TutoresRow | null) ?? null
}

const botonBase: React.CSSProperties = {
  padding: '3px 9px',
  borderRadius: 8,
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  background: '#ffffff',
  border: '1px solid rgba(58,140,140,0.35)',
  color: '#2a6b6b',
  transition: 'background 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap',
}

export default function ConsentimientoAcciones({
  paciente,
  rol,
  actor,
  onCambio,
  compacto = false,
}: {
  paciente: PacienteConsentimiento
  rol: Rol
  actor: Actor
  onCambio: (cambios: Partial<Paciente>) => void
  /** Solo el estado y el botón de reenviar (Comunicaciones). */
  compacto?: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null)
  // Desmarcar en un menor: selector de tutor abierto (decisión de Sonia, 30-10-2026).
  const [eleccionTutor, setEleccionTutor] = useState<{ cual: CualTutor; etiqueta: string }[] | null>(null)

  const firmado = !!paciente.consentimiento

  async function reenviar() {
    // Make marca la firma cuando llega el formulario: si ya consta, se avisa antes de reenviar.
    if (!confirm(textoConfirmReenvio(paciente.nombre, firmado))) return
    setOcupado(true)
    setMensaje(null)
    try {
      const tutores: Tutores | null = paciente.es_menor ? await cargarTutores(paciente.id) : null
      if (destinatariosReenvio(paciente, tutores).length === 0) {
        setMensaje({ texto: SIN_TELEFONO, error: true })
        return
      }
      const res = await fetch('/api/webhook/psicologos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: 'Formulario Web Psicólogos',
          responseId: 'web_' + Date.now(),
          timestampFormulario: new Date().toISOString(),
          datosProcesados: payloadReenvio(paciente, tutores, actor),
          respuestasFormulario: { '¿Qué necesitas hoy?': 'Reenviar consentimiento' },
        }),
      })
      if (!res.ok) throw new Error('Error en webhook: ' + res.status)
      setMensaje({ texto: 'Consentimiento reenviado.', error: false })
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : 'No se pudo reenviar. Inténtalo de nuevo.', error: true })
    } finally {
      setOcupado(false)
    }
  }

  async function marcar() {
    if (!confirm(`¿Marcar el consentimiento de ${paciente.nombre} como firmado?`)) return
    setOcupado(true)
    setMensaje(null)
    try {
      const cambios = marcarFirmado(actor, new Date())
      const { error } = await supabase.from('pacientes').update(cambios).eq('id', paciente.id)
      if (error) throw new Error(error.message)
      if (paciente.es_menor) {
        const tutores = await cargarTutores(paciente.id)
        if (tutores) {
          const soloUnTutor = !(tutores.T2_nombre_completo ?? '').trim()
          const { error: eT } = await supabase.from('asociados_menores').update(camposTutoresFirmados(soloUnTutor)).eq('id_menor', paciente.id)
          if (eT) throw new Error(eT.message)
        }
      }
      onCambio(cambios)
    } catch (err) {
      setMensaje({ texto: 'No se pudo guardar: ' + (err instanceof Error ? err.message : 'error desconocido'), error: true })
    } finally {
      setOcupado(false)
    }
  }

  async function desmarcar() {
    if (paciente.es_menor) {
      // Menor: se pregunta de qué tutor se quita la firma (o de los dos).
      setMensaje(null)
      setOcupado(true)
      try {
        const tutores = await cargarTutores(paciente.id)
        setEleccionTutor(opcionesDesmarcarTutores(
          tutores ?? { T1_nombre_completo: null, 'T1_teléfono': null, T2_nombre_completo: null, 'T2_teléfono': null },
        ))
      } finally {
        setOcupado(false)
      }
      return
    }
    if (!confirm(`¿Quitar la marca de firmado de ${paciente.nombre}?`)) return
    await ejecutarDesmarcado(null)
  }

  async function ejecutarDesmarcado(cual: CualTutor | null) {
    setEleccionTutor(null)
    setOcupado(true)
    setMensaje(null)
    try {
      if (cual) {
        const { error: eT } = await supabase
          .from('asociados_menores')
          .update(camposTutoresDesmarcados(cual))
          .eq('id_menor', paciente.id)
        if (eT) throw new Error(eT.message)
      }
      // Un menor necesita las dos firmas: con una de menos, el consentimiento deja de constar.
      const cambios = desmarcarFirmado()
      const { error } = await supabase.from('pacientes').update(cambios).eq('id', paciente.id)
      if (error) throw new Error(error.message)
      onCambio(cambios)
    } catch (err) {
      setMensaje({ texto: 'No se pudo guardar: ' + (err instanceof Error ? err.message : 'error desconocido'), error: true })
    } finally {
      setOcupado(false)
    }
  }

  const boton = (texto: string, onClick: () => void, title?: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      title={title}
      style={{ ...botonBase, opacity: ocupado ? 0.6 : 1 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#e8f4f4' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff' }}
    >
      {texto}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
      {/* El estado se ve siempre, también en Comunicaciones: Make marca la firma al recibir el formulario. */}
      {(
        <span
          title={textoEstadoConsentimiento(paciente)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: compacto ? '2px 8px' : '3px 10px',
            borderRadius: 20,
            fontSize: compacto ? 11.5 : 12,
            fontWeight: 600,
            background: firmado ? '#dcfce7' : '#fef3c7',
            color: firmado ? '#166534' : '#92400e',
            border: `1px solid ${firmado ? '#bbf7d0' : '#fde68a'}`,
            whiteSpace: 'normal',
          }}
        >
          {firmado ? '✓ ' : ''}{textoEstadoConsentimiento(paciente)}
        </span>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {boton(compacto ? 'Reenviar consentimiento' : 'Reenviar', reenviar, 'Enviar de nuevo el enlace del consentimiento')}
        {!compacto && !firmado && boton('Marcar firmado', marcar, 'Firmado en papel o fuera de la app')}
        {!compacto && firmado && puedeDesmarcar(rol) && boton('Desmarcar', desmarcar, 'Quitar la marca de firmado')}
      </div>
      {eleccionTutor && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#4a5870' }}>¿De qué tutor quitas la firma?</span>
          {eleccionTutor.map((o) => boton(o.etiqueta, () => ejecutarDesmarcado(o.cual)))}
          {boton('Cancelar', () => setEleccionTutor(null))}
        </div>
      )}
      {mensaje && (
        <span style={{ fontSize: 11.5, color: mensaje.error ? '#991b1b' : '#166534', whiteSpace: 'normal' }}>
          {mensaje.texto}
        </span>
      )}
    </div>
  )
}
