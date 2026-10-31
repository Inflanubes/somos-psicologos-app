# Dante — bloque B7: emergencias a dos personas, «derivar a» y recordatorio cada 30 min

Fecha: 31-10-2026. Rama `b7-avisos-internos`. Plan: `docs/superpowers/plans/2026-10-27-b7-avisos-internos.md`. Diseño: `docs/superpowers/specs/2026-10-27-b7-avisos-internos-design.md`.

> **⚠️ Orden obligatorio: la migración 021 ANTES de importar este Dante.** Sin ella, «atendido» y «derivar a» fallan (no existen las funciones) y las derivaciones nuevas no se apuntan (no existe la columna `grupo_id`): el aviso llega, pero no habría recordatorios.

## Qué cambia para el equipo

- **Emergencias:** el aviso llega **a la vez a Jaime y a Bea** (a los que tengan el bot abierto). Si no le llega a ninguno de los dos, va a Marta y, si tampoco, a Sonia. El primero que responde `atendido` la cierra para los dos.
- **Pasar una derivación:** cualquiera que tenga una derivación pendiente puede responder al bot `derivar a Marta` (o Jaime, Bea, Sonia; da igual mayúsculas o espacios). Esa persona recibe el aviso con el motivo original («Derivación pasada por Bea») y desde entonces los recordatorios son para ella. Quien la pasó deja de recibirlos.
- **Recordatorios cada 30 minutos** (antes 15), con «Derivada por: …» cuando alguien la ha pasado y los dos comandos al final.
- Las derivaciones generales y de marketing siguen igual: una sola persona.

## Archivos que cambian (fuera del repo, sin git)

| Archivo | Copia de antes |
|---|---|
| `Supabase/migrations/021_derivaciones_grupo.sql` | nueva |
| `n8n/tools/_comun.js` | `n8n/tools/_backups/2026-10-31-pre-b7-_comun.js` |
| `n8n/tools/contactar-agente.js` | `n8n/tools/_backups/2026-10-31-pre-b7-contactar-agente.js` |
| `n8n/tools/comando-agente.js` | nuevo (nodo Code `Comando agente`) |
| `n8n/tools/build-workflow.mjs` | `n8n/tools/_backups/2026-10-31-pre-b7-build-workflow.mjs` |
| `n8n/workflows/somos-main-agent.json` (regenerado, 27 nodos) | `n8n/workflows/_backups/2026-10-31-pre-b7-somos-main-agent.json` |
| `n8n/workflows/somos-escalation-cron.json` (editado) | `n8n/workflows/_backups/2026-10-31-pre-b7-somos-escalation-cron.json` |
| `n8n/tools/_pruebas/harness-b7.cjs` | nuevo: banco de pruebas (`node n8n/tools/_pruebas/harness-b7.cjs n8n/tools comando` → 16 PASS) |

En el workflow principal: `IF Atendido` deja pasar `atendido` y `derivar a <nombre>`; `PATCH Derivaciones` desaparece y en su lugar está el nodo Code `Comando agente`; `Confirm Atendido` contesta con el texto que prepara ese nodo. En el cron: el disparador se llama `Cada 30 minutos` (`*/30 * * * *`) y busca derivaciones con más de 30 minutos.

## 1. Migración 021 (de madrugada)

- [x] (31-10-2026) SQL Editor → pegar `Supabase/migrations/021_derivaciones_grupo.sql` entero → Run. Es idempotente.
- [x] (31-10-2026, dio 2) Opcional: ejecutar el bloque de comprobación del final del archivo (quitando los `--`): debe dar 0, 0 filas, 0 filas, 2, y el `DELETE` deja la tabla como estaba. (Ya probado en un PostgreSQL 15 local el 31-10.)
- [x] Anotar la fecha en la cabecera del archivo (`Aplicada el:`) y en el plan.

## 2. Chats de Telegram del equipo (tarea 3)

Hoy Marta, Jaime y Bea no tienen su chat en `agentes`, por eso todos los recordatorios acaban en Sonia.

- [ ] Cada uno abre el bot de Dante y escribe cualquier cosa (por ejemplo `hola`).
- [ ] En n8n, en la ejecución del `Telegram Trigger`, copiar `message.from.id` de cada uno.
- [ ] Table Editor → `agentes` → en la fila de cada uno, `telefono` = ese número y `activo` = true.
- [ ] **Jaime como psicólogo (tarea 54):** en Make, abrir el módulo de Telegram que avisa al psicólogo y mirar de dónde saca el chat (la app no guarda el chat de Telegram de los psicólogos: lo tiene Make). Comprobar que el de Jaime está ahí y que Jaime ha abierto el bot.

