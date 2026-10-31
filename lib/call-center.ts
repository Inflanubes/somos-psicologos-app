/**
 * Reglas del call center (bloque B3, octubre 2026). Módulo puro: sin React ni
 * Supabase. La pantalla Citas, el buscador por teléfono y Pacientes lo llaman.
 *
 * Diseño: docs/superpowers/specs/2026-10-26-b3-reglas-call-center-design.md
 */

export type Rol = 'agente' | 'psicologo' | 'call_center' | 'inspeccion'

/**
 * El call center no puede cambiar ni anular citas creadas por un psicólogo.
 * Las citas antiguas sin `origen` (anteriores a la migración 004) se tratan
 * como permitidas. Agentes y psicólogos no tienen restricción.
 */
export function puedeGestionarCita(rol: Rol, origenCita: string | null): boolean {
  if (rol !== 'call_center') return true
  return origenCita !== 'psicologo'
}

// ── Acciones de solicitud hacia el equipo ───────────────────────────────────
// Textos EXACTOS que esperan las rutas de Make (docs/make-cambios-2026-10-22.md).
export const ACCIONES_SOLICITUD = ['Otro', 'Sin disponibilidad', 'hablar con psicologo', 'Cambio solicitado'] as const
export type AccionSolicitud = (typeof ACCIONES_SOLICITUD)[number]

/** Las que se ofrecen en pantalla, en este orden. Jaime aprobó las cuatro el 31-10-2026 (tarea 51 del tablero). */
export const ACCIONES_SOLICITUD_ACTIVAS: readonly AccionSolicitud[] = ['Sin disponibilidad', 'hablar con psicologo', 'Cambio solicitado', 'Otro']

/** Etiquetas de pantalla; a Make viaja siempre el texto de ACCIONES_SOLICITUD. */
export const ETIQUETA_SOLICITUD: Record<AccionSolicitud, string> = {
  Otro: 'Otros (aviso al equipo)',
  'Sin disponibilidad': 'Sin cita disponible',
  'hablar con psicologo': 'Pendiente de psicólogo',
  'Cambio solicitado': 'Cambio de psicólogo',
}

export function esAccionSolicitud(a: string): a is AccionSolicitud {
  return (ACCIONES_SOLICITUD as readonly string[]).includes(a)
}

// ── Operador ────────────────────────────────────────────────────────────────
/** Lo que se guarda cuando el call center no escribe su nombre (decisión de Sonia, 30-10-2026). */
export const OPERADOR_SIN_NOMBRE = 'agente en general'

/**
 * Valor de `operador` que viaja con cada acción: el nombre escrito por el call center,
 * "agente en general" si lo deja vacío (así se ve que no lo puso), y null para los demás roles.
 */
export function operadorParaEnvio(rol: Rol, texto: string): string | null {
  if (rol !== 'call_center') return null
  return texto.trim() || OPERADOR_SIN_NOMBRE
}

// ── Operador recordado en el navegador ──────────────────────────────────────
const CLAVE_OPERADOR = 'operador:'

/** Nombre de operador guardado para este usuario (vacío si no hay o localStorage falla). */
export function leerOperador(userId: string): string {
  try {
    return window.localStorage.getItem(CLAVE_OPERADOR + userId) ?? ''
  } catch {
    return ''
  }
}

export function guardarOperador(userId: string, valor: string): void {
  try {
    if (valor.trim()) window.localStorage.setItem(CLAVE_OPERADOR + userId, valor)
    else window.localStorage.removeItem(CLAVE_OPERADOR + userId)
  } catch {
    // localStorage lleno o bloqueado: el operador vive solo en memoria.
  }
}

// ── Teléfono ────────────────────────────────────────────────────────────────
/** Solo dígitos. */
export function normalizarTelefono(s: string): string {
  return s.replace(/\D/g, '')
}

/** Últimos 9 dígitos (o todos si hay menos): así "+34 600…" encuentra "600…". */
export function sufijoBusquedaTelefono(s: string): string {
  const d = normalizarTelefono(s)
  return d.length > 9 ? d.slice(-9) : d
}

/**
 * Patrón `ilike` con comodín entre dígitos: encuentra también teléfonos guardados
 * con espacios, guiones o prefijo ("600 11 22 33", "+34600112233"). Con 9 dígitos
 * apenas da falsos positivos.
 */
export function patronBusquedaTelefono(s: string): string {
  const d = sufijoBusquedaTelefono(s)
  return d ? `%${d.split('').join('%')}%` : ''
}

// ── Alta con teléfono existente ─────────────────────────────────────────────
type PsicologosFicha = {
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
}

