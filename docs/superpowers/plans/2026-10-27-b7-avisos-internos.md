# B7 — Avisos internos de Dante y al psicólogo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las emergencias avisan a Jaime y Bea a la vez, cualquier agente puede pasar una derivación a otro con "derivar a <nombre>", los recordatorios van cada 30 min, y quedan comprobados los avisos de Make al psicólogo y el "Cambio solicitado" de Dante.

**Architecture:** La lógica de grupos y traspasos vive en dos funciones SQL de Supabase (migración 021) para que n8n solo haga llamadas RPC. En Dante, `derivar()` de `_comun.js` (B5) manda a varios y escribe una fila por agente con `grupo_id`; un nodo Code `Comando agente` sustituye al PATCH y atiende los dos comandos. El cron solo cambia de cadencia y de texto.

**Tech Stack:** Supabase SQL (funciones `SECURITY DEFINER`), n8n (Code node normal y Code Tools), Telegram Bot API, `build-workflow.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-27-b7-avisos-internos-design.md`. Tablero: `docs/backlog-2026-10-21.md` (B7: 1, 2, 3, 5, 54, 11). Método: `docs/metodo-trabajo.md`. Depende de B5 (`derivar`, `avisarAgente`, `AGENTES_POR_TIPO` en `_comun.js`).

## Global Constraints

- Rama `b7-avisos-internos` desde `main` después de B5. Commits en español.
- **Fuera del repo git:** `n8n/` y `Supabase/migrations/`. Copia previa en `_backups/` con fecha de cada archivo tocado; nota en el tablero al cerrar.
- Dante en producción: importar primero en workflows copia (principal y cron); a producción de madrugada y con autorización de Sonia en el chat.
- Chequeo de sintaxis de cada tool/nodo: `node -e "new Function('query','helpers','$','$input', comun + archivo)"` sin error; `node n8n/tools/build-workflow.mjs` sin error (con `DANTE_API_TOKEN`).
- Textos exactos (ver especificación, apartado Textos). Recordatorio: `RECORDATORIO_MIN = 30`.
- Simultáneos: `AVISO_SIMULTANEO = { emergencia: ['Jaime', 'Bea'] }`; reserva `['Marta', 'Sonia']`.

## Review Focus

1. **`derivar a marta` en minúsculas o con espacios** → se capitaliza y se recorta; funciona (Tarea 3).
2. **Agente con dos derivaciones pendientes** responde `atendido` → se cierran los dos grupos y la respuesta lo dice (Tarea 1, `SELECT` de prueba en el guion).
3. **Emergencia con Jaime sin Telegram** → solo Bea recibe; una fila; si tampoco Bea, cadena de reserva y una fila (Tarea 2).
4. **`derivar a` a sí mismo** (`p_desde = p_hacia`) → la función no hace nada y devuelve 0 filas (Tarea 1).
5. **Fila antigua sin `grupo_id`** no puede existir (DEFAULT + NOT NULL); el cron sigue leyendo `select=*` (Tarea 4).

---

### Task 1: Migración 021 — grupos y funciones RPC

**Files:**
- Create (fuera del repo): `Supabase/migrations/021_derivaciones_grupo.sql`

**Interfaces:**
- Produces: columnas `derivaciones.grupo_id uuid NOT NULL DEFAULT gen_random_uuid()`, `derivaciones.derivada_desde text`; `atender_derivaciones(p_agente text) RETURNS integer`; `derivar_a(p_desde text, p_hacia text) RETURNS TABLE (id uuid, grupo_id uuid, chat_id text, paciente_nombre text, motivo text, tipo text, chat_destino text)`.

- [x] **Step 1:** Escribir la migración según la especificación: `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, índice, `CREATE OR REPLACE FUNCTION` × 2 (`LANGUAGE plpgsql SECURITY DEFINER`), `GRANT EXECUTE ON FUNCTION … TO anon, authenticated`. `derivar_a`: `IF p_desde = p_hacia OR NOT EXISTS (SELECT 1 FROM agentes WHERE nombre = p_hacia AND activo AND telefono IS NOT NULL) THEN RETURN; END IF;` luego `INSERT … SELECT` por grupo pendiente de `p_desde` (`mensaje_enviado` = `'Pasada por ' || p_desde`), `UPDATE` cierre de las de `p_desde`, `RETURN QUERY` con `chat_destino` del `agentes.telefono`.
- [x] **Step 2:** Bloque final comentado de pruebas para el SQL Editor: `SELECT atender_derivaciones('Nadie')` → 0; insertar dos filas de prueba con el mismo `grupo_id` para `Jaime` y `Bea`, `SELECT atender_derivaciones('Bea')` → 2; `SELECT * FROM derivar_a('Bea', 'Pepe')` → 0 filas; `SELECT * FROM derivar_a('Bea', 'Bea')` → 0 filas; borrar las filas de prueba.
- [x] **Step 3:** Nota en el tablero (migración 021 creada, fuera del repo). Commit de docs.

---

### Task 2: `derivar()` simultáneo con `grupo_id`

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-_comun.js`, `…-contactar-agente.js`
- Modify (fuera del repo): `n8n/tools/_comun.js` (`AGENTES_POR_TIPO`, `derivar`), `n8n/tools/contactar-agente.js`

