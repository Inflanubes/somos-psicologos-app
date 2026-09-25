'use client'

import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Props {
  data: { label: string; count: number }[]
}

// Citas agendadas por día del periodo (panel personal del call center).
export default function CitasPorDiaChart({ data }: Props) {
  if (data.every((d) => d.count === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#a0b0cc', fontSize: 14 }}>
        Sin citas agendadas en este periodo
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'Citas agendadas',
        data: data.map((d) => d.count),
        backgroundColor: 'rgba(47, 90, 174, 0.75)',
        borderColor: 'rgba(37, 77, 153, 0.9)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  return (
    <div style={{ position: 'relative', height: 240 }}>
      <Bar
        data={chartData}
        options={{
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
                label: (ctx) => ` ${ctx.parsed.y} cita${ctx.parsed.y === 1 ? '' : 's'}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 11 },
                color: '#667799',
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 16,
              },
              border: { display: false },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(47,90,174,0.08)' },
              ticks: {
                font: { family: '"DM Sans", system-ui, sans-serif', size: 11 },
                color: '#667799',
                stepSize: 1,
                precision: 0,
              },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  )
}
