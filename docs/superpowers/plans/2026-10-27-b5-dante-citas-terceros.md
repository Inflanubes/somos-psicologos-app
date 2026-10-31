# B5 — Dante: citas para otra persona, pareja, límites y derivaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dante agenda citas para otro adulto y registra parejas sin revelar si ya eran pacientes, limita a dos los cambios por cita, reenvía el consentimiento, no toca citas creadas por un psicólogo y nunca deja a nadie "en el limbo": cuando no puede seguir, deriva él mismo.

**Architecture:** Casi todo vive en las herramientas de n8n (`n8n/tools/*.js`, JavaScript plano que `build-workflow.mjs` concatena con `_comun.js` dentro del JSON del workflow) y en el prompt. Las decisiones deterministas (permiso del chat, duplicados por teléfono real, conteo de cambios, derivación automática) van en las herramientas, no en el modelo. La app solo gana dos columnas (migración 019), sus tipos y una etiqueta en Pacientes. Make no cambia.

**Tech Stack:** n8n (Code Tool sandbox: `query`, `helpers.httpRequest`, `$('Telegram Trigger')`), Supabase REST (clave publishable), Make webhook de Citas, Next.js + Vitest para la parte de la app.

**Spec:** `docs/superpowers/specs/2026-10-27-b5-dante-citas-terceros-design.md`. Tablero: `docs/backlog-2026-10-21.md` (B5: tareas 4, 6, 7, 9, 12). Método: `docs/metodo-trabajo.md`. Dependencias: B1 (plan `2026-10-26-b1-horarios-por-centro.md`, Tarea 11: `appPost`, comprobación antes de Make) y B4 (plan `2026-10-26-b4-consentimiento.md`: migración 018 `pareja_de`, ruta de Make `Reenviar consentimiento`, `lib/consentimiento.ts`).

## Global Constraints

- Rama `b5-dante-terceros` desde `main` **después** de que B1 y B4 estén en `main`. Commits en español.
- **Fuera del repo git:** `n8n/` y `Supabase/migrations/` cuelgan de `Z:\Claude\Somos Psicológos\` sin git. Antes de editar cualquier archivo de `n8n/tools`, `n8n/prompts` o `n8n/workflows`, copiarlo a su `_backups/` con fecha (`_backups/2026-MM-DD-<archivo>`); al cerrar el chat, anotar en el tablero qué archivos de fuera del repo cambiaron.
- Dante está en producción: el JSON regenerado se importa primero en un workflow **copia** y se prueba con un chat de prueba; a producción solo de madrugada o con Dante parado, y solo cuando Sonia lo autorice en el chat.
- Cada tarea de n8n termina con `node --check` limpio en los archivos tocados y `node n8n/tools/build-workflow.mjs` (con `DANTE_API_TOKEN` en el entorno, requisito de B1) sin error. Cada tarea de la app termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde.
- Textos fijos para el paciente (copiar tal cual; los devuelven las herramientas en `mensaje_paciente`):
  - `Esa cita la gestiona directamente tu psicólogo/a. He avisado al equipo para que te la cambien; te contactarán en breve.`
  - `Esta cita ya se ha cambiado dos veces. He avisado al equipo para que lo revise contigo; te contactarán en breve.`
  - `Ahora mismo no puedo gestionar esa cita. He avisado al equipo y te contactarán en breve.`
  - `Necesito que una persona del equipo revise tu ficha. Ya les he avisado; te contactarán en breve.`
  - `El equipo revisará la solicitud y te contactará para cerrar la cita.`
- Orígenes que cuentan como "cambio pedido por el paciente": `origen in ('dante','call_center')`. Límite: `MAX_CAMBIOS_POR_CITA = 2`.
- Enlaces del consentimiento: `https://www.somospsicologos.es/consentimiento/` (adulto) y `https://www.somospsicologos.es/consentimiento-menores/` (menor), los mismos que `lib/consentimiento.ts` (B4).
- Nunca se revela que una tercera persona o una pareja ya era paciente: ni en `mensaje_paciente`, ni en el prompt, ni en los campos que se devuelven al modelo salvo `ya_existia` acompañado de `no_revelar: true`.

