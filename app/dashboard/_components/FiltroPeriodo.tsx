'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ATAJOS, atajoDeRango, type AtajoKey, type Rango } from '@/lib/periodo'

// Selector de periodo compartido (B8): fechas libres Desde / Hasta, atajos y,
// opcionalmente, pastillas de centro. Todo viaja en la URL (?desde&hasta o
// ?periodo, y ?centro) para que la página servidor recalcule y el enlace se
// pueda compartir. Conserva el resto de parámetros de la URL. Las fechas se
// aplican al salir del campo o con Intro: al teclear el año, cada tecla daría
// un año intermedio (0002, 0020…) y una recarga.

type Props = {
  rango: Rango
  hoy: string
  centros?: { id: string; nombre: string }[]
  centroId?: string | null
  /** Parámetros que se borran al cambiar de centro (p. ej. el psicólogo elegido). */
  limpiarAlCambiarCentro?: string[]
}

function pastilla(activo: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1.5px solid',
    borderColor: activo ? '#2f5aae' : 'rgba(47,90,174,0.2)',
    background: activo ? '#eef2fb' : '#fff',
    color: activo ? '#254d99' : '#4a5870',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  }
}

const inputFecha: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(47,90,174,0.2)',
  background: '#fff',
  fontSize: 13,
  color: '#272626',
  fontFamily: 'inherit',
}

const etiqueta: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#667799',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

export default function FiltroPeriodo({ rango, hoy, centros, centroId, limpiarAlCambiarCentro = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const activo = atajoDeRango(rango, hoy)

  function ir(cambiar: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    cambiar(sp)
    const q = sp.toString()
    startTransition(() => router.push(q ? `${pathname}?${q}` : pathname))
  }

  function elegirAtajo(key: AtajoKey) {
    ir((sp) => {
      sp.delete('desde')
      sp.delete('hasta')
      sp.set('periodo', key)
    })
  }

  function elegirFecha(lado: 'desde' | 'hasta', valor: string) {
    ir((sp) => {
      sp.delete('periodo')
      const otro = lado === 'desde' ? 'hasta' : 'desde'
      if (rango[otro]) sp.set(otro, rango[otro])
      else sp.delete(otro)
      if (valor) sp.set(lado, valor)
      else sp.delete(lado)
      // Sin ninguna fecha, "Desde siempre" (si no, la página volvería a "Este mes").
      if (!sp.get('desde') && !sp.get('hasta')) sp.set('periodo', 'siempre')
    })
  }

  function elegirCentro(id: string | null) {
    ir((sp) => {
      if (id) sp.set('centro', id)
      else sp.delete('centro')
      for (const k of limpiarAlCambiarCentro) sp.delete(k)
    })
  }

  return (
    <div style={{ display: 'grid', gap: 10, opacity: isPending ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={etiqueta}>Desde</span>
          <input
            key={'desde-' + rango.desde}
            type="date"
            defaultValue={rango.desde}
            max={rango.hasta || undefined}
            onBlur={(e) => e.target.value !== rango.desde && elegirFecha('desde', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            style={inputFecha}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={etiqueta}>Hasta</span>
          <input
            key={'hasta-' + rango.hasta}
            type="date"
            defaultValue={rango.hasta}
            min={rango.desde || undefined}
            onBlur={(e) => e.target.value !== rango.hasta && elegirFecha('hasta', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            style={inputFecha}
          />
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ATAJOS.map((a) => (
            <button key={a.key} type="button" onClick={() => elegirAtajo(a.key)} style={pastilla(activo === a.key)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      {centros && centros.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => elegirCentro(null)} style={pastilla(!centroId)}>
            Todos los centros
          </button>
          {centros.map((c) => (
            <button key={c.id} type="button" onClick={() => elegirCentro(c.id)} style={pastilla(centroId === c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
