# B7 — Avisos internos de Dante y al psicólogo (diseño)

Fecha: 27-10-2026. Bloque B7 del tablero (tareas 1, 2, 3, 5, 54, 11). Depende de **B5** (que mueve la derivación a `derivar()` en `n8n/tools/_comun.js`). Decisiones con Sonia el 27-10; **[mi decisión]** = lo decidió Claude. Todo lo de Telegram pasará a WhatsApp cuando Meta apruebe la cuenta: el diseño no cambia, solo el canal de envío (lo hace Make / el bot).

## Cómo funciona hoy (verificado el 27-10)

- Una derivación avisa a **un** agente (el primero de la cadena que acepte el Telegram) y escribe **una** fila en `derivaciones` con `agente_nombre`. El cron `somos-escalation-cron` corre cada 15 min, busca filas `respondido = false` con más de 15 min, y recuerda al agente (o a Sonia si el agente no tiene Telegram en `agentes`).
- Un agente responde `atendido` al bot y el workflow principal (`IF Atendido` → `Lookup Agent` por `telefono = chat_id` → `PATCH Derivaciones` por `agente_nombre`) cierra **todas** sus derivaciones pendientes.
- Marta, Jaime y Bea no tienen su chat de Telegram en `agentes`: por eso todo acaba en Sonia (tarea 3).
- Los avisos al psicólogo por cada alta/cambio/anulación salen de Make (tarea 54); "Cambio solicitado" desde Dante llega a Make desde el 22-10 (tarea 5): ambas son comprobaciones, no código.

## Objetivos

1. **Emergencias a varias personas (1).** Una derivación `emergencia` avisa **a la vez** a Jaime y a Bea (los que tengan Telegram; si ninguno lo tiene, cadena Marta → Sonia). Cada aviso es una fila en `derivaciones` con el mismo `grupo_id`; el cron recuerda a cada uno; el primero que responde `atendido` cierra el grupo entero.
2. **Pasar una derivación a otra persona (1).** Cualquier agente puede responder al bot `derivar a Marta` (o Jaime, Bea, Sonia): sus derivaciones pendientes pasan a esa persona (fila nueva en el mismo grupo, `derivada_desde` = quien la pasa), la nueva recibe el aviso con el motivo original y el cron le recuerda a ella; las filas del que la pasó quedan cerradas.
3. **Recordatorio cada 30 minutos (3)** en vez de 15, y texto del recordatorio con los dos comandos (`atendido` / `derivar a <nombre>`).
4. **Chats de los agentes (3):** Sonia da de alta en `agentes.telefono` el chat de Telegram de Marta, Jaime y Bea (paso del guion, sin código). El fallback a Sonia se mantiene por si falta alguno.
5. **Comprobaciones (5, 54):** en el guion de pruebas: "Cambio solicitado" desde Dante llega a Marta por Make; cada alta/cambio/anulación hecha desde la app o desde Dante manda el Telegram al psicólogo (Jaime como psicólogo tiene que haber abierto el bot).
6. **Proceso (11, 2):** entrada en el manual "Cambios en la app solo de madrugada (4–5 h)"; nota en el tablero de que "urgente por WhatsApp, informativo por Telegram" se diseña con el paso a WhatsApp.

## No objetivos

- Elegir el canal (WhatsApp): proyecto aparte.
- Cambiar quién recibe las derivaciones `general` y `marketing` (siguen con su cadena).
- Avisos nuevos desde la app.

## Modelo de datos (migración `021_derivaciones_grupo.sql`)

```
derivaciones
  + grupo_id       uuid NOT NULL DEFAULT gen_random_uuid()   -- una emergencia = varias filas, un grupo
  + derivada_desde text                                      -- agente que la pasó con "derivar a"
  índice (grupo_id)

función atender_derivaciones(p_agente text) RETURNS integer
  -- cierra (respondido = true, fecha_respuesta = now()) todas las filas de los grupos
  -- en los que p_agente tiene alguna fila pendiente; devuelve cuántas filas cerró.

función derivar_a(p_desde text, p_hacia text)
  RETURNS TABLE (id uuid, grupo_id uuid, chat_id text, paciente_nombre text, motivo text, tipo text, chat_destino text)
  -- si p_hacia no está en agentes (activo, con telefono) → 0 filas y no cambia nada.
  -- por cada grupo con filas pendientes de p_desde: inserta una fila para p_hacia (mismo grupo,
  -- derivada_desde = p_desde, respondido = false, fecha_contacto = now()) y cierra las de p_desde.
  -- devuelve las filas nuevas con chat_destino = agentes.telefono de p_hacia.
```

Idempotente (las filas existentes reciben cada una su `grupo_id`). Las funciones van con `SECURITY DEFINER` y `GRANT EXECUTE` al rol que usa la clave publishable (igual que el resto de accesos de Dante; "Seguridad pendiente Supabase" sigue abierta).

