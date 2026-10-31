'use client'

import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { DatoBarra } from '@/lib/kpis'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// Barras horizontales genéricas (B8): todas las filas (sin top N), alto por fila
// y scroll dentro de la tarjeta. Un valor null (p. ej. ocupación sin horario)
// se pinta como 0 y lo explica el tooltip.

const FUENTE = '"DM Sans", system-ui, sans-serif'

/** '#f59e0b' → 'rgba(245, 158, 11, a)' */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function formatear(v: number, unidad: '' | 'h' | '%'): string {
  const r = Math.round(v * 10) / 10
  const txt = r.toLocaleString('es-ES')
  if (unidad === 'h') return `${txt} h`
  if (unidad === '%') return `${txt} %`
  return txt
}

export default function GraficaBarras({
  datos,
  unidad,
  color = '#f59e0b',
}: {
  datos: DatoBarra[]
  unidad: '' | 'h' | '%'
  color?: string
}) {
  if (datos.length === 0 || datos.every((d) => !d.valor)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: '#a0b0cc', fontSize: 14 }}>
        Sin datos disponibles
      </div>
    )
  }

  const alfa = (i: number) => Math.max(0.35, 1 - i * 0.07)
  const alto = Math.max(280, datos.length * 34)

  return (
    <div style={{ overflowY: 'auto', maxHeight: 420 }}>
      <div style={{ position: 'relative', height: alto }}>
        <Bar
          data={{
            labels: datos.map((d) => d.etiqueta),
            datasets: [
              {
                data: datos.map((d) => d.valor ?? 0),
                backgroundColor: datos.map((_, i) => rgba(color, alfa(i))),
                borderColor: datos.map((_, i) => rgba(color, Math.min(1, alfa(i) + 0.15))),
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
              },
            ],
          }}
          options={{
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#272626',
                titleFont: { family: FUENTE, size: 12 },
                bodyFont: { family: FUENTE, size: 12 },
                padding: 10,
                callbacks: {
                  label: (ctx) => (datos[ctx.dataIndex]?.valor === null ? ' Sin horario cargado' : ` ${formatear(ctx.parsed.x ?? 0, unidad)}`),
                },
              },
            },
            scales: {
              x: {
                grid: { color: 'rgba(47,90,174,0.08)' },
                ticks: {
                  font: { family: FUENTE, size: 11 },
                  color: '#667799',
                  precision: 0,
                  callback: (v) => formatear(Number(v), unidad),
                },
                border: { display: false },
              },
              y: {
                grid: { display: false },
                ticks: { font: { family: FUENTE, size: 12 }, color: '#4a5870' },
                border: { display: false },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