## Decisiones del plan que afinan la especificación

1. **(Corregido en la revisión final, 31-10-2026:** el `origen` del historial es el de quien creó la cita; se cuenta por `realizado_por = 'Dante'` o `realizado_por_id` de un perfil `call_center`.) **Conteo de cambios por `accion_id`** en `acciones_historial` (la fila `Agendar cita` conserva su `id` en los cambios desde la migración 011), filtrando `origen in (dante,call_center)`. Si el historial no tiene `origen` en filas antiguas (null), no cuentan.
2. **Aviso del segundo cambio sin derivación:** `avisarAgente` (Telegram al primer agente disponible de la cadena `general`) para no crear un recordatorio cada 15 min por algo que ya está hecho.
3. **`ConsultarPaciente` con `or=`** para que las personas registradas desde este chat aparezcan en la identificación; se reutiliza el flujo de "2 o más resultados".
4. **Tercero con otro psicólogo del mismo tipo:** no se cambia nada; aviso "Paciente duplicado" a Make y `necesita_equipo` con texto neutro. Sonia puede cambiarlo por "se agenda con el psicólogo que ya tiene".
5. **Pareja desde Dante solo si la ficha principal no tiene `pareja_de`**, y se ofrece una única vez por conversación.
6. **Etiqueta en Pacientes:** "Añadido por" añade ` (a petición de {nombre})` resolviendo `solicitante_id` contra la lista de pacientes ya cargada en `PacientesClient`; sin consulta nueva.

## Review Focus

1. **El modelo manda `telefono` con espacios o prefijo** (`+34 600 11 22 33`): `normalizarTelefono` lo deja en dígitos y la búsqueda de duplicados usa ese valor; con menos de 9 dígitos la herramienta pide el móvil otra vez (Tarea 2, prueba manual 1 de la Tarea 6).
2. **Quien escribe no es paciente** y pide cita para otro: `solicitante_id` vacío, `solicitante_chat` relleno, y `EjecutarAccion` le deja agendar para esa ficha (`pacienteDeEsteChat`) (Tareas 2 y 3).
3. **Cita de psicólogo + tercer cambio a la vez:** gana la regla de `origen = psicologo` (se comprueba antes) y solo se crea **una** derivación (Tarea 4).
4. **`derivar` falla** (ningún agente acepta el Telegram): la herramienta devuelve `ok: false` con `derivado: false` y el texto "No he podido avisar al equipo. Llama al 91 166 50 47." para que Dante no prometa un contacto que no existe (Tarea 2).
5. **Reenviar consentimiento a un menor sin tutores en `asociados_menores`:** no se manda nada a Make; `ok: false` con "Falta el teléfono de los tutores" y derivación automática (Tarea 4).

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `Supabase/migrations/019_solicitante.sql` (fuera del repo) | `solicitante_id`, `solicitante_chat` en `pacientes` | Crear |
| `types/database.ts` | tipos de las dos columnas | Modificar |
| `lib/pacientes-tipos.ts` (+ `.test.ts`) | `textoSolicitante` | Modificar |
| `app/dashboard/_components/PacientesTable.tsx` | etiqueta "a petición de" | Modificar |
| `n8n/tools/_comun.js` | `normalizarTelefono`, `pacienteDeEsteChat`, `avisarAgente`, `derivar`, `failDerivado`, `AGENTES_POR_TIPO` | Modificar |
| `n8n/tools/contactar-agente.js` | pasa a llamar a `derivar` | Modificar |
| `n8n/tools/registrar-paciente.js` | tercero (`para_otra_persona`), pareja (`vincularPareja`) | Modificar |
| `n8n/tools/ejecutar-accion.js` | origen psicólogo, límite de cambios, derivaciones propias, `Reenviar consentimiento` | Modificar |
| `n8n/tools/build-workflow.mjs` | esquemas, descripciones, URLs de `ConsultarPaciente` y `ConsultarCitasActivas` | Modificar |
| `n8n/prompts/somos-system-prompt.md` | secciones nuevas y reglas | Modificar |
| `n8n/workflows/somos-main-agent.json` | regenerado | Regenerar |
| `docs/dante-cambios-2026-10-b5.md` | guion de pruebas y pasos para Sonia | Crear |