## Dante (`n8n/`)

### `_comun.js` (viene de B5)

- `const AVISO_SIMULTANEO = { emergencia: ['Jaime', 'Bea'] }` y `AGENTES_POR_TIPO.emergencia = ['Marta', 'Sonia']` pasa a ser la **reserva** si ninguno de los simultáneos acepta el Telegram.
- `derivar(tipo, motivo, pacienteNombre, chatId)` → `{ agentes: string[], grupo_id, registrada }`: genera `grupo_id` (UUID), para `emergencia` manda el mensaje a todos los de `AVISO_SIMULTANEO` que lo acepten; si ninguno, a la cadena de reserva como hoy; una fila por agente avisado con el mismo `grupo_id`. Para los demás tipos, un solo agente (como hoy) pero también con `grupo_id`.
- Texto del aviso: añade al final `Responde "atendido" cuando lo hayas gestionado, o "derivar a <nombre>" para pasársela a otra persona del equipo.`
- `ContactarAgente` devuelve `agente: agentes.join(' y ')`.

### Comandos de los agentes (workflow principal)

- `IF Atendido` pasa a `IF Comando agente`: el texto (sin espacios sobrantes, sin mayúsculas) es `atendido` o empieza por `derivar a `. `Lookup Agent` e `IF Known Agent` siguen igual.
- `PATCH Derivaciones` se sustituye por un nodo Code `Comando agente` (`n8n/tools/comando-agente.js`, concatenado con `_comun.js` por `build-workflow.mjs`; usa `$('Telegram Trigger')` y `$('Lookup Agent')`):
  - `atendido` → `POST /rest/v1/rpc/atender_derivaciones { p_agente }` → texto `✅ Derivación marcada como atendida. Gracias.` (si devuelve 0: `No tenías derivaciones pendientes.`).
  - `derivar a X` → `X` = primera palabra tras "derivar a", capitalizada; `POST /rest/v1/rpc/derivar_a { p_desde, p_hacia }`; por cada fila devuelta, Telegram a `chat_destino`: `🔔 *Derivación pasada por {desde}*\n\n*Paciente:* …\n*Tipo:* …\n\n*Motivo:*\n…\n\nResponde "atendido" cuando lo hayas gestionado, o "derivar a <nombre>" para pasársela a otra persona.`; respuesta al que la pasó: `✅ Derivación pasada a {X}.`; si 0 filas: `No he podido pasarla a {X}: no está en la lista de agentes con Telegram, o no tenías derivaciones pendientes.`
  - `Confirm Atendido` envía `{{ $json.texto }}`.

### Cron (`workflows/somos-escalation-cron.json`, editado a mano con copia previa)

- Disparador cada **30** minutos; consulta `fecha_contacto=lt.{{ now − 30 min }}`.
- Texto del recordatorio: añade `Derivada por: {derivada_desde}` cuando exista y termina con `Responde "atendido" en el bot cuando lo hayas gestionado, o "derivar a <nombre>" para pasársela a otra persona.`
- Sin más cambios: una fila por agente ya hace que cada uno reciba su recordatorio.

## Guion para Sonia (`docs/dante-cambios-2026-10-b7.md`)

1. Migración 021 (madrugada). 2. `agentes`: chat de Telegram de Marta, Jaime y Bea (cada uno abre el bot y escribe; el `from.id` se ve en la ejecución del trigger). 3. Importar el principal y el cron en copias; pruebas: emergencia de prueba → Jaime y Bea reciben el aviso, dos filas con el mismo `grupo_id`; Bea responde `derivar a Marta` → Marta recibe el aviso, la fila de Bea cerrada, fila nueva de Marta; Marta responde `atendido` → grupo cerrado; esperar 30 min con una derivación general sin atender → un recordatorio. 4. Comprobaciones 5 y 54. 5. Importar en producción (madrugada).

## Textos

`✅ Derivación marcada como atendida. Gracias.` · `No tenías derivaciones pendientes.` · `✅ Derivación pasada a {X}.` · `No he podido pasarla a {X}: no está en la lista de agentes con Telegram, o no tenías derivaciones pendientes.` · `Responde "atendido" cuando lo hayas gestionado, o "derivar a <nombre>" para pasársela a otra persona del equipo.` · Manual: `Cambios en la app solo de madrugada (4–5 h)`.

## Comprobación de aceptación

1. Emergencia → aviso a Jaime y Bea a la vez; `atendido` de uno cierra las dos filas.
2. `derivar a Marta` → Marta recibe el motivo original y el recordatorio a los 30 min es para ella; quien la pasó no recibe más recordatorios.
3. `derivar a Pepe` → respuesta de error y nada cambia.
4. Derivación general: un solo agente, como antes, con `grupo_id`.
5. Recordatorios cada 30 min y no antes.
6. Tareas 5 y 54 comprobadas en el guion.