**Interfaces:**
- Consumes (B5): `avisarAgente(tipo, texto)`, `derivar(...)`, `sbPost`.
- Produces: `const AVISO_SIMULTANEO = { emergencia: ['Jaime', 'Bea'] }`; `AGENTES_POR_TIPO.emergencia = ['Marta', 'Sonia']`; `function uuid()` (`crypto.randomUUID` si existe; si no, plantilla `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`); `async function enviarTelegramAgente(nombre, texto): Promise<boolean>` (lee `agentes` y hace `sendMessage`; lo usa `avisarAgente`); `derivar(tipo, motivo, pacienteNombre, chatId)` → `{ agentes: string[], grupo_id: string, registrada: boolean, mensaje: string }`.
- Texto del aviso: el actual + `\n\nResponde "atendido" cuando lo hayas gestionado, o "derivar a <nombre>" para pasársela a otra persona del equipo.` (sustituye a la última línea de hoy).

- [x] **Step 1: Copias en `_backups/`.**
- [x] **Step 2: `_comun.js`:** `derivar`: `const grupo = uuid(); let avisados = []; for (const n of (AVISO_SIMULTANEO[tipo] || [])) if (await enviarTelegramAgente(n, mensaje)) avisados.push(n); if (!avisados.length) { const a = await avisarAgente(tipo, mensaje); if (a) avisados = [a]; }` y una `sbPost('derivaciones', {...fila, agente_nombre: n, grupo_id: grupo})` por cada `n` de `avisados`. `failDerivado` (B5) usa `agentes.join(' y ')` en `agente`.
- [x] **Step 3: `contactar-agente.js`:** `agente: r.agentes.join(' y ')`.
- [x] **Step 4:** Chequeo de sintaxis; nota en el tablero; commit de docs.

---

