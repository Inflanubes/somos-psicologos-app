// Pie que llevan todos los mensajes que salen a pacientes por /api/webhook/mensajes
// (Comunicaciones y Mensajes de psicólogos). Tarea 37 de la reunión del 21-10-2026.

// Contacto que se da al paciente. Al pasar a WhatsApp, poner aquí el número de Dante.
export const CONTACTO_DANTE = '91 166 50 47'

export function pieMensaje(contacto: string = CONTACTO_DANTE): string {
  return `Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: ${contacto}`
}

// Añade el pie separado por una línea en blanco. Si el mensaje ya lo lleva
// (reenvío o doble clic), lo devuelve tal cual.
export function conPie(mensaje: string, contacto: string = CONTACTO_DANTE): string {
  const pie = pieMensaje(contacto)
  const texto = mensaje.trimEnd()
  if (texto.endsWith(pie)) return texto
  return texto ? `${texto}\n\n${pie}` : pie
}

// Mensajes que no van a un paciente y por tanto no llevan el pie
// (el aviso al psicólogo de Comunicaciones › Hablar con Psicólogo).
const SIN_PIE = new Set(['notificar_psicologo'])

export function llevaPie(tipo: unknown): boolean {
  return !(typeof tipo === 'string' && SIN_PIE.has(tipo))
}
