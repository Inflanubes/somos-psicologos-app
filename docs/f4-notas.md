# F4 — Dante y Make (feedback v2 de Jaime, 05-11-2026)

Rama `f4-dante-make` · carpeta `somos-app-f4` · migración reservada `027` (no hace falta).
Tareas 19–24 del tablero `docs/backlog-2026-11-05-feedback-v2.md`.

Este bloque **no cambia código de la app**: todo está en Make, en Dante (carpeta `n8n/` de la raíz, fuera del repo)
y en datos de prueba. Este archivo es la guía para hacerlo y probarlo.

## 0. Resumen

| # | Problema | Causa encontrada | Arreglo | Quién |
|---|---|---|---|---|
| 19 | No llega Telegram de «Sin cita disponible», «Hablar con el psicólogo» y «Cambio de psicólogo» (sí «Otros») | Esas tres rutas guardan el estado del paciente antes de avisar; el guardado fallaba por `nombre` vacío (alertas BananaErrors del 01-11). «Otros» no guarda nada, por eso sí llegaba. **Ya arreglado en Make el 01-11 por la tarde**; prueba: «pepitogrillo» (02-11 08:51) quedó en «Cambio solicitado». Las pruebas de Jaime son de antes del arreglo. | Nada nuevo. Repetir la prueba (§5, P1–P3). Opcional: paso 1C | Jaime repite |
| 20a | No llega Telegram de **baja médica** | En Make, el filtro de la ruta de la baja (módulo 106) sigue siendo `accion = Baja laboral`, y la app manda `Baja médica` desde el 31-10. La baja no hace **nada**: ni evento, ni fila, ni aviso. Comprobado en la base: después del 31-10 no hay ninguna baja guardada. La que ve Jaime en los paneles es la del 21-10. | Paso 1A | **Hecho 05-11** (blueprint 14:15) |
| 20b | No llega Telegram de **bloqueo general** («Cerrar agenda») | La ruta 5 de Make solo escribe al **psicólogo** (módulo 212), nunca a los agentes. Además, la ficha del psicólogo «JAIME» tiene el chat de **Sonia** (5456273411), así que ese mensaje le llegó a Sonia, no a Jaime. | Paso 1B. Chat de «JAIME» ya cambiado al de Jaime (§4) | **Hecho 05-11** (router 289, módulos 290–291) |
| 21 | Dante se queda colgado al confirmar la cita de «PapáJaime» y no crea el paciente | Ejecuciones 617739–617756 (01-11, 18:18–18:27). Fallaron dos cosas: **(1)** la memoria guardaba solo los últimos 10 mensajes, la conversación tuvo 15 y Dante «olvidó» el nombre y el móvil y los volvió a pedir; **(2)** su último mensaje fue «Voy a comprobar ahora el centro y el psicólogo antes de resumirte los datos.» y ahí terminó, sin llamar a ninguna herramienta. Nunca llegó a llamar a `RegistrarPaciente`. | Memoria de 30 mensajes y dos reglas nuevas en el prompt (§2) | **Subido 05-11** |
| 22 | A Marta no le llegan las derivaciones | Telegram responde `chat not found` para Marta (8696347610) **y para Bea** (8763299751) con el bot de Dante **@Jaimervr_bot**: ninguna de las dos le ha dado a *Iniciar*. Dante pasa la derivación a la siguiente persona (Sonia) y la emergencia solo le llega a Jaime. Make envía con su propia conexión de Telegram («Dante Bot SPs»), así que lo de Make no prueba que el bot de Dante les llegue. | Marta y Bea: abrir @Jaimervr_bot y pulsar *Iniciar* (§3) | Marta y Bea |
| 23 | Añadir a Marta a las emergencias | — | Emergencia avisa a la vez a **Jaime, Bea y Marta**; si no llega a ninguno, a Sonia (§2) | **Subido 05-11** |
| 24 | Borrar el historial de Jaime en Dante | Hay dos «historiales»: **(a)** la memoria de la conversación y **(b)** su ficha de paciente, que tiene 14 citas «activas» (muchas ya pasadas; varias creadas por un psicólogo, y Dante deriva esas siempre) y 3 derivaciones sin cerrar. | (a) memoria vacía con el import. (b) citas desactivadas y derivaciones cerradas (§4) | **Hecho 05-11**; faltan 5 eventos de calendario |