### Task 3: Comandos de los agentes (`atendido`, `derivar a`) y build

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-build-workflow.mjs`, `n8n/workflows/_backups/2026-MM-DD-somos-main-agent.json`
- Create (fuera del repo): `n8n/tools/comando-agente.js`
- Modify (fuera del repo): `n8n/tools/build-workflow.mjs` (sección "Rama atendido": `IF Atendido`, nodo nuevo en lugar de `PATCH Derivaciones`, `Confirm Atendido`)
- Regenerar: `n8n/workflows/somos-main-agent.json`

**Interfaces:**
- `comando-agente.js` (nodo `n8n-nodes-base.code`, modo "Run Once for All Items", `jsCode = comun + archivo`): lee `texto = $('Telegram Trigger').first().json.message.text`, `desde = $('Lookup Agent').first().json.nombre ?? …[0].nombre`; si `/^atendido$/i` → `POST SUPABASE_URL + '/rest/v1/rpc/atender_derivaciones'` body `{ p_agente: desde }` → `n`; si `/^derivar a\s+(\S+)/i` → `hacia = capitalizar(m[1])`, `POST …/rpc/derivar_a { p_desde: desde, p_hacia: hacia }` → por fila, `sendMessage` a `chat_destino` con el texto de la especificación; `return [{ json: { texto } }]` con los textos fijos.
- `build-workflow.mjs`: `node('IF Atendido').parameters.conditions.conditions[0] = { leftValue: "={{ ($json.message.text || '').trim().toLowerCase() }}", rightValue: '^(atendido|derivar a .+)$', operator: { type: 'string', operation: 'regex' } }`; nodo nuevo `{ id: 'node-028', name: 'Comando agente', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: codigo('comando-agente.js') } }` que sustituye a `PATCH Derivaciones` en `wf.nodes` y en las conexiones (`IF Known Agent` true → `Comando agente` → `Confirm Atendido`); `node('Confirm Atendido').parameters.text = '={{ $json.texto }}'`.

- [x] **Step 1: Copias en `_backups/`.**
- [x] **Step 2:** Escribir `comando-agente.js` y los cambios del build.
- [x] **Step 3: Regenerar** y comprobar: `node -e "const w=require('./n8n/workflows/somos-main-agent.json');const n=Object.fromEntries(w.nodes.map(n=>[n.name,n]));console.log(!n['PATCH Derivaciones'], !!n['Comando agente'], n['Confirm Atendido'].parameters.text, JSON.stringify(w.connections['IF Known Agent']))"` → `true true ={{ $json.texto }} …Comando agente…`.
- [x] **Step 4:** Nota en el tablero; commit de docs.

---

### Task 4: Cron a 30 min y texto nuevo

**Files:**
- Backup: `n8n/workflows/_backups/2026-MM-DD-somos-escalation-cron.json`
- Modify (fuera del repo, a mano con `node` o editor): `n8n/workflows/somos-escalation-cron.json` — nodo `Cada 15 minutos` (renombrar `Cada 30 minutos`, `minutesInterval: 30`), `Buscar derivaciones sin atender` (`minus(30, 'minutes')`), `Preparar recordatorios` (texto: línea `Derivada por: ` + `d.derivada_desde` si existe; última línea con los dos comandos).

- [x] **Step 1:** Copia y edición. Comprobar con `node -e "const w=require('./n8n/workflows/somos-escalation-cron.json'); console.log(JSON.stringify(w.nodes.map(n=>n.name)), w.nodes.find(n=>n.name==='Buscar derivaciones sin atender').parameters.url.includes('minus(30'))"` → `… true`; las conexiones del JSON usan el nombre del nodo del trigger: actualizarlas si se renombra.
- [x] **Step 2:** Nota en el tablero; commit de docs.

---

### Task 5: Guion, manual, tablero y memoria

**Files:**
- Create: `docs/dante-cambios-2026-10-b7.md`
- Modify: `docs/manual-somos/index.html` (apartado "Cómo se trabaja": `Cambios en la app solo de madrugada (4–5 h)`; Dante: emergencias a dos personas, "derivar a", recordatorio cada 30 min; nota de que los avisos pasarán a WhatsApp), `docs/backlog-2026-10-21.md` (1, 2, 3, 5, 54, 11, B7), este plan

- [x] **Step 1:** Guion según la especificación (migración 021, chats en `agentes`, pruebas 1–6 de aceptación, comprobaciones 5 y 54 con qué mirar en Make y en Telegram, importación en producción). Casillas y fechas.
- [ ] **Step 2:** Manual: `node docs/manual-somos/check-manual.mjs` OK; republicar al artifact `FWj2hP27NkTXLFMUQvBuqi`.
- [x] **Step 3:** Tablero: 1, 3, 11 → `hecha` / `verificar`; 5 y 54 → `verificar (guion B7)`; 2 → `espera WhatsApp`. Memoria de Claude: la nota de Dante dice "cron 15 min": cambiar a 30 min cuando se importe.
- [ ] **Step 4: Commit y merge** — `git add docs && git commit -m "B7 cerrado: guion de Dante, manual y tablero"`; merge a `main` de madrugada.

---

## Registro de ejecución (31-10-2026)

- Tareas 1–4 hechas; Tarea 5 hecha salvo republicar el manual y el merge.
- **Quedó así (Tarea 5, Step 2):** `index.html` editado y `check-manual.mjs` OK; **sin republicar** a propósito: el manual describiría un Dante que aún no está importado. Republicar en la madrugada en que se importe (guion §5).
- **Quedó así (Tarea 5, Step 4):** commit hecho en `b7-avisos-internos`; merge a `main` cuando Sonia haya aplicado la 021 e importado Dante (guion `docs/dante-cambios-2026-10-b7.md`).
- Migración 021: escrita, probada en un PostgreSQL 15 local (idempotente y casos de Review Focus 2 y 4). **Aplicada el:** (pendiente).
- Decisiones tomadas al ejecutar: `derivar()` devuelve también `agente` (nombres unidos con « y ») además de `agentes`, para no romper `failDerivado`; el nodo `IF Atendido` conserva su nombre; copias en `_backups/` con el prefijo `2026-10-31-pre-b7-` (las de `2026-10-31-` ya eran de B5); `derivar_a` lleva `#variable_conflict use_column`; `comando-agente.js` responde con texto de error (no excepción) si el RPC falla, y avisa si la persona a la que se pasa no recibe el Telegram; banco de pruebas `n8n/tools/_pruebas/harness-b7.cjs`.
- **Revisión independiente (31-10-2026):** 0 críticos. Corregido: las respuestas a `atendido` / `derivar a` dicen cuántas derivaciones y de qué pacientes cuando son varias (los comandos cierran o pasan todo lo pendiente del agente, como pide el diseño: así nadie cierra una sin enterarse); el filtro `IF Atendido` junta espacios dobles y `derivar a marta.` ya funciona; `derivar_a` no duplica la fila si quien recibe ya tenía ese grupo pendiente; el aviso de fallo cuenta envíos fallidos y no promete un recordatorio que iría al mismo chat; esquema de ContactarAgente sin «emergencia (Bea)». Banco de pruebas 16 PASS. Diferidos (menores): carrera entre `atendido` y `derivar a` simultáneos en el mismo grupo (improbable; `FOR UPDATE` si pasara); las funciones RPC se pueden llamar con la clave publishable (dentro de «Seguridad pendiente Supabase»); si quien recibe ya tenía todas las derivaciones, quien la pasa ve «No he podido pasarla…» aunque su fila se cierra.
