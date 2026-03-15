'use client'

import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import type { EstadoPaciente } from '@/types/database'

ChartJS.register(ArcElement, Tooltip, Legend)

const ESTADO_COLORS: Record<EstadoPaciente, string> = {
  'Nuevo paciente': '#3a8c8c',
  'Agendado': '#10b981',
  'Anulado': '#ef4444',
  'Sin disponibilidad': '#9ca3af',
  'En espera': '#f59e0b',
  'Cambio solicitado': '#6366f1',
  'Dudoso': '#f97316',
  'Dudoso contactado': '#fb923c',
  'Revisar recomendado': '#a855f7',
  'Psicólogo sin disponibilidad': '#ec4899',
}

interface Props {
  data: { label: EstadoPaciente; value: number }[]
}

export default function EstadosChart({ data }: Props) {
  const filtered = data.filter((d) => d.value > 0)

  if (filtered.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: '#aab8b8', fontSize: 14 }}>
        Sin datos disponibles
      </div>
    )
  }

  const chartData = {
    labels: filtered.map((d) => d.label),
    datasets: [
      {
        data: filtered.map((d) => d.value),
        backgroundColor: filtered.map((d) => ESTADO_COLORS[d.label]),
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
              backgroundColor: '#1a2e2e',
              titleFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              bodyFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed} pacientes`,
              },
            },
          },
        }}
      />
    </div>
  )
}