## 1. Make — escenario «Formulario Citas Psicologos» (webhook `bfgrht…`)

Blueprint revisado: `Make blueprints/Formulario Citas Psicologos.blueprint.json` exportado el **01-11-2026 18:43**.

### 1A. Baja médica (ruta 12, tarea 20a)

Módulo **106** «Crear bloqueo Google Calendar», filtro de entrada (la llave entre el router y el módulo):

- Nombre: `Baja médica`.
- Condición 1: `{{1.datosProcesados.accion}}` · *Equal to* (texto) · `Baja médica`.
- Pulsar **Add OR rule**. Condición 2: `{{1.datosProcesados.accion}}` · *Equal to* · `Baja laboral` (para pestañas viejas de la app; se puede quitar más adelante).

Los módulos 107 (`motivo_bloqueo = Baja médica`) y 113 («… por baja médica.») ya están bien.

### 1B. Bloqueo general / «Cerrar agenda» (ruta 5, tarea 20b)

Hoy la ruta es `22 Crear evento → 98 Guardar acción → 212 Telegram al psicólogo`. Queremos que avise también a los
agentes, como vacaciones y asuntos propios.

1. Entre **98** y **212**, añadir un **Router** (Flow Control → Router). La ruta 1 del router lleva el **212** como
   está ahora (con su manejador de errores 220).
2. Ruta 2 del router: **Supabase → Search rows**, igual que el «Busca agente» 108 de asuntos propios (se puede
   clonar): tabla `agentes`, filtro `activo` = `TRUE`, límite 10.
3. Detrás, **Telegram Bot → Send a text message or a reply**, conexión la misma que el 109:
   - Chat ID: `{{<n.º del Search rows nuevo>.telefono}}`
   - Texto:
     ```
     Hola {{<n.º>.nombre}}!

     {{3.nombre}} ha cerrado su agenda desde el {{formatDate(63.result.gcal_start; "DD.MM.YYYY HH:mm")}} hasta el {{formatDate(63.result.gcal_end; "DD.MM.YYYY HH:mm")}} ({{63.result.duracion_texto}}).
     ```
4. Guardar el escenario.

**El valor no cambia:** aunque F1 renombre en pantalla «Bloqueo general» a «Cerrar agenda», la app tiene que seguir
mandando `accion = "Bloquear agenda"` (filtro del módulo 22). Avisado a F1 (§6).

### 1C. Opcional: agentes sin Telegram

En `agentes` hay tres fichas activas **sin** `telefono`: «Jaime CallC», «Jaime Super Agente Secreto» e «Inspección»
(creada el 02-11). Todos los «Busca agente» las devuelven y el Telegram de Make falla con ellas («Chat ID» vacío). Si
salen las primeras de la búsqueda, el escenario se para y **los demás agentes no reciben el aviso**. Hoy salen al
final y por eso no se nota, pero el orden no está garantizado.

Arreglo recomendado (5 minutos): en cada «Busca agente» (78, 73, 66, 68, 108, 110, 112, 116, 213 y el nuevo de 1B)
añadir una segunda condición `telefono` · *is not null* (si el desplegable no la tiene, poner un filtro en la llave
hacia el Telegram: `{{N.telefono}}` *Exists*).

### Revisión del blueprint del 05-11 (14:15)

1A y 1B comprobados en el blueprint: el filtro 106 acepta `Baja laboral` **o** `Baja médica`; en la ruta 5, router 289 tras
el 98 → ruta 1 el 212 (con su manejador 220), ruta 2 «Busca agente» 290 → Telegram 291 a los agentes. 1C sigue sin hacer.