/**
 * Psicólogo actual del paciente existente: el que ocupa la columna del tipo elegido,
 * o si está libre el primero de la ficha. Es el que se manda a Make en 'Cambio
 * solicitado' (su Telegram dice "antes estaba con …"); el deseado va en el comentario.
 */
export function psicologoActualExistente(p: PsicologosFicha, columnaOcupadaPor: string | null): string | null {
  return columnaOcupadaPor ?? p.psicologo_adultos_id ?? p.psicologo_pareja_id ?? p.psicologo_infantil_id ?? null
}

export type AccionAltaExistente = 'vincular' | 'solicitar_cambio' | 'escribir_en_otros'

/**
 * Qué botón principal ve quien da de alta un teléfono que ya existe (regla de Sonia, 30-10-2026):
 * - agentes y psicólogos: vinculan siempre;
 * - call center con la columna del tipo libre (alta normal de pareja): vincula;
 * - call center con otro psicólogo en ese tipo y el paciente SIN cita pasada con él
 *   (primera cita aún no celebrada): puede solicitar el cambio de psicólogo (ruta Cambio solicitado);
 * - call center y el paciente YA ha tenido cita con su psicólogo: no puede pedir el cambio aquí,
 *   tiene que escribir la solicitud en "Otros (aviso al equipo)".
 */
export function accionAltaExistente(rol: Rol, columnaOcupada: boolean, yaVistoPorPsicologo: boolean): AccionAltaExistente {
  if (rol !== 'call_center' || !columnaOcupada) return 'vincular'
  return yaVistoPorPsicologo ? 'escribir_en_otros' : 'solicitar_cambio'
}

// ── Citas el mismo día ──────────────────────────────────────────────────────
export type CitaDia = {
  id: string
  fecha: string
  hora: string
  psicologoNombre: string
  psicologoId: string
  centroId: string | null
}

function minutosDe(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

/**
 * Citas del paciente en la misma fecha que la que se quiere agendar.
 * `seguida` = exactamente una hora antes o después. `excluirId` deja fuera la
 * propia cita cuando se está cambiando.
 */
export function citasMismoDia(
  citas: CitaDia[],
  fecha: string,
  hora: string,
  excluirId?: string,
): { cita: CitaDia; seguida: boolean }[] {
  const objetivo = minutosDe(hora)
  return citas
    .filter((c) => c.fecha === fecha && c.id !== excluirId)
    .map((c) => ({ cita: c, seguida: Math.abs(minutosDe(c.hora) - objetivo) === 60 }))
}

// ── Histórico ───────────────────────────────────────────────────────────────
export function estadoCitaHistorico(
  c: { activo: boolean; fecha_cita: string | null },
  hoy: string,
): 'activa' | 'pasada' | 'anulada' {
  if (!c.activo) return 'anulada'
  if (c.fecha_cita && c.fecha_cita < hoy) return 'pasada'
  return 'activa'
}

/** "Call center (Ana)" para el agente; "Call center" para los demás. */
export function etiquetaOrigen(origen: string | null, operador: string | null, rolQueMira: Rol): string {
  switch (origen) {
    case 'call_center': {
      const op = operador?.trim()
      return (rolQueMira === 'agente' || rolQueMira === 'inspeccion') && op ? `Call center (${op})` : 'Call center'
    }
    case 'dante':
      return 'Dante'
    case 'psicologo':
      return 'Psicólogo'
    case 'agente':
      return 'Agente'
    case 'inspeccion':
      return 'Inspección'
    default:
      return ''
  }
}

// ── Textos ──────────────────────────────────────────────────────────────────
/** "2026-10-27" → "27/10/2026" */
function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return y && m && d ? `${d}/${m}/${y}` : fecha
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** "2026-10-27" → "martes 27/10" (sin pasar por new Date('YYYY-MM-DD')). */
function diaConFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const dia = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${dia} ${dd}/${mm}`
}

export function comentarioAvisoCita(
  c: { fecha: string; hora: string; psicologoNombre: string },
  texto: string,
): string {
  return `Solicita cambiar o anular la cita del ${fechaCorta(c.fecha)} a las ${c.hora.slice(0, 5)} con ${c.psicologoNombre} (creada por el psicólogo): ${texto.trim()}`
}

export function comentarioCambioPsicologo(nombrePsicologo: string, operador: string | null): string {
  const op = operador?.trim()
  return `Pide pasar a ${nombrePsicologo}.` + (op ? ` Operador: ${op}.` : '')
}

export function textoAvisoMismoDia(c: CitaDia): string {
  return `Este paciente ya tiene cita el ${diaConFecha(c.fecha)} a las ${c.hora.slice(0, 5)} con ${c.psicologoNombre}. ¿Quieres modificarla o es otra cita (por ejemplo, de pareja)?`
}
