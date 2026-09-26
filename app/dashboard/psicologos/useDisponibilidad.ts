'use client'

import { useEffect, useState } from 'react'
import {
  cargarDatosDisponibilidad,
  type DatosDisponibilidad,
  type PsicologoDisponibilidad,
} from '@/lib/disponibilidad-datos'

/**
 * Carga tramos, citas y bloqueos de la ficha indicada (null = nada que cargar).
 * Si la carga falla se devuelve "sin restricción" (listas vacías) y el mensaje,
 * para que el formulario siga funcionando aunque falte la migración 012.
 */
export function useDisponibilidad(psicologo: PsicologoDisponibilidad | null) {
  const [datos, setDatos] = useState<DatosDisponibilidad | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const id = psicologo?.id ?? null

  useEffect(() => {
    if (!psicologo) {
      setDatos(null)
      setError(null)
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    cargarDatosDisponibilidad(psicologo)
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatos({ tramos: [], citas: [], bloqueos: [], mediaHora: !!psicologo.citas_media_hora })
        setError(e instanceof Error ? e.message : 'No se pudo cargar la disponibilidad')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
    // Solo cambia de ficha o al pedir recarga; el objeto psicólogo se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version])

  return { datos, cargando, error, recargar: () => setVersion((v) => v + 1) }
}