---

### Task 1: Migración 019, tipos y etiqueta "a petición de"

**Files:**
- Create (fuera del repo): `Supabase/migrations/019_solicitante.sql`
- Modify: `types/database.ts` (fila de `pacientes`), `lib/pacientes-tipos.ts`, `app/dashboard/_components/PacientesTable.tsx` (celda "Añadido por")
- Test: `lib/pacientes-tipos.test.ts`

**Interfaces:**
- Produces: columnas `pacientes.solicitante_id uuid | null`, `pacientes.solicitante_chat text | null`; `textoSolicitante(p: { solicitante_id: string | null }, nombrePorId: Map<string, string>): string` → `' (a petición de {nombre})'` o `''` (si el id no está en el mapa: `' (a petición de otra persona)'`).

- [x] **Step 1: Migración.** (escrita y aplicada por Sonia el 31-10-2026) Cabecera de contexto como las anteriores; `ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES public.pacientes(id), ADD COLUMN IF NOT EXISTS solicitante_chat text;` + `COMMENT ON COLUMN` para las dos. Idempotente. Anotar `Aplicada el: ______`.
- [x] **Step 2: Tipos.** Añadir las dos columnas (opcionales en Insert/Update) a la fila de `pacientes` en `types/database.ts`.
- [x] **Step 3: Test que falla.** En `lib/pacientes-tipos.test.ts`:

```ts
describe('textoSolicitante', () => {
  const mapa = new Map([['p1', 'Ana López']]);
  it('sin solicitante → vacío', () => expect(textoSolicitante({ solicitante_id: null }, mapa)).toBe(''));
  it('con solicitante conocido', () => expect(textoSolicitante({ solicitante_id: 'p1' }, mapa)).toBe(' (a petición de Ana López)'));
  it('con solicitante desconocido', () => expect(textoSolicitante({ solicitante_id: 'zz' }, mapa)).toBe(' (a petición de otra persona)'));
});
```

- [x] **Step 4: Run** `npm test -- pacientes-tipos` → FAIL (`textoSolicitante is not a function`).
- [x] **Step 5: Implementar** `textoSolicitante` en `lib/pacientes-tipos.ts`; en `PacientesTable.tsx`, la celda "Añadido por" concatena `textoSolicitante(p, nombrePorId)` (el mapa lo construye `PacientesClient` desde la lista ya cargada y lo pasa por prop).
- [x] **Step 6: Run** `npm test -- pacientes-tipos` → PASS; `npx tsc --noEmit -p tsconfig.json` limpio.
- [x] **Step 7: Commit** — `git add types/database.ts lib/pacientes-tipos.ts lib/pacientes-tipos.test.ts app/dashboard/_components/PacientesTable.tsx app/dashboard/pacientes && git commit -m "B5: columnas solicitante en pacientes y etiqueta a petición de"`. La migración queda fuera del repo (nota en el tablero).

---

