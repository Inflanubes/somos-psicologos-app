# Dante — cambios del bloque B1 (horarios por centro) — 29-10-2026

Qué cambia: Dante deja de pedir los huecos al escenario de Make de disponibilidad y se los pide a la app (`POST /api/disponibilidad`), que aplica las mismas reglas que el formulario de Citas: horario del psicólogo **en ese centro**, hora libre, sin bloqueo, no pasada, al menos 2 h de antelación y centro que recibe citas nuevas. Además, antes de mandar un "Agendar cita" o "Cambiar cita" a Make, `EjecutarAccion` comprueba la hora con la app y rechaza la que no pase (Dante ya no puede inventar horas). Make **no cambia**: sigue agendando, cambiando y cancelando como hasta ahora.

Archivos tocados (fuera del repo git, copias en `n8n/tools/_backups/` y `n8n/workflows/_backups/` con fecha 2026-10-29):

- `n8n/tools/_comun.js`: constantes `APP_URL`, `APP_API_TOKEN` (marcador `__DANTE_API_TOKEN__`) y helper `appPost`.
- `n8n/tools/ejecutar-accion.js`: bloque "Comprobar la hora con la app antes de mandar nada a Make".
- `n8n/tools/build-workflow.mjs`: exige `DANTE_API_TOKEN`; nodo `BuscarDisponibilidad` apunta a la app con cabecera `Authorization`; `ListarPsicologos` filtra `centro_activo=eq.true`.
- `n8n/prompts/somos-system-prompt.md`: centros alternativos cuando no hay huecos y qué hacer si `EjecutarAccion` responde con `motivo`.
- `n8n/workflows/somos-main-agent.json`: regenerado (revisión 2026-10-29). Lleva el token en claro, como el del bot.

## Pasos para Sonia (en este orden)

1. **Token.** En `somos-app/.env.local` ya hay una línea `DANTE_API_TOKEN=…` (generada el 29-10-2026). Pon **el mismo valor** como variable de entorno en el hosting de somos.eltodi.net y despliega la rama `b1-horarios-por-centro` (o `main` una vez fusionada). Sin la variable el endpoint responde 500 `DANTE_API_TOKEN no configurado`; con un token distinto, 401.
   - Si cambias el token, regenera el workflow: en PowerShell, `$env:DANTE_API_TOKEN='…'; node n8n/tools/build-workflow.mjs`, y vuelve a importar el JSON.
2. **Migración 016** aplicada (Tarea 12 del plan B1): el endpoint lee `horarios_psicologos.centro_id`, `psicologos_centros.activo` y `centros.es_online`. Sin ella devuelve 500.
3. **Prueba en un workflow copia** de n8n: importa `n8n/workflows/somos-main-agent.json` en una copia (no en producción), con un chat de prueba:
   - Pide huecos: tienen que caer dentro de la franja del psicólogo en ese centro y con más de 2 h de margen respecto a ahora.
   - Pide una cita "a las 10:15": `EjecutarAccion` responde `ok:false` con `motivo: hora_no_valida` y Dante ofrece otra hora.
   - Pide una hora fuera del horario del psicólogo (p. ej. a las 15:00 si trabaja de 10 a 14): rechazo con `motivo: fuera_horario`.
   - Agenda un hueco válido: Make lo procesa como siempre y llega la confirmación.
   - Si el psicólogo no tiene hueco en su centro pero sí en otro, Dante debe ofrecer el otro centro (`centros_alternativos`) antes de registrar "Sin disponibilidad".
4. **Producción.** Importa el mismo JSON en el workflow de producción (Dante sigue en producción: hazlo de madrugada o con el cron parado) y reactívalo.
5. **Make.** El escenario de disponibilidad (webhook `dthvwqk4ylang6vd5g84ewsfxkyxmi3s`) deja de recibir llamadas. Desactívalo cuando lleve una semana sin ejecuciones.

## Formato de la respuesta de la app (por si hay que depurar)

- `tipo: "psicologo"` / `"centro"` → `{ psicologo_id, psicologo_nombre, huecos: [{fecha, hora}], motivo?, centros_alternativos?: [{centro_id, nombre, primer_hueco}] }`. Hasta 10 huecos en 14 días.
- `tipo: "comprobar"` → `{ ok: true }` o `{ ok: false, motivo }` con `motivo` ∈ `ocupado | pasado | antelacion | bloqueado | fuera_horario | centro_inactivo | media_hora | hora_no_valida | psicologo_inactivo`.
- Códigos: 401 token malo, 400 cuerpo incompleto, 500 error de base de datos o token sin configurar.
