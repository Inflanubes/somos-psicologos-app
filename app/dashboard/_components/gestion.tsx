'use client'

// Piezas compartidas por las páginas Psicólogos (/dashboard/equipo, configuración
// de consulta) y Usuarios (/dashboard/usuarios, cuentas y accesos). Las dos leen
// de GET /api/usuarios y guardan con PATCH /api/usuarios/[id].

import { useState } from 'react'
import type { Tramo } from '@/lib/horarios'
import type { TipoCita } from '@/types/database'

// Una ficha por psicólogo (migración 014): sus centros y tipos de consulta son listas.
export type PsicologoGestion = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_ids: string[]; centros_nombres: string[]; tipos_consulta: TipoCita[]
  calendar_id: string | null; activo: boolean
  puede_bloquear: boolean | null
  citas_media_hora: boolean | null
  horarios: Tramo[]
}
export type AgenteGestion = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; activo: boolean; auth_user_id: string | null
}
export type CentroGestion = { id: string; nombre: string }
export type TipoUsuario = 'psicologo' | 'agente' | 'call_center'

export type DatosGestion = {
  psicologos: PsicologoGestion[]
  agentes: AgenteGestion[]
  call_center: AgenteGestion[]
  centros: CentroGestion[]
  aviso_horarios: string | null
}

export async function cargarGestion(): Promise<{ datos?: DatosGestion; error?: string }> {
  try {
    const res = await fetch('/api/usuarios')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error ?? 'Error cargando' }
    return {
      datos: {
        psicologos: data.psicologos ?? [],
        agentes: data.agentes ?? [],
        call_center: data.call_center ?? [],
        centros: data.centros ?? [],
        aviso_horarios: data.aviso_horarios ?? null,
      },
    }
  } catch {
    return { error: 'Error de conexión al cargar' }
  }
}

// Guarda un cambio. No recarga nada: quien llama actualiza solo la fila afectada.
export async function patchUsuario(id: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data.error ?? 'No se pudo guardar el cambio'
  } catch {
    return 'Error de conexión al guardar'
  }
}

// ---------- Estilos ----------

export const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', overflow: 'hidden', marginBottom: 28,
}
export const th: React.CSSProperties = {
  padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#667799', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
}
export const td: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#4a5870', verticalAlign: 'middle' }
export const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid rgba(47,90,174,0.25)', fontFamily: 'inherit',
}
export const h1: React.CSSProperties = {
  fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600,
  color: '#272626', margin: 0, marginBottom: 6,
}
export const subtitulo: React.CSSProperties = { fontSize: 13.5, color: '#667799', margin: 0 }

export function pill(activo: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
    borderColor: activo ? '#2f5aae' : 'rgba(47,90,174,0.2)',
    background: activo ? '#eef2fb' : '#fff', color: activo ? '#254d99' : '#4a5870',
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  }
}

export function Aviso({ tipo, children, onCerrar }: { tipo: 'error' | 'aviso'; children: React.ReactNode; onCerrar?: () => void }) {
  const estilo = tipo === 'error'
    ? { background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca' }
    : { background: '#fff7e6', color: '#8a5a00', border: '1.5px solid #f5d08a' }
  return (
    <div style={{ ...estilo, padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{children}</span>
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      )}
    </div>
  )
}

// ---------- Botones ----------

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
  primary: {
    normal: { borderColor: '#2f5aae', background: '#2f5aae', color: '#fff' },
    hover:  { borderColor: '#254d99', background: '#254d99', color: '#fff' },
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

export function ActionButton({ children, onClick, disabled, variant = 'default', title, type = 'button' }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: keyof typeof btnVariants
  title?: string
  type?: 'button' | 'submit'
}) {
  const [hover, setHover] = useState(false)
  const v = btnVariants[variant]
  return (
    <button
      type={type}
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

// Interruptor on/off. Se guarda al pulsarlo.
export function Interruptor({ activo, onChange, disabled, etiqueta }: {
  activo: boolean
  onChange: () => void
  disabled?: boolean
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      style={{
        position: 'relative', width: 38, height: 22, borderRadius: 11, border: 0, flexShrink: 0,
        background: activo ? '#1e7d4f' : '#cfd6e4',
        cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: activo ? 19 : 3, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.15s',
      }} />
    </button>
  )
}

export function EstadoBadge({ activo, title }: { activo: boolean; title?: string }) {
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
      background: activo ? '#d1fae5' : '#f3f4f6', color: activo ? '#065f46' : '#6b7280',
    }}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

// Filas de esqueleto mientras se cargan los datos.
export function FilasEsqueleto({ columnas, filas = 5 }: { columnas: number; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
          {Array.from({ length: columnas }, (_, j) => (
            <td key={j} style={td}>
              <div className="skeleton" style={{ height: 12, borderRadius: 4, width: j === 0 ? '70%' : '55%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
