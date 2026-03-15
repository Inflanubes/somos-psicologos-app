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

export default function PsicologosChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: '#aab8b8', fontSize: 14 }}>
        Sin datos disponibles
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.nombre),
    datasets: [
      {
        label: 'Pacientes',
        data: data.map((d) => d.count),
        backgroundColor: data.map((_, i) => {
          const opacity = 1 - i * 0.08
          return `rgba(58, 140, 140, ${Math.max(0.3, opacity)})`
        }),
        borderColor: data.map((_, i) => {
          const opacity = 1 - i * 0.08
          return `rgba(42, 107, 107, ${Math.max(0.3, opacity)})`
        }),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  return (
    <div style={{ position: 'relative', height: 280 }}>
      <Bar
        data={chartData}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a2e2e',
              titleFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              bodyFont: { family: '"DM Sans", system-ui, sans-serif', size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.x} pacientes`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(58,140,140,0.08)' },
              ticks: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 11 },
                color: '#7a9090',
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
