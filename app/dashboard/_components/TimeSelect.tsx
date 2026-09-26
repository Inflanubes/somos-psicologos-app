'use client'

import type { EstadoHueco, Hueco } from '@/lib/disponibilidad'

// Citas solo a en punto o y media (08:00–21:30). Es la lista por defecto cuando
// no se pasan `opciones` (bloqueos y usos antiguos).
const OPCIONES_HORA: string[] = []
for (let h = 8; h <= 21; h++) {
  const hh = String(h).padStart(2, '0')
  OPCIONES_HORA.push(`${hh}:00`, `${hh}:30`)
}

// Sufijo que ve el agente en modo aviso para saber por qué un hueco no es libre.
const SUFIJO: Record<EstadoHueco, string> = {
  libre: '',
  ocupado: ' · ocupada',
  fuera_horario: ' · fuera de horario',
  media_hora: ' · media hora no activa',
}

export default function TimeSelect({
  value,
  onChange,
  required,
  disabled,
  style,
  opciones,
  soloLibres,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  /** Huecos calculados por lib/disponibilidad. Sin ellos, lista fija 08:00–21:30. */
  opciones?: Hueco[]
  /** true (psicólogo / call center): solo se listan los huecos libres. */
  soloLibres?: boolean
  placeholder?: string
}) {
  let lista: Hueco[] = opciones
    ? soloLibres
      ? opciones.filter((h) => h.estado === 'libre')
      : opciones
    : OPCIONES_HORA.map((hora) => ({ hora, estado: 'libre' as const }))

  // A legacy value outside the grid (e.g. an old 17:15 appointment) must still
  // render as selected instead of silently falling back to the placeholder.
  if (value && !lista.some((h) => h.hora === value)) {
    lista = [...lista, { hora: value, estado: 'libre' as const }].sort((a, b) => a.hora.localeCompare(b.hora))
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      style={{ ...style, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <option value="">{placeholder ?? '— Selecciona hora —'}</option>
      {lista.map((h) => (
        <option key={h.hora} value={h.hora}>
          {h.hora}
          {SUFIJO[h.estado]}
        </option>
      ))}
    </select>
  )
}
