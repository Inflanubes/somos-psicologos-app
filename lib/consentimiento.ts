// lib/consentimiento.ts
// Lógica pura del consentimiento informado (bloque B4): enlaces, destinatarios
// del reenvío, payload para Make, marcado manual y texto de estado.
// Las pantallas solo llaman a estas funciones.

import type { AsociadoMenorInsert, Paciente, PacienteInsert } from '@/types/database'

export const ENLACE_ADULTO = 'https://www.somospsicologos.es/consentimiento/'
export const ENLACE_MENORES = 'https://www.somospsicologos.es/consentimiento-menores/'

/** Texto exacto de la acción que Make filtra en la ruta de reenvío. */
export const ACCION_REENVIAR = 'Reenviar consentimiento'

export function enlaceConsentimiento(esMenor: boolean): string {
  return esMenor ? ENLACE_MENORES : ENLACE_ADULTO
}

export type Tutores = {
  T1_nombre_completo: string | null
  'T1_teléfono': string | null
  T2_nombre_completo: string | null
  'T2_teléfono': string | null
}

export type Actor = { nombre: string; id: string | null; rol: string }

type PacienteReenvio = { nombre: string; telefono: string | null; es_menor: boolean }

function limpio(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

/**
 * A quién se manda el enlace: a un adulto, a él mismo; a un menor, a cada
 * tutor que tenga teléfono. Sin teléfono → lista vacía (la pantalla avisa).
 */
export function destinatariosReenvio(p: PacienteReenvio, tutores: Tutores | null): { nombre: string; telefono: string }[] {
  if (!p.es_menor) {
    const tel = limpio(p.telefono)
    return tel ? [{ nombre: p.nombre, telefono: tel }] : []
  }
  if (!tutores) return []
  const lista: { nombre: string; telefono: string }[] = []
  const t1 = limpio(tutores['T1_teléfono'])
  if (t1) lista.push({ nombre: tutores.T1_nombre_completo ?? '', telefono: t1 })
  const t2 = limpio(tutores['T2_teléfono'])
  if (t2) lista.push({ nombre: tutores.T2_nombre_completo ?? '', telefono: t2 })
  return lista
}

/**
 * `datosProcesados` de la acción "Reenviar consentimiento" hacia Make.
 * Lleva `psicologo_id` porque Make busca al psicólogo (módulo 3) antes del router:
 * sin él, ninguna ruta se ejecuta aunque el webhook responda 200.
 */
export function payloadReenvio(
  p: PacienteReenvio & { id: string; psicologo_id: string | null; psicologo_nombre: string | null; centro_id: string | null },
  tutores: Tutores | null,
  actor: Actor,
): Record<string, unknown> {
  return {
    psicologo_id: p.psicologo_id,
    psicologo_nombre: p.psicologo_nombre,
    centro_id: p.centro_id,
    accion: ACCION_REENVIAR,
    paciente_id: p.id,
    paciente_nombre: p.nombre,
    telefono: limpio(p.telefono),
    es_menor: p.es_menor,
    enlace: enlaceConsentimiento(p.es_menor),
    tutor1_nombre: limpio(tutores?.T1_nombre_completo),
    tutor1_telefono: limpio(tutores?.['T1_teléfono']),
    tutor2_nombre: limpio(tutores?.T2_nombre_completo),
    tutor2_telefono: limpio(tutores?.['T2_teléfono']),
    created_by: actor.nombre,
    created_by_id: actor.id,
    origen: actor.rol,
  }
}

type CamposMarcado = Pick<PacienteInsert, 'consentimiento' | 'consentimiento_origen' | 'consentimiento_marcado_por' | 'consentimiento_marcado_en'>

export function marcarFirmado(actor: Actor, ahora: Date): CamposMarcado {
  return {
    consentimiento: true,
    consentimiento_origen: 'manual',
    consentimiento_marcado_por: actor.nombre,
    consentimiento_marcado_en: ahora.toISOString(),
  }
}

export function desmarcarFirmado(): CamposMarcado {
  return {
    consentimiento: false,
    consentimiento_origen: null,
    consentimiento_marcado_por: null,
    consentimiento_marcado_en: null,
  }
}

/** Campos de `asociados_menores` al marcar a mano: solo los tutores que existen. */
export function camposTutoresFirmados(soloUnTutor: boolean): Partial<AsociadoMenorInsert> {
  return soloUnTutor ? { T1_consentimiento: true } : { T1_consentimiento: true, T2_consentimiento: true }
}

const FECHA_MADRID = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
})

export function textoEstadoConsentimiento(
  p: Pick<Paciente, 'consentimiento' | 'consentimiento_origen' | 'consentimiento_marcado_por' | 'consentimiento_marcado_en'>,
): string {
  if (!p.consentimiento) return 'Pendiente'
  if (p.consentimiento_origen === 'manual' && p.consentimiento_marcado_por && p.consentimiento_marcado_en) {
    return `Firmado a mano por ${p.consentimiento_marcado_por} el ${FECHA_MADRID.format(new Date(p.consentimiento_marcado_en))}`
  }
  return 'Firmado'
}

/** Solo los agentes pueden quitar la marca de firmado. */
export function puedeDesmarcar(rol: string): boolean {
  return rol === 'agente' || rol === 'inspeccion'
}

export type CualTutor = 'T1' | 'T2' | 'ambos'

/** Desmarcar en un menor es por tutor (decisión de Sonia, 30-10-2026). */
export function camposTutoresDesmarcados(cual: CualTutor): Partial<AsociadoMenorInsert> {
  if (cual === 'T1') return { T1_consentimiento: false }
  if (cual === 'T2') return { T2_consentimiento: false }
  return { T1_consentimiento: false, T2_consentimiento: false }
}

/** Opciones del selector de desmarcado: cada tutor que existe y, si hay dos, "Los dos". */
export function opcionesDesmarcarTutores(tutores: Tutores): { cual: CualTutor; etiqueta: string }[] {
  const t1 = limpio(tutores.T1_nombre_completo) ?? 'Tutor 1'
  const t2 = limpio(tutores.T2_nombre_completo)
  const lista: { cual: CualTutor; etiqueta: string }[] = [{ cual: 'T1', etiqueta: t1 }]
  if (t2) lista.push({ cual: 'T2', etiqueta: t2 }, { cual: 'ambos', etiqueta: 'Los dos' })
  return lista
}

/** Al reenviar, se avisa si el consentimiento ya consta como firmado (Make lo marca al recibir el formulario). */
export function textoConfirmReenvio(nombre: string, firmado: boolean): string {
  return firmado
    ? `El consentimiento de ${nombre} ya está firmado. ¿Enviarlo de nuevo igualmente?`
    : `¿Enviar de nuevo el consentimiento a ${nombre}?`
}
