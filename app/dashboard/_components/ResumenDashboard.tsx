'use client'

import { useState } from 'react'
import type { Rango } from '@/lib/periodo'
import type { DatoBarra, KpisResumen } from '@/lib/kpis'
import { KpiCard, Card } from './Cards'
import FiltroPeriodo from './FiltroPeriodo'
import GraficaQuesito, { type DatoQuesito } from './GraficaQuesito'
import GraficaBarras from './GraficaBarras'
import SelectorGrafica from './SelectorGrafica'
import PacientesTable, { type PacienteRow } from './PacientesTable'

// Resumen de pacientes (B8): filtros de periodo y centro (en la URL), los ocho
// cuadros de Jaime, un quesito y unas barras con selector (estado local) y la
// tabla de pacientes recientes. Los números llegan calculados desde page.tsx.

export type QuesitoKey = 'tipo' | 'nuevos_centro' | 'nuevos_canal' | 'estado'
export type BarraKey =
  | 'nuevos_psi'
  | 'nuevos_centro'
  | 'citas_psi'
  | 'citas_centro'
  | 'ocupacion_psi'
  | 'ocupacion_centro'
  | 'anulacion_psi'
  | 'anulacion_centro'

const QUESITOS: { key: QuesitoKey; label: string }[] = [
  { key: 'tipo', label: 'Citas por tipo de terapia' },
  { key: 'nuevos_centro', label: 'Nuevos pacientes por centro' },
  { key: 'nuevos_canal', label: 'Nuevos pacientes por canal de entrada' },
  { key: 'estado', label: 'Distribución por estado' },
]

const BARRAS: { key: BarraKey; label: string }[] = [
  { key: 'nuevos_psi', label: 'Nuevos pacientes por psicólogo' },
  { key: 'nuevos_centro', label: 'Nuevos pacientes por centro' },
  { key: 'citas_psi', label: 'Citas por psicólogo' },
  { key: 'citas_centro', label: 'Citas por centro' },
  { key: 'ocupacion_psi', label: 'Ocupación por psicólogo' },
  { key: 'ocupacion_centro', label: 'Ocupación por centro' },
  { key: 'anulacion_psi', label: 'Anulación por psicólogo' },
  { key: 'anulacion_centro', label: 'Anulación por centro' },
]

const UNIDAD_QUESITO: Record<QuesitoKey, { singular: string; plural: string }> = {
  tipo: { singular: 'cita', plural: 'citas' },
  nuevos_centro: { singular: 'paciente', plural: 'pacientes' },
  nuevos_canal: { singular: 'paciente', plural: 'pacientes' },
  estado: { singular: 'paciente', plural: 'pacientes' },
}

function unidadBarra(k: BarraKey): '' | '%' {
  return k.startsWith('ocupacion') || k.startsWith('anulacion') ? '%' : ''
}

const COLOR_BARRA: Record<BarraKey, string> = {
  nuevos_psi: '#6366f1',
  nuevos_centro: '#6366f1',
  citas_psi: '#10b981',
  citas_centro: '#10b981',
  ocupacion_psi: '#2f5aae',
  ocupacion_centro: '#2f5aae',
  anulacion_psi: '#ef4444',
  anulacion_centro: '#ef4444',
}

