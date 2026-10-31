'use client'

// Desplegable para elegir qué muestra una gráfica (estado local, no URL).

export default function SelectorGrafica<K extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { key: K; label: string }[]
  valor: K
  onChange: (k: K) => void
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value as K)}
      aria-label="Elegir gráfica"
      style={{
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(47,90,174,0.2)',
        background: '#f4f5f7',
        fontSize: 13,
        color: '#272626',
        outline: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        maxWidth: '100%',
      }}
    >
      {opciones.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
