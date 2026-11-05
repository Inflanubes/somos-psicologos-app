# F1 — Calendario y bloqueos: notas

Rama `f1-calendario-bloqueos` · fuente: `docs/Feedback IA v2.docx` (raíz del proyecto) · migración reservada 024: **no se ha usado** (no hace falta tocar la base).

## Decisiones (Sonia, 05-11-2026)

- **Tarea 1 → opción A2.** Con «Citas a las medias horas» activado, las citas **solo** empiezan a y media (9:30, 10:30…). Sin la opción, solo en punto. Vale para todo: formulario, calendario y Dante.
- **Tareas 2 y 7 son dos pantallas distintas.** En la página **Calendario** (vista de todos los psicólogos, la del «X libres») se ocultan las bajas médicas y los asuntos propios. Esos días tampoco salen como libres. En el calendario de **Citas** (un solo psicólogo, en los paneles de agente, call center y psicólogo) se ven siempre los 4 tipos.

## Qué ha cambiado

| # | Cambio | Archivos |
|---|---|---|
| 1 | Los huecos libres ocupan 60 minutos en la rejilla. `generarHuecos`: sin medias horas, en punto; con medias horas, solo a y media (de 8:30 a 21:30). En el modo aviso del agente, las horas en punto de un psicólogo «a y media» salen como `media_hora`, con el texto «sus citas son a y media» y el aviso «X tiene las citas a y media». Se ha cambiado el texto de ayuda del interruptor en la ficha del psicólogo. | `lib/disponibilidad.ts`, `AgendaSemanal.tsx`, `TimeSelect.tsx`, `equipo/FichaPsicologo.tsx`, `equipo/page.tsx` |
| 2 | La página Calendario no pinta los bloqueos de «Baja médica» ni de «Asuntos propios» (`MOTIVOS_OCULTOS_VISTA_GENERAL`). Esos días siguen sin libres. Las vacaciones y los «Cerrado» sí se ven. | `lib/calendario.ts`, `CalendarioAgenda.tsx` (prop `ocultarMotivos`), `calendario/page.tsx` |
| 3 | En móvil, «Día ›» en domingo pasa al lunes de la semana siguiente y «‹ Día» en lunes vuelve al domingo anterior. | `CalendarioAgenda.tsx` |
| 4 y 5 | «Desbloquear» y «Modificar un bloqueo» listan los 4 tipos de bloqueo activos. | `lib/eventos-activos.ts`, `psicologos/page.tsx` (llamada y texto vacío) |
| 6 | En la app no había nada que arreglar: el fallo está en Make (ver abajo). | — |
| 7 | En la app queda cubierta con las tareas 4, 5 y 6. Lo que falta, el Telegram, es de F4 (tarea 20). | — |
| 8 | En el menú se llama «Cerrar agenda» (botón «Cerrar agenda»; aviso «No tienes permiso para cerrar la agenda. Habla con el equipo.»). En el calendario y en los selectores se ve «Cerrado» (`etiquetaMotivo`). | `lib/acciones-menu.ts`, `lib/disponibilidad.ts`, `lib/eventos-activos.ts`, `psicologos/page.tsx` |
| 9 | Con el rol psicólogo, un centro apagado no le quita huecos, ni en el formulario ni en el calendario. Su selector de centros ya no dice «(no recibe citas nuevas)». Agente y call center siguen igual. Dante sigue sin ofrecer esos centros. | `psicologos/page.tsx`, `CalendarioAgenda.tsx` |

## Para F4 / Make / Dante

- **Valores enviados a Make: sin cambios.** «Cerrar agenda» sigue enviando `accion = 'Bloquear agenda'`, que Make guarda con `motivo_bloqueo = 'Otros'`.
- **Desbloquear y Modificar con cualquier tipo (comprobado en el blueprint `Make blueprints/Formulario Citas Psicologos.blueprint.json`, exportado el 01-11):**
  - «Desbloquear agenda» (módulos 31 y 207) borra el evento por `gcal_event_id` y pone `activo = false` por `accion_id`. No mira el motivo.
  - «Modificar bloqueo personal» (módulos 222 y 226) mueve el evento por `gcal_event_id` y actualiza solo las fechas. El motivo se conserva.
  - No hace falta cambiar nada en Make.
