'use client'

import { useEffect, useState } from 'react'
import {
  cargarDatosDisponibilidad,
  type DatosDisponibilidad,
  type PsicologoDisponibilidad,
} from '@/lib/disponibilidad-datos'
import { aplicarCitaLocal } from '@/lib/disponibilidad'

/**
 * Carga tramos, citas y bloqueos de la ficha indicada (null = nada que cargar).
 * Si la carga falla se devuelve "sin restricción" (listas vacías) y el mensaje,
 * para que el formulario siga funcionando aunque falte la migración 012.
 *
 * Los datos se guardan junto al id de la ficha a la que pertenecen: al cambiar
 * de psicólogo, `datos` vuelve a ser null hasta que llega la carga nueva (no se
 * calculan huecos con los datos del psicólogo anterior).
 */
export function useDisponibilidad(psicologo: PsicologoDisponibilidad | null) {
  const [datosDe, setDatosDe] = useState<{ id: string; datos: DatosDisponibilidad } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = psicologo?.id ?? null

  useEffect(() => {
    if (!psicologo) return
    const idCarga = psicologo.id
    let cancelado = false
    setCargando(true)
    setError(null)
    cargarDatosDisponibilidad(psicologo)
      .then((d) => { if (!cancelado) setDatosDe({ id: idCarga, datos: d }) })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatosDe({ id: idCarga, datos: { tramos: [], citas: [], bloqueos: [], mediaHora: !!psicologo.citas_media_hora } })
        setError(e instanceof Error ? e.message : 'No se pudo cargar la disponibilidad')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
    // Solo cambia de ficha; el objeto psicólogo se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const datos = id && datosDe && datosDe.id === id ? datosDe.datos : null

  /**
   * Tras agendar o cambiar con éxito: ocupa la hora en local de inmediato
   * (Make tarda unos segundos en escribir la fila) y, al cambiar, libera la antigua.
   */
  function añadirCitaLocal(cita: { fecha: string; hora: string }, excluirAccionId?: string) {
    setDatosDe((prev) => (prev ? { ...prev, datos: aplicarCitaLocal(prev.datos, cita, excluirAccionId) } : prev))
  }

  return {
    datos,
    cargando,
    error: id && datosDe && datosDe.id === id ? error : null,
    añadirCitaLocal,
  }
}