### Task 2: `_comun.js` — permiso por chat, teléfonos, aviso y derivación automáticos

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-_comun.js`, `n8n/tools/_backups/2026-MM-DD-contactar-agente.js`
- Modify (fuera del repo): `n8n/tools/_comun.js` (después de `chatIdTelegram`), `n8n/tools/contactar-agente.js`

**Interfaces:**
- Produces (globales del bloque común, disponibles en las tres tools):
  - `const AGENTES_POR_TIPO = { general: ['Marta','Sonia','Jaime'], marketing: ['Jaime','Sonia','Marta'], emergencia: ['Bea','Marta','Sonia','Jaime'] }` (se mueve desde `contactar-agente.js`).
  - `function normalizarTelefono(s): string | null` — `String(s).replace(/\D/g, '')`; null si `< 9` dígitos.
  - `function pacienteDeEsteChat(pac, chatId): boolean` — `!!chatId && (String(pac.telefono||'').trim() === chatId || String(pac.solicitante_chat||'').trim() === chatId)`.
  - `async function avisarAgente(tipo, texto): Promise<string | null>` — recorre `AGENTES_POR_TIPO[tipo]`, lee `agentes?nombre=eq.&activo=eq.true&select=telefono`, `sendMessage` con `parse_mode: 'Markdown'`; devuelve el nombre del primero que acepta o null.
  - `async function derivar(tipo, motivo, pacienteNombre, chatId): Promise<{ agente: string | null, registrada: boolean, mensaje: string }>` — compone el mensaje "🔔 *Derivación desde Dante*…" actual, `avisarAgente`, y si hay agente inserta en `derivaciones` (`chat_id, paciente_nombre, motivo, tipo, agente_nombre, mensaje_enviado, respondido: false, fecha_contacto`).
  - `async function failDerivado(mensajePaciente, tipo, motivoInterno, pacienteNombre, chatId, extra): Promise<string>` — llama a `derivar`; si `agente` → `fail(mensajePaciente, { derivado: true, agente, mensaje_paciente: mensajePaciente, ...extra })`; si no → `fail('No he podido avisar al equipo. Llama al 91 166 50 47.', { derivado: false, mensaje_paciente: 'No he podido avisar al equipo. Llama al 91 166 50 47.', ...extra })`.

- [x] **Step 1: Copias en `_backups/`.**
- [x] **Step 2: `_comun.js`:** añadir las cinco funciones y la constante.
- [x] **Step 3: `contactar-agente.js`:** sustituir el cuerpo por: parsear `tipo`, `motivo`, `paciente_nombre` (con la búsqueda por `chat_id` que ya hace), `chat_id`; `const r = await derivar(tipo, motivo, pacienteNombre, chatId)`; `if (!r.agente) return fail('No se pudo avisar a ningún agente por Telegram.')`; `return JSON.stringify({ ok: true, agente: r.agente, derivacion_registrada: r.registrada })`.
- [x] **Step 4: Verificar** — `node --check n8n/tools/_comun.js` no aplica (es un fragmento sin `return` global válido como módulo: comprobar con `node -e "new Function('query','helpers','$', require('fs').readFileSync('n8n/tools/_comun.js','utf8') + require('fs').readFileSync('n8n/tools/contactar-agente.js','utf8'))"` → sin error de sintaxis). Repetir el mismo chequeo para cada tool en las tareas siguientes.
- [x] **Step 5: Nota en el tablero** (columna Notas de B5): "27-10: `_comun.js` y `contactar-agente.js` modificados (fuera del repo)". Commit de docs: `git commit -am "B5: tablero (archivos n8n tocados)"`.

---

### Task 3: `RegistrarPaciente` — cita para otra persona y pareja

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-registrar-paciente.js`
- Modify (fuera del repo): `n8n/tools/registrar-paciente.js` (bloque "Vincular una ficha existente", bloque "Duplicados", "Insert en pacientes", "Aviso a Make")

**Interfaces:**
- Consumes: `normalizarTelefono`, `pacienteDeEsteChat`, `avisarEquipoDuplicado` (ya existe en el archivo), `evaluarDuplicado`.
- Entradas nuevas: `para_otra_persona` (bool), `telefono` (string), `solicitante_id` (uuid opcional), `pareja_nombre`, `pareja_telefono`.
- Produces: `async function vincularPareja(principal: { id, pareja_de }, psicologoId, centroId, nombre, telPareja): Promise<{ pareja_registrada: true } | null>` (null si la principal ya tiene `pareja_de` o faltan datos). Respuestas: `ok: true` lleva además `ya_existia?: true, no_revelar: true` (tercero) y `pareja_registrada?: true`.

