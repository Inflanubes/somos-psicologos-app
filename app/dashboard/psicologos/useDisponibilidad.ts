'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  cargarDatosDisponibilidad,
  type DatosDisponibilidad,
  type PsicologoDisponibilidad,
} from '@/lib/disponibilidad-datos'
import { aplicarCitaLocal } from '@/lib/disponibilidad'

/**
 * Carga tramos (del centro), citas y bloqueos del psicólogo indicado
 * (null o sin centro = nada que cargar). Si la carga falla se devuelve "sin
 * horario" (listas vacías) y el mensaje: con el significado nuevo de "sin
 * tramos" el fallback ya no deja agendar a cualquier hora.
 *
 * Los datos se guardan junto a la clave psicólogo:centro a la que pertenecen:
 * al cambiar de psicólogo o de centro, `datos` vuelve a ser null hasta que
 * llega la carga nueva (no se calculan huecos con los datos anteriores).
 */
export function useDisponibilidad(psicologo: PsicologoDisponibilidad | null, centroId: string | null) {
  const [datosDe, setDatosDe] = useState<{ clave: string; datos: DatosDisponibilidad } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clave = psicologo && centroId ? `${psicologo.id}:${centroId}` : null

  useEffect(() => {
    if (!psicologo || !centroId || !clave) return
    const claveCarga = clave
    let cancelado = false
    setCargando(true)
    setError(null)
    cargarDatosDisponibilidad(supabase, psicologo, centroId)
      .then((d) => { if (!cancelado) setDatosDe({ clave: claveCarga, datos: d }) })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatosDe({
          clave: claveCarga,
          datos: { tramos: [], citas: [], bloqueos: [], mediaHora: !!psicologo.citas_media_hora, tieneAlgunHorario: false, centroActivo: true },
        })
        setError(e instanceof Error ? e.message : 'No se pudo cargar la disponibilidad')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
    // Solo cambia de psicólogo o centro; el objeto psicólogo se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const datos = clave && datosDe && datosDe.clave === clave ? datosDe.datos : null

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
    error: clave && datosDe && datosDe.clave === clave ? error : null,
    añadirCitaLocal,
  }
}
