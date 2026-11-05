// lib/eliminar-usuario.ts
// Eliminar un usuario desde Accesos (feedback v2, tarea 17). Lógica pura; la
// API y la pantalla llaman aquí. Decisiones de Sonia (05-11-2026):
// - Psicólogo: no se puede borrar si algún paciente no tiene otro psicólogo
//   (hay que reasignarlo antes). Se borran sus citas y bloqueos de la app;
//   si tiene citas futuras se avisa de que siguen en su Google Calendar.
// - Agente, call center e inspección: se borra la cuenta; lo que registraron
//   (citas, altas) se conserva con su nombre.

export type TipoUsuarioEliminar = 'psicologo' | 'agente' | 'call_center' | 'inspeccion'

type PacientePsicologos = {
  id: string
  nombre: string
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
}

/** Pacientes que se quedarían sin ningún psicólogo si se borra este. */
export function pacientesSinOtroPsicologo<T extends PacientePsicologos>(pacientes: T[], psicologoId: string): T[] {
  return pacientes.filter((p) => {
    const ids = [p.psicologo_adultos_id, p.psicologo_pareja_id, p.psicologo_infantil_id]
    return ids.includes(psicologoId) && ids.every((x) => x === null || x === psicologoId)
  })
}

/** Texto pedido por Jaime (feedback v2, 9.1). */
export const AVISO_HISTORICO = 'Ten en cuenta que se eliminará todo su histórico de citas.'

export function textoConfirmEliminar(tipo: TipoUsuarioEliminar, nombre: string, impacto: { citasFuturas: number }): string {
  const pregunta = `Vas a eliminar a ${nombre}. ¿Estás seguro de que quieres eliminar este usuario?`
  if (tipo !== 'psicologo') {
    return `${pregunta}\n\nPerderá el acceso a la app. Las citas y altas que registró se conservan con su nombre.`
  }
  const n = impacto.citasFuturas
  const calendario = n > 0
    ? `\n\nTiene ${n} ${n === 1 ? 'cita futura' : 'citas futuras'} en la app: se borrarán aquí, pero seguirán en su Google Calendar y no se avisará a los pacientes.`
    : ''
  return `${pregunta}\n\n${AVISO_HISTORICO}${calendario}\n\nNo se puede deshacer.`
}

export function textoBloqueoEliminar(nombre: string, pacientes: { nombre: string }[]): string {
  return `No se puede eliminar a ${nombre}: estos pacientes no tienen otro psicólogo asignado: ` +
    `${pacientes.map((p) => p.nombre).join(', ')}. Asígnales otro psicólogo en Pacientes (botón Editar) y vuelve a intentarlo.`
}