## 3. Pruebas en copias (antes de producción)

Importar `somos-main-agent.json` y `somos-escalation-cron.json` como workflows **nuevos** (copias) y activar solo las copias durante la prueba, con el Dante de producción parado o con otro bot de prueba. Usar `prueba B7` en el motivo para reconocer las filas.

- [ ] **P1 · Emergencia a dos.** Desde un chat de paciente de prueba, pedir ayuda urgente. Jaime y Bea reciben el aviso (con la última línea «… o "derivar a <nombre>" para pasársela a otra persona del equipo.»). En `derivaciones`: dos filas, mismo `grupo_id`, `agente_nombre` Jaime y Bea.
- [ ] **P2 · Derivar a.** Bea responde `derivar a marta`. Marta recibe «Derivación pasada por Bea» con el motivo original; Bea recibe «✅ Derivación pasada a Marta.». En `derivaciones`: la fila de Bea `respondido = true`; fila nueva de Marta con el mismo `grupo_id` y `derivada_desde = Bea`. (La de Jaime sigue pendiente: es suya también.)
- [ ] **P2b · Sin duplicados.** En otra emergencia de prueba (Jaime y Bea avisados), Jaime responde `derivar a Bea` → la fila de Jaime se cierra y Bea NO recibe un segundo aviso (ya la tenía). Si un agente tiene varias pendientes, `atendido` y `derivar a` responden con el número y los pacientes («✅ 2 derivaciones marcadas como atendidas (Ana y Luis). Gracias.»).
- [ ] **P3 · Nombre que no existe.** Bea responde `derivar a Pepe` → «No he podido pasarla a Pepe: no está en la lista de agentes con Telegram, o no tenías derivaciones pendientes.» y nada cambia en la tabla.
- [ ] **P4 · Atendido.** Marta responde `atendido` → «✅ Derivación marcada como atendida. Gracias.». Todas las filas del grupo (también la de Jaime) quedan `respondido = true`. Si vuelve a escribir `atendido` → «No tenías derivaciones pendientes.».
- [ ] **P5 · General.** Pedir hablar con una persona → solo Marta recibe el aviso; una fila con `grupo_id`.
- [ ] **P6 · Recordatorio a los 30 min.** Dejar la derivación de P5 sin atender: a los 15 min no llega nada; entre los 30 y los 60 min llega el recordatorio a Marta, con los dos comandos al final. Luego `atendido`.
- [ ] Borrar las filas de prueba: `DELETE FROM derivaciones WHERE motivo ILIKE '%prueba B7%';`

## 4. Comprobaciones sin código (tareas 5 y 54)

- [ ] **Tarea 5 · Cambio de psicólogo desde Dante.** Con un paciente de prueba, pedir a Dante cambiar de psicólogo. Dante confirma y no deriva. En Make, historial del escenario de Dante: entra una ejecución con `accion = Cambio solicitado` y sale el Telegram a Marta. En la app, el paciente pasa a «Cambio solicitado».
- [ ] **Tarea 54 · Avisos al psicólogo.** Con Jaime como psicólogo (y su chat dado de alta), hacer desde la app y desde Dante: un alta con cita, un cambio y una anulación. Por cada una, en Make sale el módulo de Telegram al psicólogo sin error y Jaime recibe el mensaje. Si falla con «chat not found», Jaime no ha abierto el bot o el chat no está bien en su ficha.

## 5. Producción (de madrugada, 4–5 h)

- [ ] Desactivar el Dante y el cron de producción.
- [ ] Importar los dos JSON en producción (sustituyendo a los actuales; el cron pasa de 15 a 30 min). Credenciales de Telegram: comprobar que `Confirm Atendido` mantiene «Somos Jaime».
- [ ] Activar los dos. Prueba rápida: un agente escribe `atendido` → «No tenías derivaciones pendientes.».
- [ ] Republicar el manual (novedad del 31-10 «Avisos de Dante al equipo»).
- [ ] Borrar las copias de prueba de n8n.

## Para cuando Dante pase a WhatsApp (tarea 2)

«Urgente por WhatsApp, informativo por Telegram» se diseña con ese paso. Lo que hay que tocar entonces en esta parte: `enviarTelegram` en `n8n/tools/_comun.js` (todos los avisos al equipo pasan por ahí), el nodo `Enviar recordatorio` del cron y el chat de cada agente en `agentes.telefono`.
