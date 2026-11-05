// lib/entidades.ts
// Subpestañas Parejas y Menores de Pacientes (feedback v2, tarea 14): quién forma
// cada «entidad» y el estado del consentimiento de cada persona. Lógica pura;
// la pantalla carga pacientes y asociados_menores y llama aquí.

type PersonaBase = {
  id: string
  nombre: string
  telefono: string | null
  es_menor: boolean
  consentimiento: boolean | null
  psicologo_pareja_id: string | null
  pareja_de: string | null
}

export type Pareja<T extends PersonaBase> = {
  /** Una o dos personas; con una sola, la segunda no se registró en el alta. */
  personas: T[]
}

/**
 * Parejas: dos fichas enlazadas por `pareja_de` (en cualquier sentido, migración 018)
 * son una pareja. Una ficha con psicólogo de pareja y sin enlace sale sola.
 */
export function agruparParejas<T extends PersonaBase>(pacientes: T[]): Pareja<T>[] {
  const porId = new Map(pacientes.map((p) => [p.id, p]))
  const usados = new Set<string>()
  const parejas: Pareja<T>[] = []
  for (const p of pacientes) {
    if (usados.has(p.id)) continue
    const otra =
      (p.pareja_de && porId.get(p.pareja_de) && !usados.has(p.pareja_de) ? porId.get(p.pareja_de)! : null) ??
      pacientes.find((q) => q.pareja_de === p.id && q.id !== p.id && !usados.has(q.id)) ??
      null
    if (!otra && !p.psicologo_pareja_id && !p.pareja_de) continue
    usados.add(p.id)
    if (otra) usados.add(otra.id)
    parejas.push({ personas: otra ? [p, otra] : [p] })
  }
  return parejas
}

export type FilaTutores = {
  id_menor: string
  T1_nombre_completo: string | null
  'T1_teléfono': string | null
  T1_consentimiento: boolean | null
  T1_paciente_id: string | null
  T2_nombre_completo: string | null
  'T2_teléfono': string | null
  T2_consentimiento: boolean | null
  T2_paciente_id: string | null
}

export type Tutor = {
  cual: 'T1' | 'T2'
  nombre: string
  telefono: string | null
  firmado: boolean
  /** El tutor también es paciente (migración 014). */
  paciente_id: string | null
}

export type Menor<T extends PersonaBase> = { menor: T; tutores: Tutor[] }

function limpio(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

/** Menores: cada uno con los tutores que existen y si ha firmado cada uno. */
export function agruparMenores<T extends PersonaBase>(pacientes: T[], filas: FilaTutores[]): Menor<T>[] {
  const porMenor = new Map(filas.map((f) => [f.id_menor, f]))
  return pacientes
    .filter((p) => p.es_menor)
    .map((menor) => {
      const f = porMenor.get(menor.id)
      const tutores: Tutor[] = []
      if (f) {
        for (const cual of ['T1', 'T2'] as const) {
          const nombre = limpio(f[`${cual}_nombre_completo`])
          const telefono = limpio(f[`${cual}_teléfono`])
          if (!nombre && !telefono) continue
          tutores.push({
            cual,
            nombre: nombre ?? (cual === 'T1' ? 'Tutor 1' : 'Tutor 2'),
            telefono,
            firmado: !!f[`${cual}_consentimiento`],
            paciente_id: f[`${cual}_paciente_id`] ?? null,
          })
        }
      }
      return { menor, tutores }
    })
}

export type EstadoEntidad = 'completo' | 'parcial' | 'pendiente'

/** Consentimiento de la entidad entera: completo si firman todos. */
export function estadoEntidad(firmas: boolean[]): EstadoEntidad {
  const n = firmas.filter(Boolean).length
  if (firmas.length > 0 && n === firmas.length) return 'completo'
  return n > 0 ? 'parcial' : 'pendiente'
}

export const TEXTO_ESTADO_ENTIDAD: Record<EstadoEntidad, string> = {
  completo: 'Consentimiento completo',
  parcial: 'Faltan firmas',
  pendiente: 'Sin firmar',
}

/** Búsqueda en las personas de una entidad: nombre o teléfono. */
export function coincideBusqueda(personas: { nombre: string; telefono: string | null }[], texto: string): boolean {
  const q = texto.toLowerCase().trim()
  if (!q) return true
  return personas.some((x) => (x.nombre ?? '').toLowerCase().includes(q) || (x.telefono ?? '').includes(q))
}
