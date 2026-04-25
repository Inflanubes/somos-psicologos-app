'use client'

import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const MOTIVO_COLORS: Record<string, string> = {
  'Asuntos propios': '#6366f1',
  Vacaciones: '#10b981',
  'Baja laboral': '#ef4444',
  Otros: '#9ca3af',
}

interface Props {
  data: {
    'Asuntos propios': number
    Vacaciones: number
    'Baja laboral': number
    Otros: number
  }
}

export default function MotivosChart({ data }: Props) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 260,
          color: '#a0b0cc',
          fontSize: 14,
        }}
      >
        Sin datos disponibles
      </div>
    )
  }

  const chartData = {
    labels: entries.map(([k]) => k),
    datasets: [
      {
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) => MOTIVO_COLORS[k] ?? '#9ca3af'),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  }

  return (
    <div style={{ position: 'relative', height: 260 }}>
      <Doughnut
        data={chartData}
        options={{
          cutout: '66%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 11 },
                color: '#4a5870',
                padding: 14,
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
            tooltip: {
              backgroundColor: '#272626',
              titleFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              bodyFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed} bloqueo${ctx.parsed === 1 ? '' : 's'}`,
              },
            },
          },
        }}
      />
    </div>
  )
}
