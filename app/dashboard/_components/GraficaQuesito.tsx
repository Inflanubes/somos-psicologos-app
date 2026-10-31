'use client'

import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

// Quesito genérico (B8): motivos de bloqueo, tipos de terapia, centros, canales,
// estados… Colores fijos para las etiquetas conocidas; el resto, de la paleta.

const COLORES_FIJOS: Record<string, string> = {
  // Motivos de bloqueo
  'Asuntos propios': '#6366f1',
  Vacaciones: '#10b981',
  'Baja médica': '#ef4444',
  Otros: '#9ca3af',
  // Tipos de terapia
  Adultos: '#3a8c8c',
  Pareja: '#6366f1',
  Infantil: '#f59e0b',
  'Sin tipo': '#cbd5e1',
  'Sin dato': '#cbd5e1',
  'Sin centro': '#cbd5e1',
}

const PALETA = ['#2f5aae', '#3a8c8c', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#ec4899', '#64748b']

export type DatoQuesito = { etiqueta: string; valor: number; color?: string }

const FUENTE = '"DM Sans", system-ui, sans-serif'

export default function GraficaQuesito({
  datos,
  unidad = { singular: 'cita', plural: 'citas' },
}: {
  datos: DatoQuesito[]
  unidad?: { singular: string; plural: string }
}) {
  const visibles = datos.filter((d) => d.valor > 0)

  if (visibles.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: '#a0b0cc', fontSize: 14 }}>
        Sin datos disponibles
      </div>
    )
  }

  let libre = 0
  const colores = visibles.map((d) => d.color ?? COLORES_FIJOS[d.etiqueta] ?? PALETA[libre++ % PALETA.length])

  return (
    <div style={{ position: 'relative', height: 260 }}>
      <Doughnut
        data={{
          labels: visibles.map((d) => d.etiqueta),
          datasets: [
            { data: visibles.map((d) => d.valor), backgroundColor: colores, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6 },
          ],
        }}
        options={{
          cutout: '66%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { family: FUENTE, size: 11 }, color: '#4a5870', padding: 14, usePointStyle: true, pointStyleWidth: 8 },
            },
            tooltip: {
              backgroundColor: '#272626',
              titleFont: { family: FUENTE, size: 12 },
              bodyFont: { family: FUENTE, size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const v = Math.round(ctx.parsed * 10) / 10
                  return ` ${v.toLocaleString('es-ES')} ${v === 1 ? unidad.singular : unidad.plural}`
                },
              },
            },
          },
        }}
      />
    </div>
  )
}
