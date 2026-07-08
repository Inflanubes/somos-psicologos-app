'use client'

// Citas solo a en punto o y media (08:00–21:30).
const OPCIONES_HORA: string[] = []
for (let h = 8; h <= 21; h++) {
  const hh = String(h).padStart(2, '0')
  OPCIONES_HORA.push(`${hh}:00`, `${hh}:30`)
}

export default function TimeSelect({
  value,
  onChange,
  required,
  disabled,
  style,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}) {
  // A legacy value outside the grid (e.g. an old 17:15 appointment) must still
  // render as selected instead of silently falling back to the placeholder.
  const opciones =
    value && !OPCIONES_HORA.includes(value)
      ? [...OPCIONES_HORA, value].sort()
      : OPCIONES_HORA

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      style={{ ...style, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <option value="">— Selecciona hora —</option>
      {opciones.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}