const icono = (d: React.ReactNode) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {d}
  </svg>
)
const icons = {
  person: icono(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  calendar: icono(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>),
  sparkle: icono(<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />),
  xCircle: icono(<><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>),
  child: icono(<><circle cx="12" cy="5" r="3" /><path d="M12 8v6M9 22l3-4 3 4M9 14l-2 8M15 14l2 8" /></>),
  badge: icono(<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />),
  heart: icono(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />),
  gauge: icono(<><path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>),
}

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

export default function ResumenDashboard({
  rango,
  hoy,
  etiquetaPeriodo,
  centros,
  centroId,
  kpis,
  quesitos,
  barras,
  pacientesRecientes,
  avisoHorario,
}: {
  rango: Rango
  hoy: string
  etiquetaPeriodo: string
  centros: { id: string; nombre: string }[]
  centroId: string | null
  kpis: KpisResumen
  quesitos: Record<QuesitoKey, DatoQuesito[]>
  barras: Record<BarraKey, DatoBarra[]>
  pacientesRecientes: PacienteRow[]
  avisoHorario: boolean
}) {
  const [quesito, setQuesito] = useState<QuesitoKey>('tipo')
  const [barra, setBarra] = useState<BarraKey>('citas_psi')
  const etiquetaQuesito = QUESITOS.find((q) => q.key === quesito)?.label ?? ''
  const etiquetaBarra = BARRAS.find((b) => b.key === barra)?.label ?? ''
  const esOcupacion = barra.startsWith('ocupacion')

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      {/* ── Cabecera ── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
            fontSize: 26,
            fontWeight: 600,
            color: '#272626',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Resumen de pacientes
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0, marginBottom: 14 }}>{etiquetaPeriodo}</p>
        <FiltroPeriodo rango={rango} hoy={hoy} centros={centros} centroId={centroId} />
      </div>

      {/* ── Cuadros ── */}
      <div className="r-grid-kpi" style={{ gap: 18, marginBottom: 24 }}>
        <KpiCard label="Pacientes citados" value={kpis.pacientesCitados} icon={icons.person} />
        <KpiCard label="Citas agendadas" value={kpis.citasAgendadas} icon={icons.calendar} accent="#10b981" accentBg="#d1fae5" />
        <KpiCard label="Pacientes nuevos" value={kpis.pacientesNuevos} icon={icons.sparkle} accent="#6366f1" accentBg="#e0e7ff" />
        <KpiCard
          label="Tasa de anulación"
          value={pct(kpis.tasaAnulacion)}
          icon={icons.xCircle}
          accent={(kpis.tasaAnulacion ?? 0) > 20 ? '#ef4444' : '#f59e0b'}
          accentBg={(kpis.tasaAnulacion ?? 0) > 20 ? '#fee2e2' : '#fef3c7'}
        />
        <KpiCard label="Menores nuevos" value={kpis.menoresNuevos} icon={icons.child} accent="#8b5cf6" accentBg="#f3e8ff" />
        <KpiCard label="Psicólogos activos" value={kpis.psicologosActivos} icon={icons.badge} accent="#2f5aae" accentBg="#eef2fb" />
        <KpiCard label="Parejas nuevas" value={kpis.parejasNuevas} icon={icons.heart} accent="#ec4899" accentBg="#fce7f3" />
        <KpiCard
          label="Ocupación"
          value={pct(kpis.ocupacion)}
          sub={
            avisoHorario || kpis.huecos === 0
              ? 'Sin horario cargado: la ocupación no se puede calcular.'
              : `${kpis.citasAgendadas} citas / ${Math.round(kpis.huecos * 10) / 10} huecos`
          }
          icon={icons.gauge}
          accent="#3a8c8c"
          accentBg="#e8f4f4"
        />
      </div>

      {/* ── Gráficas ── */}
      <div className="r-grid-side" style={{ gap: 18, marginBottom: 24 }}>
        <Card title={etiquetaQuesito} right={<SelectorGrafica opciones={QUESITOS} valor={quesito} onChange={setQuesito} />}>
          <GraficaQuesito datos={quesitos[quesito]} unidad={UNIDAD_QUESITO[quesito]} />
        </Card>
        <Card title={etiquetaBarra} right={<SelectorGrafica opciones={BARRAS} valor={barra} onChange={setBarra} />}>
          <GraficaBarras datos={barras[barra]} unidad={unidadBarra(barra)} color={COLOR_BARRA[barra]} />
          {esOcupacion && (
            <p style={{ fontSize: 12, color: '#8899bb', margin: '12px 0 0' }}>
              Las citas fuera de horario cuentan; por eso puede pasar del 100 %.
            </p>
          )}
        </Card>
      </div>

      {/* ── Pacientes recientes ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '24px',
          border: '1px solid rgba(47,90,174,0.13)',
          boxShadow: '0 2px 8px rgba(47,90,174,0.06)',
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#3a4a6b',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Pacientes Recientes
        </h3>
        <p style={{ fontSize: 12, color: '#8899bb', marginBottom: 20 }}>Últimos {pacientesRecientes.length} registros</p>
        <PacientesTable pacientes={pacientesRecientes} />
      </div>
    </div>
  )
}
