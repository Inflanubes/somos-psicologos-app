'use client'

import type { EventoActivo } from '@/lib/eventos-activos'

const defaultInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #dde1ea',
  borderRadius: 8,
  fontSize: 14,
  color: '#272626',
  background: '#fff',
  outline: 'none',
  fontFamily: "'Montserrat', inherit",
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
  cursor: 'pointer',
}

/**
 * Presentational dropdown to pick an existing calendar event (cita or bloqueo).
 * Knows nothing about Supabase — the parent loads the list and passes it in,
 * so the same component is reusable across the psicólogos / call center / agentes apps.
 */
export default function EventoSelect({
  eventos,
  value,
  onChange,
  loading,
  emptyText,
  placeholder = 'Selecciona…',
  disabled = false,
  required = false,
  inputStyle,
}: {
  eventos: EventoActivo[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  emptyText: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  inputStyle?: React.CSSProperties
}) {
  const isDisabled = disabled || loading || eventos.length === 0

  const firstOptionText = disabled
    ? 'Selecciona los pasos previos'
    : loading
      ? 'Cargando…'
      : eventos.length === 0
        ? emptyText
        : placeholder

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...defaultInputStyle, ...inputStyle }}
      disabled={isDisabled}
      required={required}
    >
      <option value="">{firstOptionText}</option>
      {eventos.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.label}
        </option>
      ))}
    </select>
  )
}