- **Causa probable de las tareas 6 y 20 (baja médica):** en el blueprint, la ruta de baja (módulo 106) sigue filtrando por `accion = "Baja laboral"`. Desde la migración 020 (31-10) la app envía «Baja médica».
  - Resultado: Make descarta la baja. No se crea el evento, no se guarda la fila y no se envía el Telegram.
  - En la base no hay ninguna baja médica nueva. Las vacaciones, asuntos propios y cierre que Jaime creó el 02-11 sí se guardaron. La única baja es la antigua del 2 al 4 de noviembre, renombrada por la 020; agente y call center veían esa.
  - **Arreglo (Make):** en la ruta de baja, cambiar el filtro a `Baja médica`. Esa ruta ya guarda `motivo_bloqueo = "Baja médica"`.
- **Bloqueo general sin Telegram (tarea 20):** la ruta «Bloquear agenda» tiene el Telegram 212, pero envía el aviso al propio psicólogo (`chatId = 3.telefono`), no al equipo. Lo revisa F4.
- **Dante, tarea 1:** `/api/disponibilidad` mantiene el formato. Lo que cambia son las horas: para los psicólogos con medias horas, Dante ofrecerá solo horas a y media. Si alguien pide una hora en punto, `comprobarHueco` responde `media_hora`, el mismo motivo que ya existía para «media hora no activa».

## Ojo con los horarios (tarea 1, A2)

Hoy tienen medias horas activadas MARTA, Vega Marcos, Juan Casado y BEA, y todos tienen horarios en punto (9:00–14:00, 14:00–20:00). Con A2, en un tramo de 9:00 a 14:00 solo caben 9:30, 10:30, 11:30 y 12:30: se pierde una hora al día. Si deben tener 5 citas, hay que mover su horario a 9:30–14:30 (Psicólogos → Editar horario).

Citas futuras afectadas: solo BEA, el 18-11 a las 17:30, que ya cuadra con la nueva regla.

## Pruebas de aceptación

| # | Quién | Pasos | Resultado esperado |
|---|---|---|---|
| P1 | Agente | Calendario, filtrar por San Blas y por MARTA | Huecos de 1 hora (dos filas), solo a y media; nunca dos en la misma hora |
| P2 | Agente | Calendario sin filtros | Los «N libres» siguen saliendo; no aparecen bajas médicas ni asuntos propios; esos días no tienen libres. Vacaciones y «Cerrado» sí se ven |
| P3 | Agente / call center / psicólogo | Citas, calendario de un psicólogo con baja, asuntos propios, vacaciones y cierre | Se ven los cuatro |
| P4 | Cualquiera (móvil) | Calendario en domingo, pulsar «Día ›»; en lunes, pulsar «‹ Día» | Pasa al lunes siguiente / al domingo anterior |
| P5 | Agente | Bloquear / Desbloquear agenda → Desbloquear | Lista los 4 tipos activos; al quitar una vacación desaparece del calendario y de Google Calendar |
| P6 | Agente | → Modificar un bloqueo | Lista los 4 tipos (también «Cerrado»); al cambiar fechas se conserva el tipo |
| P7 | Agente | → Tipo de bloqueo | La opción se llama «Cerrar agenda»; en el calendario sale «Cerrado» |
| P8 | Psicólogo con un centro apagado | Citas | Su selector no dice «no recibe citas nuevas»; ve y puede usar sus huecos allí. El call center no puede agendarle en ese centro |
| P9 | Agente | Agendar con MARTA, modo aviso | Horas en punto con «· sus citas son a y media»; al elegirla, aviso «MARTA tiene las citas a y media» |
| P10 | Psicólogo (tras arreglar Make) | Baja médica | Se crea, llega Telegram y se ve en los 3 paneles |

## Verificación

`npx tsc --noEmit` sin errores · `npx vitest run`: 249 tests en verde · `npm run build` correcto. Los errores de lint que aparecen ya estaban antes, en archivos que F1 no toca.
