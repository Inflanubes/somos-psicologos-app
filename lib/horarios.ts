/**
 * Horarios semanales de los psicólogos (migraciones 012 y 016). Módulo puro:
 * sin React ni Supabase, para poder probarlo con Vitest y usarlo en cliente y
 * servidor. Desde la 016 cada tramo pertenece a un centro.
 */

/**
 * Tramo de trabajo. dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM' o 'HH:MM:SS'.
 * centro_id es opcional aquí para no romper a quien no lo use; la API lo exige.
 */
export type Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string; centro_id?: string }

/** Centro tal como lo necesita la validación: su nombre y si es el centro Online. */
export type CentroHorario = { id: string; nombre: string; es_online: boolean }

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/** 'HH:MM' | 'HH:MM:SS' → minutos desde medianoche. NaN si no es una hora. */
export function aMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim())
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutos desde medianoche → 'HH:MM'. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 'HH:MM:SS' → 'HH:MM' (deja 'HH:MM' igual). */
export function normalizarHora(hora: string): string {
  return aHora(aMinutos(hora))
}

type TramoMin = { ini: number; fin: number; centro_id?: string }

function tramosDelDia(tramos: Tramo[], dia: number): TramoMin[] {
  return tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => ({ ini: aMinutos(t.hora_inicio), fin: aMinutos(t.hora_fin), centro_id: t.centro_id }))
    .sort((a, b) => a.ini - b.ini)
}

/**
 * Dos tramos del mismo día que se cruzan: ¿se permite? Solo si son de centros
 * distintos y alguno de los dos es el centro Online (videollamada desde el
 * despacho). Sin centro en alguno de los dos, o sin lista de centros, no.
 */
function puedenSolaparse(a: TramoMin, b: TramoMin, centros?: CentroHorario[]): boolean {
  if (!centros || !a.centro_id || !b.centro_id || a.centro_id === b.centro_id) return false
  const ca = centros.find((c) => c.id === a.centro_id)
  const cb = centros.find((c) => c.id === b.centro_id)
  return !!(ca?.es_online || cb?.es_online)
}

function nombreCentro(id: string | undefined, centros: CentroHorario[]): string {
  return centros.find((c) => c.id === id)?.nombre ?? '?'
}

/**
 * Valida una lista de tramos. Devuelve el mensaje de error (en español) o null.
 * Reglas: día 1..7, horas válidas, fin posterior al inicio, sin solapamientos
 * dentro del mismo día (los tramos contiguos se permiten). Con `centros`, un
 * tramo del centro Online puede solaparse con uno presencial; dos presenciales
 * de centros distintos, o dos del mismo centro, no.
 */
export function validarTramos(tramos: Tramo[], centros?: CentroHorario[]): string | null {
  for (const t of tramos) {
    if (!Number.isInteger(t.dia_semana) || t.dia_semana < 1 || t.dia_semana > 7) {
      return 'Día de la semana no válido.'
    }
    const nombre = DIAS_SEMANA[t.dia_semana - 1]
    const ini = aMinutos(t.hora_inicio)
    const fin = aMinutos(t.hora_fin)
    if (Number.isNaN(ini) || Number.isNaN(fin)) return `Hora no válida en ${nombre}.`
    if (fin <= ini) return `En ${nombre} la hora de fin debe ser posterior a la de inicio.`
  }
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    for (let i = 0; i < delDia.length; i++) {
      for (let j = i + 1; j < delDia.length; j++) {
        const a = delDia[i]
        const b = delDia[j]
        if (b.ini >= a.fin) continue // ya no se cruzan (están ordenados por inicio)
        if (puedenSolaparse(a, b, centros)) continue
        if (centros) {
          return `Los tramos del ${DIAS_SEMANA[d - 1].toLowerCase()} se solapan (${nombreCentro(a.centro_id, centros)} ${aHora(a.ini)}–${aHora(a.fin)} y ${nombreCentro(b.centro_id, centros)} ${aHora(b.ini)}–${aHora(b.fin)}).`
        }
        return `Los tramos de ${DIAS_SEMANA[d - 1]} se solapan.`
      }
    }
  }
  return null
}

function resumenSinCentros(tramos: Tramo[]): string {
  const grupos: { dias: number[]; texto: string }[] = []
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    if (delDia.length === 0) continue
    const texto = delDia.map((t) => `${aHora(t.ini)}–${aHora(t.fin)}`).join(' y ')
    const grupo = grupos.find((g) => g.texto === texto)
    if (grupo) grupo.dias.push(d)
    else grupos.push({ dias: [d], texto })
  }
  return grupos.map((g) => `${g.dias.map((d) => DIAS_CORTOS[d - 1]).join(', ')} ${g.texto}`).join(' · ')
}

/**
 * Resumen compacto para la tabla de Psicólogos: 'L, X 09:00–14:00 · V 16:00–20:00'.
 * Los días con exactamente los mismos tramos se agrupan. Con `centros` y tramos
 * con centro_id, agrupa por centro ordenado por nombre:
 * 'Online: M 16:00–20:00 · San Blas: L, X 10:00–14:00'. '' si no hay tramos.
 */
export function resumenHorario(tramos: Tramo[], centros?: CentroHorario[]): string {
  if (!centros || tramos.every((t) => !t.centro_id)) return resumenSinCentros(tramos)
  const porCentro = new Map<string, Tramo[]>()
  for (const t of tramos) {
    const clave = t.centro_id ?? ''
    porCentro.set(clave, [...(porCentro.get(clave) ?? []), t])
  }
  return [...porCentro.entries()]
    .map(([id, ts]) => ({ nombre: nombreCentro(id, centros), ts }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(({ nombre, ts }) => `${nombre}: ${resumenSinCentros(ts)}`)
    .join(' · ')
}
