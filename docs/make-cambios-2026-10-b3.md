# Make — bloque B3 (reglas del call center): campo `operador`

Escenario: **Formulario Citas Psicologos** (webhook `bfgrht…`). Mismo escenario que en
`Z:\Claude\Somos Psicológos\docs\make-cambios-2026-10-22.md` (rutas 6 a 9).

## Estado

- **App: hecho** en la rama `b3-reglas-call-center` (30-10-2026).
- **Supabase: migración `017_operador.sql`** (columna `operador text` en `pacientes`, `acciones_psicologos`
  y `acciones_historial`; el trigger de historial la copia). La aplica Sonia de madrugada. `Aplicada el: ______`
  **Bloqueante: aplicar la migración ANTES de desplegar la app.** Si la app nueva sale sin la columna, el buscador
  por teléfono da error y las altas del call center con operador fallan (las de agentes y psicólogos siguen).
- **Make: pendiente de Sonia.** `Hecho el: ______`

## Qué manda la app

En **todas** las acciones de Citas (agendar, cambiar, cancelar, bloqueos, altas, avisos y solicitudes) el
payload lleva un campo nuevo:

```
datosProcesados.operador   → texto libre ("Ana") o null
```

Solo el call center lo rellena (campo "Operador" encima del formulario, se recuerda en su navegador).
Para agentes, psicólogos y Dante llega `null`. Nada se bloquea si está vacío.

Las **altas** (`Añadir nuevo paciente`) ya guardan `pacientes.operador` desde la app: Make no tiene que
hacer nada en la ruta 14.

## Qué hay que mapear en Make

Hasta que se mapee, las citas llegan sin operador (no rompe nada; la columna queda a null).

| Ruta | Acción | Módulo que escribe en `acciones_psicologos` | Campo a añadir |
|---|---|---|---|
| 1 | Agendar cita | el **Insert** de la fila `Agendar cita` | `operador` = `{{1.datosProcesados.operador}}` |
| 3 | Cambiar cita | el **Update** por `accion_id` | `operador` = `{{1.datosProcesados.operador}}` |
| 4 | Cancelar cita | el **Update** por `accion_id` | `operador` = `{{1.datosProcesados.operador}}` |

Notas:
- En las rutas 3 y 4 se **sobrescribe** el operador con el de la última acción (igual que `ultima_accion_por`).
  Si se prefiere conservar el del alta de la cita, mapear solo la ruta 1 y dejar las otras dos sin tocar.
- Si se mapea en 3 y 4, **mapear también el vacío** (que un `null` de la app deje la columna a `null`, sin la opción
  "no actualizar si está vacío"): si no, una cita del call center que luego cambia un agente copiaría al historial el
  operador antiguo junto al `realizado_por` del agente.
- El trigger de historial (`registrar_historial_accion`, migración 017) copia `operador` a `acciones_historial`
  en cada acción, así que las estadísticas por operador saldrán del historial sin más cambios.
- No es necesario tocar las rutas 5, 10, 11, 12 ni 15 (bloqueos): el campo llega pero no hace falta guardarlo.

## Opcional: Telegram

En los avisos de Telegram que salen de acciones del call center (rutas 6 a 9 y las de cita si se quiere)
se puede añadir al final:

```
{{if(1.datosProcesados.operador; " Operador: " + 1.datosProcesados.operador; "")}}
```

## Acciones de solicitud (rutas 6 a 9) — recordatorio

La app ya envía `Otro` (ruta 9) desde call center y agentes, con `paciente_id`, `paciente_iniciales`,
`centro_id`, `psicologo_id`, `comentario`, `operador` y la atribución (`created_by`, `created_by_id`, `origen`).
Las otras tres (`Sin disponibilidad`, `hablar con psicologo`, `Cambio solicitado`) se activan en la app en
`lib/call-center.ts` → `ACCIONES_SOLICITUD_ACTIVAS` cuando Jaime decida (tarea 51). Además, la app envía
`Cambio solicitado` (ruta 8) cuando el call center intenta dar de alta un teléfono cuyo tipo de consulta ya tiene
otro psicólogo y el paciente aún no ha tenido cita con él ("Solicitar cambio de psicólogo"; si ya la tuvo, la app
le manda a escribirlo en "Otros", ruta 9). En ese envío `psicologo_id` / `psicologo_nombre` son el
psicólogo **actual** del paciente (el Telegram de la ruta 8 dice "antes estaba con {{3.nombre}}") y el deseado
viaja en `comentario` ("Pide pasar a …") y en `psicologo_deseado_id` / `psicologo_deseado_nombre` (campos nuevos,
Make puede ignorarlos). Make no necesita cambios para esto: las rutas están listas desde el 22-10.