### 1D. Después

Exportar el blueprint otra vez a `Make blueprints/` (para que la copia local esté al día).

## 2. Dante (n8n) — JSON nuevo (subido el 05-11, ver §4)

Archivo: `n8n/workflows/somos-main-agent.json` (revisión **2026-11-05**, 28 nodos), generado con
`node n8n/tools/build-workflow.mjs`. Copias de seguridad del 05-11: `n8n/workflows/_backups/somos-main-agent.json.2026-11-05.bak`
(el JSON anterior) y `somos-main-agent.live.2026-11-05.json` (lo que había en n8n, revisión del 01-11).

Qué cambia:

| Nodo | Cambio | Tarea |
|---|---|---|
| Window Buffer Memory | Recuerda **30** intercambios (antes 10). La clave pasa a `<chat>-r2`: **todas las conversaciones empiezan de cero** al importar (también la de Jaime). Para volver a borrar en el futuro: cambiar `MEMORIA_VERSION` en `build-workflow.mjs` y regenerar | 21, 24 |
| AI Agent (prompt) | En FORMATO: «Nunca anuncies algo para después… llama a la herramienta antes de responder» y «No vuelvas a pedir un dato que ya te ha dado». En CITA PARA OTRA PERSONA: si pregunta antes por horas, apuntar el hueco, pero **la ficha va primero** | 21 |
| ContactarAgente (y el resto de tools, que llevan `_comun.js` delante) | Emergencia: aviso **a la vez a Jaime, Bea y Marta**; si no llega a ninguno, a Sonia. La respuesta dice «Jaime, Bea y Marta» | 23 |

Pruebas locales: `n8n/tools/_pruebas/harness-b7.cjs . comando` → 16/16 (casos E1–E4 reescritos para tres personas),
`harness-b5.cjs .` → todo OK, `check-sintaxis.cjs` → OK con las 4 tools.

Importar: en n8n, sobre el workflow `6nzKwBire02c9qx3` («Dante — Agente Telegram»), *Import from file*, guardar y
comprobar que sigue **activo**. Después, mirar en el nodo AI Agent que el *System Message* contiene «Nunca anuncies»
(a veces se importa una copia vieja).

## 3. Marta y Bea: iniciar el bot de Dante (tarea 22)

Cada una, desde su Telegram: buscar **@Jaimervr_bot** (se llama «DantePrueba») → abrir → **Iniciar** (`/start`). No hace
falta escribir nada más. Comprobación (la hago yo): `getChat` del bot con su id deja de dar `chat not found`.

Si después siguiera fallando, su id de Telegram en `agentes.telefono` estaría mal: lo sacamos de un mensaje suyo al bot.

## 4. Hecho en datos el 05-11-2026 (decisiones de Sonia)

Copias previas en `Supabase/_backups/f4-*.2026-11-05.json` (raíz del proyecto).

- **Dante subido a n8n por API** (PUT sobre `6nzKwBire02c9qx3`, 12:29 UTC). Comprobado en vivo: activo, prompt con
  «Nunca anuncies» y «la ficha va primero», memoria 30 con clave `-r2`, emergencia a Jaime, Bea y Marta. Con esto la
  memoria de conversación de Jaime (y de todos) ya está vacía.
- **Historial de Jaime (tarea 24, opción «limpiar citas, mantener ficha»):** su ficha «Jaime Rodríguez Vázquez» (chat
  7781734822) sigue igual. Sus **14 citas activas** en `acciones_psicologos` pasan a `activo = false` (solo esa columna:
  no genera historial ni aviso al calendario de Elias; comprobado, 0 filas nuevas en `acciones_historial`). Sus **3
  derivaciones abiertas** quedan `respondido = true`. Para la prueba 3 hay que agendarle una cita nueva.
- **Ficha de psicólogo «JAIME»:** `telefono` pasa de 5456273411 (Sonia) a **7781734822** (Jaime).

