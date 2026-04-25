'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Props {
  data: { nombre: string; count: number }[]
}

export default function BloqueosBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 280,
          color: '#a0b0cc',
          fontSize: 14,
        }}
      >
        Sin datos disponibles
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.nombre),
    datasets: [
      {
        label: 'Bloqueos',
        data: data.map((d) => d.count),
        backgroundColor: data.map((_, i) => {
          const opacity = 1 - i * 0.07
          return `rgba(245, 158, 11, ${Math.max(0.35, opacity)})`
        }),
        borderColor: data.map((_, i) => {
          const opacity = 1 - i * 0.07
          return `rgba(180, 110, 6, ${Math.max(0.35, opacity)})`
        }),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  const dynamicHeight = Math.max(280, data.length * 34)

  return (
    <div style={{ position: 'relative', height: dynamicHeight }}>
      <Bar
        data={chartData}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#272626',
              titleFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              bodyFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.x} bloqueo${ctx.parsed.x === 1 ? '' : 's'}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(47,90,174,0.08)' },
              ticks: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 11 },
                color: '#667799',
                stepSize: 1,
              },
              border: { display: false },
            },
            y: {
              grid: { display: false },
              ticks: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
                color: '#4a5870',
              },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  )
}