- [x] **Step 1: Copia en `_backups/`.**
- [x] **Step 2: Teléfono de la ficha.** Tras `const telefono = chatIdTelegram(d.chat_id)`: `const paraOtra = esVerdadero(d.para_otra_persona); const telReal = paraOtra ? normalizarTelefono(d.telefono) : null; if (paraOtra && !telReal) return fail('Falta el teléfono móvil de esa persona (al menos 9 dígitos).'); const telefonoFicha = paraOtra ? telReal : telefono;` y usar `telefonoFicha` donde hoy se usa `telefono` (duplicados, insert, Make). Si `paraOtra && esMenor` → `fail('Es menor: regístralo como menor con los datos de sus tutores (flujo normal), no como cita para otra persona.', { es_menor: true })`.
- [x] **Step 3: Duplicados del tercero.** Solo con `paraOtra`: `existentes` = adultos con `telefono=eq.{telReal}`; `mismo = existentes.find(nombre igual normalizado)`. Si `mismo`: `ocupada = mismo[columna]`; vacía → PATCH `{ [columna]: psicologoId }` y `return ok:true, paciente_id: mismo.id, ya_existia: true, no_revelar: true, psicologo_id, psicologo_nombre, centro, instrucciones: 'No digas nunca que esa persona ya era paciente.'`; `=== psicologoId` → mismo `return` sin PATCH; otro → `await avisarEquipoDuplicado(mismo, 'Cita pedida por otra persona para ' + mismo.nombre + ', que ya tiene psicólogo de ' + ETIQUETA_TIPO[tipo] + ' (' + nombreOcupa + ') y se pidió ' + psico.nombre + '.')` y `return fail('El equipo revisará la solicitud y te contactará para cerrar la cita.', { necesita_equipo: true, avisado_equipo: true, no_revelar: true, mensaje_paciente: 'El equipo revisará la solicitud y te contactará para cerrar la cita.' })`. Sin `mismo` → seguir al insert (teléfono compartido se crea sin preguntar). El bloque `evaluarDuplicado` actual se salta cuando `paraOtra`.
- [x] **Step 4: Insert.** `nuevoPaciente.solicitante_chat = paraOtra ? telefono : null; nuevoPaciente.solicitante_id = paraOtra && UUID_RE.test(limpiar(d.solicitante_id) || '') ? d.solicitante_id : null;`. Make recibe `telefono: telefonoFicha`.
- [x] **Step 5: `vincularPareja`.** Implementar según la especificación (buscar adultos por `telefono=eq.`, mismo nombre → existente; `psicologo_pareja_id` solo si vacío, si lo ocupa otro → `avisarEquipoDuplicado` y no cambiar; `pareja_de` en ambas con dos PATCH; si no existe → `sbPost('pacientes', { nombre, iniciales: generarIniciales(nombre), telefono, es_menor: false, centro_id, psicologo_pareja_id, estado: 'Nuevo paciente', fecha_incorporacion: hoyMadrid(), pareja_de: principal.id, solicitante_chat: telefono(chat), solicitante_id: principal.id, created_by, created_by_id, origen }, true)` + PATCH `pareja_de` en la principal + `makePost` de `Añadir nuevo paciente` con `tipo_consulta: 'pareja'`, `telefono` de la pareja, `es_menor: false`). Llamarla: (a) tras el insert principal si `tipo === 'pareja'` y vienen `pareja_nombre`/`pareja_telefono`; (b) en la rama `vincular_a` con tipo pareja: después del PATCH de columna, y también cuando `ocupadaPor === psicologoId` (en vez del `fail` "ya está registrado") si vienen los datos de la pareja. Añadir `pareja_registrada: true` a la respuesta cuando devuelve algo.
- [x] **Step 6: Permiso en `vincular_a`:** sustituir `String(existente.telefono||'').trim() !== telefono` por `!pacienteDeEsteChat(existente, telefono)`.
- [x] **Step 7: Chequeo de sintaxis** (como en la Tarea 2, Step 4). Nota en el tablero y commit de docs.

---