**Falta:** los eventos de esas citas siguen en el Google Calendar de JAIME
(`c_a358d69d…@group.calendar.google.com`). Los pasados dan igual; los futuros conviene borrarlos a mano:

| Fecha | Hora | Origen | gcal_event_id |
|---|---|---|---|
| 09-11-2026 | 10:00 | psicólogo | `t9tpimus846mmktf8pd78917k8` |
| 19-11-2026 | 12:00 | agente | `olr75v4596lc9m20jpi366jrec` |
| 24-11-2026 | 10:00 | psicólogo | `u8stb0jb546d4mrr6tm76ffh94` |
| 03-12-2026 | 12:00 | agente | `vhqvg5df01c4n529p8toqgp9o4` |
| 17-12-2026 | 12:00 | agente | `4e24km8mo21gi93jub5aivvmh8` |

## 5. Pruebas de aceptación (después de §1–§3)

- **P1** Call center → «Hablar con el psicólogo» con un paciente de prueba → llega Telegram a los agentes; el
  paciente pasa a estado «Psicólogo».
- **P2** Call center → «Cambio de psicólogo» → Telegram «… ha solicitado un cambio de psicólogo…»; estado «Cambio solicitado».
- **P3** Agente → «Sin cita disponible» → Telegram «Hay un nuevo paciente sin disponibilidad…»; estado «Sin disponibilidad».
- **P4** Psicólogo de prueba → Baja médica de un día → evento «BLOQUEADO» en su calendario, fila con
  `motivo_bloqueo = Baja médica`, Telegram «… por baja médica.» a los agentes.
- **P5** Psicólogo de prueba → Cerrar agenda (bloqueo general) → Telegram a los agentes («… ha cerrado su agenda…») y
  «Tu bloqueo ha sido registrado» al psicólogo.
- **P6** Dante: repetir 5.1 de Jaime («Quiero una cita para mi padre», con preguntas por en medio) → Dante no repite
  preguntas, nunca termina con «voy a comprobar…» y la ficha del padre aparece en Pacientes.
- **P7** Dante: «Derivar a Marta» (7.2) → a Marta le llega el aviso; Marta responde «atendido» → la derivación queda
  cerrada (7.5).
- **P8** Dante: emergencia (7.1) → llega a Jaime, Bea y Marta a la vez; «atendido» de una cierra las tres.
- **P9** Jaime repite 1.6 y 5.2–5.16 (ya puede: §4).

## 6. Avisos a otros bloques

- **F1 (tareas 7 y 8):** el texto que viaja a Make tiene que seguir siendo `Bloquear agenda` aunque en pantalla diga
  «Cerrar agenda» (si cambia, la ruta 5 de Make deja de funcionar). Las demás: `Vacaciones`, `Asuntos propios`,
  `Baja médica`, `Modificar bloqueo personal`, `Desbloquear agenda`.
- **F3 (tarea 16):** desde el 01-11 por la tarde las rutas 6–8 de Make **sí guardan el estado** del paciente
  (`Sin disponibilidad`, `Psicólogo`, `Cambio solicitado`); las pruebas de Jaime fallaron antes de eso. Si Comunicaciones
  sigue sin enseñarlos, el problema está en la pestaña (regla de «más de 1 día esperando»), no en Make.
- **F1 (tarea 1), confirmado por F1 el 05-11:** el formato de `/api/disponibilidad` no cambia; solo cambian las horas
  que se ofrecen a los 4 psicólogos con «cita a las medias horas» (solo y media). Dante no necesita cambios: ofrece
  únicamente horas que devuelve `BuscarDisponibilidad`, y si el paciente pide otra hora, `EjecutarAccion` la comprueba
  con la app (`tipo: "comprobar"`) antes de mandarla a Make. Su filtro propio (en punto o y media) es más amplio y no
  choca. En las pruebas de Dante, mirar que a esos 4 solo les ofrece y media.
