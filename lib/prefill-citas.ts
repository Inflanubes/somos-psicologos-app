/**
 * Relleno del formulario de Citas desde el calendario ("Cambiar cita"). La
 * lista de citas activas del paciente se carga en un efecto que solo se
 * dispara cuando cambian la acción o el paciente: si ya estaban elegidos, no
 * habrá carga nueva que esperar y se pasa directamente a comprobar la cita.
 */
export function faseTrasFijarAccion(p: { accionActual: string; pacienteActual: string; pacientePrefill: string }): 3 | 4 {
  return p.accionActual === 'Cambiar cita' && p.pacienteActual === p.pacientePrefill ? 4 : 3
}