### Task 4: `EjecutarAccion` — origen psicólogo, límite de cambios, derivaciones propias y reenvío de consentimiento

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-ejecutar-accion.js`
- Modify (fuera del repo): `n8n/tools/ejecutar-accion.js`

**Interfaces:**
- Consumes: `pacienteDeEsteChat`, `avisarAgente`, `failDerivado`, `appPost` (B1), `ACTOR`, `makePost`, `sbPost`.
- Constantes: `ACCIONES` + `'Reenviar consentimiento'`; `MAX_CAMBIOS_POR_CITA = 2`; `ORIGENES_PACIENTE = ['dante','call_center']`; `ENLACE_ADULTO`, `ENLACE_MENORES`.
- Produces (campos de respuesta nuevos): `derivado`, `mensaje_paciente`, `cita_de_psicologo`, `limite_cambios`, `aviso_equipo`, `cambios_previos`, `avisado_equipo`, `ya_firmado`, `destinatarios`.

- [x] **Step 1: Copia en `_backups/`.**
- [x] **Step 2: Permiso.** `if (chatId && !pacienteDeEsteChat(pac, chatId)) return fail(…)` (mismo texto de hoy). `select` del paciente añade `solicitante_chat,consentimiento`.
- [x] **Step 3: Reenviar consentimiento.** Rama temprana (antes de "Cita activa"): si `accion === 'Reenviar consentimiento'`: adulto → `destinatarios = [{ nombre: pac.nombre, telefono: pac.telefono }]`; menor → leer `asociados_menores?id_menor=eq.{id}&select=T1_nombre_completo,"T1_teléfono",T2_nombre_completo,"T2_teléfono"`, destinatarios con teléfono; si ninguno → `return await failDerivado('Necesito que una persona del equipo revise tu ficha. Ya les he avisado; te contactarán en breve.', 'general', 'Reenviar consentimiento: el menor ' + pac.nombre + ' no tiene teléfono de tutores en asociados_menores.', pac.nombre, chatId)`. `makePost` del sobre de la app con `datosProcesados = { psicologo_nombre: null, psicologo_id: null, centro_id: pac.centro_id, accion, paciente_id, paciente_nombre, paciente_iniciales, telefono, es_menor, enlace, tutor1_nombre, tutor1_telefono, tutor2_nombre, tutor2_telefono, created_by, created_by_id, origen }` y `respuestasFormulario: { 'Selecciona tu centro': centroNombre, '¿Qué necesitas hoy?': accion }`; log en `formulario_citas_psicologos` con `accion`; `return { ok: true, accion, ya_firmado: pac.consentimiento === true, destinatarios: nombres }`.
- [x] **Step 4: Origen psicólogo.** La consulta de citas activas añade `origen` al `select`. Tras elegir `citaSel`: `if (citaSel.origen === 'psicologo') return await failDerivado(TEXTO_CITA_PSICOLOGO, 'general', motivo, pac.nombre, chatId, { cita_de_psicologo: true })` con `motivo = 'Pide ' + (accion === 'Cambiar cita' ? 'cambiar al ' + normalizarFecha(d.fecha_cita) + ' ' + normalizarHora(d.hora_cita) : 'anular') + ' la cita del ' + citaSel.fecha_cita + ' a las ' + hora5(citaSel.hora_cita) + ' (creada por el psicólogo).'` (`hora5` = `slice(0,5)`). Va antes de leer el psicólogo y antes de la comprobación de B1.
- [x] **Step 5: Límite de cambios.** Solo `Cambiar cita`, justo después del Step 4: `const hist = await sbGet('acciones_historial?accion_id=eq.' + citaSel.id + '&accion=eq.' + encodeURIComponent('Cambiar cita') + '&origen=in.(' + ORIGENES_PACIENTE.join(',') + ')&select=id'); const cambiosPrevios = Array.isArray(hist) ? hist.length : 0; if (cambiosPrevios >= MAX_CAMBIOS_POR_CITA) return await failDerivado(TEXTO_LIMITE, 'general', 'Tercer cambio de la cita del … con … : pide ' + fecha + ' ' + hora + '. Dante no la ha cambiado.', pac.nombre, chatId, { limite_cambios: true, cambios_previos: cambiosPrevios })`. Tras el `makePost` correcto: `if (cambiosPrevios === 1) { avisoEquipo = await avisarAgente('general', '⚠️ *Segundo cambio de cita:* ' + pac.nombre + ' (' + pac.iniciales + ') pasa su cita del ' + citaSel.fecha_cita + ' ' + hora5(citaSel.hora_cita) + ' al ' + fecha + ' ' + hora + ' con ' + psico.nombre + '. Si vuelve a pedir cambio, Dante lo derivará.'); }` y en la respuesta `aviso_equipo: !!avisoEquipo, cambios_previos`.
- [x] **Step 6: Derivaciones propias.** Sustituir los cuatro `fail(... 'Deriva al equipo con ContactarAgente' ...)` por `failDerivado`: psicólogo `activo === false` → `TEXTO_NO_GESTIONAR` + `{ psicologo_inactivo: true }` (motivo interno: "El psicólogo X está desactivado; el paciente pide {accion} {fecha} {hora}."); sin iniciales, sin `gcal_event_id`, sin psicólogo asignado / no existe → `TEXTO_REVISAR_FICHA` con motivo técnico. El mensaje "varias citas activas" y "ninguna cita activa" se quedan como `fail` normal (Dante puede resolverlos preguntando).
- [x] **Step 7: `avisado_equipo`.** En la respuesta `ok: true` de `Sin disponibilidad` y `Cambio solicitado`: `avisado_equipo: true`.
- [x] **Step 8: Chequeo de sintaxis.** Nota en el tablero y commit de docs.

---

### Task 5: Build, esquemas, lecturas y prompt; regenerar el workflow

**Files:**
- Backup: `n8n/tools/_backups/2026-MM-DD-build-workflow.mjs`, `n8n/prompts/_backups/2026-MM-DD-somos-system-prompt.md` (crear la carpeta si no existe), `n8n/workflows/_backups/2026-MM-DD-somos-main-agent.json`
- Modify (fuera del repo): `n8n/tools/build-workflow.mjs` (`ConsultarPaciente`, `ConsultarCitasActivas`, `schemaRegistrar`, `schemaEjecutar`, descripciones de `registrar` y `ejecutar`), `n8n/prompts/somos-system-prompt.md`
- Regenerar: `n8n/workflows/somos-main-agent.json`

- [x] **Step 1: Copias en `_backups/`.**
- [x] **Step 2: `ConsultarPaciente`.** URL: `pacientes?or=(telefono.eq.${TG_FROM_ID},solicitante_chat.eq.${TG_FROM_ID})&select=id,nombre,iniciales,email,fecha_nacimiento,edad,es_menor,centro_id,psicologo_adultos_id,psicologo_pareja_id,psicologo_infantil_id,estado,pareja_de,consentimiento,solicitante_id&order=creado_en.asc&apikey=…`. `toolDescription`: añadir "También devuelve las personas registradas desde este chat para otros (solicitante_id = quien las registró): con 2 o más resultados pregunta para quién es la consulta. `pareja_de` = id de su pareja si está registrada; `consentimiento` = si ya firmó."
- [x] **Step 3: `ConsultarCitasActivas`.** `select` añade `origen,centro_id`; descripción: "`origen = psicologo` significa que la creó el psicólogo: Dante no puede cambiarla ni anularla (EjecutarAccion avisará al equipo)."
- [x] **Step 4: Esquemas.** `schemaRegistrar.properties` += `para_otra_persona` (boolean: "true cuando la cita es para otra persona adulta distinta de quien escribe"), `telefono` (string: "Solo con para_otra_persona: móvil real de esa persona"), `solicitante_id` (string: "Solo con para_otra_persona: id de quien escribe si ConsultarPaciente lo encontró"), `pareja_nombre`, `pareja_telefono` (string: "Solo tipo_consulta=pareja y si el paciente quiere registrar a su pareja: nombre completo / móvil"). `schemaEjecutar.properties.accion.enum` += `'Reenviar consentimiento'`; descripción de `paciente_id` sin cambios. Descripciones de las tools (`registrar`, `ejecutar`): una frase por novedad (tercero, pareja, reenviar, `derivado: true` → usar `mensaje_paciente` tal cual).
- [x] **Step 5: Prompt.** Aplicar la sección "Prompt" de la especificación: IDENTIFICACIÓN (resultados de otros registrados desde este chat), sección **CITA PARA OTRA PERSONA (ADULTA)**, oferta de pareja (ALTA paso 4 y GESTIÓN DE CITAS tipo pareja, una sola vez, solo si `pareja_de` vacío), GESTIÓN DE CITAS (campos `aviso_equipo`, `limite_cambios`, `cita_de_psicologo`, `derivado` → `mensaje_paciente` tal cual, sin añadir ni quitar), sección **CONSENTIMIENTO INFORMADO**, ESCALACIÓN con la regla de las tres condiciones y "con `derivado: true` no llames a ContactarAgente; con `avisado_equipo: true` basta con decir que el equipo le contactará". Añadir a "DE DÓNDE SALE CADA DATO": `telefono` (tercero / pareja) → lo que diga quien escribe, nunca el chat_id; `solicitante_id` → el `id` de quien escribe en ConsultarPaciente.
- [x] **Step 6: Regenerar** — `$env:DANTE_API_TOKEN='…'; node n8n/tools/build-workflow.mjs` → `OK → … | nodos: N`. Comprobar: `node -e "const w=require('./n8n/workflows/somos-main-agent.json');const n=Object.fromEntries(w.nodes.map(n=>[n.name,n]));console.log(n.ConsultarPaciente.parameters.url.includes('solicitante_chat'), n.EjecutarAccion.parameters.inputSchema.includes('Reenviar consentimiento'), n.EjecutarAccion.parameters.jsCode.includes('failDerivado'), n.RegistrarPaciente.parameters.jsCode.includes('vincularPareja'))"` → `true true true true`.
- [x] **Step 7: Nota en el tablero** con los archivos de `n8n/` tocados; commit de docs.

---

### Task 6: Guion para Sonia, tablero, manual y cierre

**Files:**
- Create: `docs/dante-cambios-2026-10-b5.md`
- Modify: `docs/backlog-2026-10-21.md` (B5 y tareas 4, 6, 7, 9, 12), `docs/manual-somos/index.html` (ficha Dante / Pacientes: "a petición de"; Novedades), este plan (casillas)

- [x] **Step 1: `docs/dante-cambios-2026-10-b5.md`.** Secciones: (1) Migración 019: aplicar de madrugada, anotar fecha. (2) Make: comprobar en la ruta 14 que un `telefono` que no es chat de Telegram no rompe el escenario (ignorar errores en 232/250/251/254 hasta WhatsApp); confirmar que la ruta `Reenviar consentimiento` (B4) está activa. (3) Importar el JSON en un workflow **copia** y pasar las 7 comprobaciones de aceptación de la especificación con un chat de prueba, una casilla por cada una, con qué mirar en Supabase (`pacientes.solicitante_chat`, `pareja_de`, `derivaciones`, `acciones_historial`) y en Telegram (Marta/Sonia). (4) Importar en producción de madrugada; anotar fecha. (5) Qué cambia cuando llegue WhatsApp: nada en Dante; el consentimiento a terceros empieza a llegar solo.
- [x] **Step 2: Tablero.** Tareas 4, 6, 7, 9, 12 → `hecha (pendiente de prueba real en n8n copia)` o `verificar`; B5 → estado; Notas: archivos de `n8n/` y `Supabase/migrations/019` fuera del repo.
- [x] **Step 3: Manual.** (31-10-2026: `index.html` actualizado y check OK; **republicar tras el merge**) `docs/manual-somos/index.html`: en Pacientes, "Añadido por … (a petición de X)"; en el apartado de Dante, las cuatro novedades para el cliente (cita para otra persona, pareja, dos cambios por cita, reenvío del consentimiento) y que Dante avisa al equipo él solo cuando no puede. `node docs/manual-somos/check-manual.mjs` → OK; republicar al artifact `FWj2hP27NkTXLFMUQvBuqi`.
- [ ] **Step 4: Commit y merge** — `git add docs && git commit -m "B5 cerrado: guion de Dante, tablero y manual"`; `git checkout main && git merge b5-dante-terceros && git push` solo de madrugada.
  **Quedó así (31-10-2026):** commit hecho en la rama; merge pendiente de que Sonia aplique la 019, pase las pruebas en el workflow copia e importe Dante (guion `docs/dante-cambios-2026-10-b5.md`).
