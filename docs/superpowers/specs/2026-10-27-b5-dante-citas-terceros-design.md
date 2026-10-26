# B5 — Dante: citas para otra persona, pareja, límites y derivaciones (diseño)

Fecha: 27-10-2026. Bloque B5 del tablero (tareas 4, 6, 7, 9, 12; las 8 y 10 esperan textos de Jaime y quedan fuera). Depende de **B1** (Dante ya pide huecos a la app y comprueba antes de Make: `appPost`, `/api/disponibilidad`) y de **B4** (ruta de Make `Reenviar consentimiento`, columna `pareja_de`). Se ejecuta después de los dos. Decisiones con Sonia el 27-10; **[mi decisión]** = lo decidió Claude.

## Cómo funciona hoy (verificado el 27-10 en `n8n/`)

- Dante identifica al paciente por `pacientes.telefono = chat_id` de Telegram. Todas las herramientas de escritura comprueban que el paciente es "de este chat". Un tercero (otra persona adulta) no tiene chat: hoy no se le puede registrar ni agendar.
- `RegistrarPaciente` crea la ficha con `telefono = chat_id` y manda `Añadir nuevo paciente` a Make, que envía el consentimiento por Telegram a ese `telefono` (solo llega a chats del bot). Con WhatsApp el `chat_id` será el teléfono real y el envío funcionará también para terceros.
- `EjecutarAccion` cambia o anula cualquier cita activa del paciente, sin mirar quién la creó ni cuántas veces se ha movido. Cuando no puede seguir (psicólogo desactivado, sin iniciales, sin evento de calendario, sin psicólogo) devuelve un `error` que dice "deriva al equipo con ContactarAgente" y **confía en que el modelo lo haga**: ahí está el limbo de la tarea 7.
- `ContactarAgente` manda un Telegram al primer agente disponible de la cadena (`general` Marta→Sonia→Jaime, `marketing` Jaime→Sonia→Marta, `emergencia` Bea→Marta→Sonia→Jaime) y escribe en `derivaciones`; el cron de 15 min recuerda hasta que alguien responde "atendido".
- `Sin disponibilidad`, `Cambio solicitado` y `Paciente duplicado` avisan al equipo por Make (un Telegram, sin recordatorio). **No** crean derivación y así se queda (decisión de Sonia, 27-10): las derivaciones son solo para lo que Dante no puede resolver.

## Objetivos

1. **Cita para otra persona adulta (9).** Quien escribe pide cita para otro adulto (hijo mayor de edad, padre, amigo…). Dante pide los datos de esa persona (nombre completo, teléfono móvil, fecha de nacimiento, email opcional, tipo de consulta, centro y psicólogo), ofrece huecos y agenda **a nombre de esa persona**. La empresa no confirma nada con ella: quien pide la cita se encarga de avisarla. La ficha se crea con su **teléfono real**, apuntando a quién la pidió (`solicitante_id`, `solicitante_chat`); Make le envía el consentimiento a ese teléfono (llega cuando esté WhatsApp; hasta entonces el equipo puede reenviarlo desde Pacientes, B4). Si esa persona **ya existe** (mismo teléfono y mismo nombre), no se crea ficha nueva ni se dice que ya existía: se le añade el psicólogo del tipo que falte y se agenda. Los menores no van por aquí: siguen siendo el alta de menor con tutores (su teléfono es el del tutor que escribe).
2. **Pareja desde Dante (9, enlaza con B4-40).** En un alta o una cita de pareja, Dante ofrece registrar a la pareja (nombre y teléfono; opcional hasta que Jaime conteste, como en la app). Mismo comportamiento que el alta de pareja de B4: si ya es paciente se le vincula sin decirlo y se le pone el psicólogo de pareja si no lo tenía; si no, ficha mínima con `pareja_de` en las dos direcciones y consentimiento a su teléfono. En pantalla (chat) solo: "Hecho: le enviaremos el consentimiento a {nombre}."
3. **Máximo dos cambios por cita (4).** Se cuentan en `acciones_historial` las filas `Cambiar cita` de esa misma cita (`accion_id`) pedidas por el paciente (`origen` dante o call_center **[mi decisión]**; los cambios hechos por agentes o psicólogos no cuentan). El segundo cambio se hace y Marta recibe un aviso simple por Telegram (sin derivación). Al tercero Dante no cambia nada, crea una derivación y se lo dice al paciente.
4. **Reenviar consentimiento (6).** Si el paciente pide el consentimiento, el enlace, o dice que no le ha llegado, Dante manda `Reenviar consentimiento` por el mismo webhook que la app (ruta de Make de B4). Adulto: a su teléfono; menor: a los tutores. Si ya consta firmado, Dante se lo dice y lo manda igual.
5. **Sin limbo (7).** Las herramientas derivan **ellas mismas** cuando llegan a un callejón sin salida (psicólogo desactivado, cita creada por el psicólogo, tercer cambio, sin iniciales, sin evento de calendario, sin psicólogo asignado) y devuelven `derivado: true` con el texto exacto para el paciente. El modelo solo llama a `ContactarAgente` en los casos de conversación (pide una persona, marketing, emergencia, algo que Dante no gestiona). Regla nueva del prompt: Dante no puede decir "te contactarán" si no ha pasado una de estas tres cosas: una herramienta devolvió `derivado: true`, una herramienta devolvió `avisado_equipo: true` (Make ya avisó: Sin disponibilidad, Cambio solicitado, Paciente duplicado) o él mismo ha llamado a `ContactarAgente` con éxito.
6. **Citas creadas por un psicólogo (12).** Igual que el call center en B3: Dante no cambia ni anula una cita cuyo `origen` es `psicologo`. La herramienta crea una derivación con lo que el paciente quería (nueva fecha y hora, o anular) y Dante se lo explica.

## No objetivos

- Información de clínicas (8) y preguntas frecuentes (10): esperan a Jaime.
- Cambiar Make: la ruta `Reenviar consentimiento` la crea B4; la ruta 14 ya manda el consentimiento al `telefono` que llega (con WhatsApp funcionará para teléfonos reales sin tocar nada).
- Que el tercero pueda escribir luego a Dante y ser reconocido por Telegram: su ficha lleva teléfono real y Telegram no lo da. Se resuelve solo con WhatsApp (chat_id = teléfono). Hasta entonces, si esa persona escribe desde Telegram, Dante la verá como nueva y el alta chocará por nombre con la ficha existente (ruta "Paciente duplicado", el equipo lo une a mano).
- Tests Vitest de las herramientas de n8n: viven fuera del repo y usan globales del sandbox. Se comprueban con `node --check`, el build y el guion de pruebas en un workflow copia (como en B1).

## Modelo de datos (migración `019_solicitante.sql`)

```
pacientes
  + solicitante_id   uuid REFERENCES pacientes(id)  -- paciente que pidió la cita por esta persona (si era paciente)
  + solicitante_chat text                           -- chat (Telegram hoy, teléfono con WhatsApp) desde el que se pidió
```

Idempotente, de madrugada. `pareja_de` viene de la 018 (B4). Ninguna de las dos columnas la toca Make.

## Herramientas de Dante (`n8n/tools/`)

### `_comun.js` (bloque común)

- `normalizarTelefono(s): string | null` — solo dígitos; null si tiene menos de 9.
- `pacienteDeEsteChat(pac, chatId): boolean` — `pac.telefono === chatId || pac.solicitante_chat === chatId`. Sustituye a la comparación directa en `EjecutarAccion` y en `vincular_a` de `RegistrarPaciente`.
- `avisarAgente(tipo, texto): Promise<string | null>` — manda `texto` por Telegram al primer agente de la cadena `AGENTES_POR_TIPO[tipo]` que acepte el mensaje (lógica que hoy está en `contactar-agente.js`); devuelve el nombre o null. **Sin** derivación.
- `derivar(tipo, motivo, pacienteNombre, chatId): Promise<{ agente: string | null, registrada: boolean }>` — `avisarAgente` con el mensaje "🔔 Derivación desde Dante…" de hoy + fila en `derivaciones`. `contactar-agente.js` pasa a ser una llamada a esto.
- `failDerivado(mensajePaciente, derivacion, extra)` → `fail(mensajePaciente, { derivado: true, agente, mensaje_paciente: mensajePaciente, ...extra })`.

### `RegistrarPaciente` (entradas nuevas)

| Entrada | Cuándo | Efecto |
|---|---|---|
| `para_otra_persona: boolean` | cita para otro adulto | la ficha lleva `telefono` real (obligatorio), `solicitante_chat = chat_id`, `solicitante_id` (si quien escribe es paciente) |
| `telefono: string` | solo con `para_otra_persona` | teléfono móvil real de esa persona (`normalizarTelefono`) |
| `solicitante_id: string` | opcional con `para_otra_persona` | `id` de quien escribe si `ConsultarPaciente` lo encontró |
| `pareja_nombre`, `pareja_telefono` | `tipo_consulta = pareja` (alta nueva o `vincular_a`) | registra o vincula a la pareja como en B4 |

Reglas para `para_otra_persona`:
- Si la fecha de nacimiento da menor → `ok: false`: "Es menor: regístralo como menor con los datos de sus tutores (flujo normal), no como cita para otra persona."
- Duplicados por el **teléfono real** entre adultos: mismo teléfono y mismo nombre (`normalizarNombre`) → ficha existente. Si no tiene psicólogo del tipo → se le pone el elegido y se devuelve `ok: true, paciente_id, ya_existia: true`. Si ya tiene **ese mismo** psicólogo → `ok: true, ya_existia: true`. Si tiene **otro** del mismo tipo → aviso a Make "Paciente duplicado" (como hoy) y `ok: false, necesita_equipo: true, avisado_equipo: true, mensaje_paciente: "El equipo revisará la solicitud y te contactará para cerrar la cita."` **[mi decisión]**: así no se revela nada y no se cambia un psicólogo a espaldas de nadie. Mismo teléfono con otro nombre → se crea (teléfono compartido). En todos los casos `no_revelar: true` y la instrucción "No digas nunca que esa persona ya era paciente."
- La ficha nueva lleva los mismos campos que hoy más `solicitante_chat`, `solicitante_id`; Make recibe `Añadir nuevo paciente` con `telefono` real (consentimiento).

Reglas para la pareja (`vincularPareja(principalId, psicologoId, centroId, nombre, telefono)`):
- Busca adultos por teléfono; mismo nombre → existente: `psicologo_pareja_id` si estaba vacío (si lo ocupa otro psicólogo: aviso "Paciente duplicado" a Make, no se cambia), `pareja_de` en ambas fichas. Si no existe → ficha mínima (`nombre`, `iniciales`, `telefono`, `es_menor: false`, `centro_id`, `psicologo_pareja_id`, `estado: 'Nuevo paciente'`, `pareja_de`, `solicitante_chat`, `solicitante_id = principalId`, atribución Dante) + `pareja_de` en la principal + `Añadir nuevo paciente` a Make (consentimiento).
- Devuelve solo `pareja_registrada: true` (nunca si existía).
- Si la ficha principal ya tiene `pareja_de`, no se pide ni se cambia.
- Con `vincular_a` + tipo pareja + mismo psicólogo ya puesto, hoy falla con "ya está registrado": si vienen `pareja_nombre`/`pareja_telefono` se hace solo la vinculación de la pareja y se devuelve `ok: true, vinculado: true, pareja_registrada: true`.

### `EjecutarAccion`

- Acción nueva `Reenviar consentimiento`: solo `paciente_id`. Lee `pacientes` (+ `asociados_menores` si `es_menor`) y manda a Make el sobre de la app con `datosProcesados = { accion: 'Reenviar consentimiento', paciente_id, paciente_nombre, telefono, es_menor, enlace, tutor1_nombre, tutor1_telefono, tutor2_nombre, tutor2_telefono, created_by, created_by_id, origen }` (mismos campos que `payloadReenvio` de `lib/consentimiento.ts`, B4; `enlace` = `https://www.somospsicologos.es/consentimiento/` o `…/consentimiento-menores/`). Registro en `formulario_citas_psicologos` como el resto. Devuelve `ok: true, ya_firmado: boolean, destinatarios: [nombre…]`.
- Permiso: `pacienteDeEsteChat`.
- `Cambiar cita` / `Cancelar cita`: la consulta de citas activas trae `origen`. Si `origen === 'psicologo'` → `derivar('general', 'Pide {cambiar al {fecha} {hora} | anular} la cita del {fecha} a las {hora} con {psicólogo} (creada por el psicólogo).')` y `failDerivado("Esa cita la gestiona directamente tu psicólogo/a. He avisado al equipo para que te la cambien; te contactarán en breve.", …, { cita_de_psicologo: true })`. Va **antes** de la comprobación de disponibilidad de B1 (no se gasta una llamada).
- `Cambiar cita`: `n = acciones_historial?accion_id=eq.{id}&accion=eq.Cambiar cita&origen=in.(dante,call_center)` (count). `n >= 2` → `derivar('general', 'Tercer cambio de la cita del … con …: pide {fecha} {hora}. Dante no la ha cambiado.')` y `failDerivado("Esta cita ya se ha cambiado dos veces. He avisado al equipo para que lo revise contigo; te contactarán en breve.", …, { limite_cambios: true })`. `n === 1` → se hace y, tras el OK de Make, `avisarAgente('general', '⚠️ Segundo cambio de cita: {nombre} ({iniciales}) pasa su cita del {fecha} {hora} al {fecha} {hora} con {psicólogo}. Si vuelve a pedir cambio, Dante lo derivará.')`; la respuesta lleva `aviso_equipo: true, cambios_previos: 1`.
- Callejones sin salida que hoy dicen "deriva al equipo con ContactarAgente" pasan a derivar solos con `failDerivado` y un `mensaje_paciente` fijo: psicólogo desactivado ("Ahora mismo no puedo gestionar esa cita. He avisado al equipo y te contactarán en breve."), sin iniciales / sin evento de calendario / sin psicólogo asignado ("Necesito que una persona del equipo revise tu ficha. Ya les he avisado; te contactarán en breve."). Motivo interno en `derivar` con el detalle técnico (el paciente no lo ve).
- `Sin disponibilidad` y `Cambio solicitado` devuelven `avisado_equipo: true` (Make avisa; sin derivación).

### `ContactarAgente`

Sin cambios de comportamiento: `derivar(tipo, motivo, paciente_nombre, chat_id)`.

### Herramientas de lectura (`build-workflow.mjs`)

- `ConsultarPaciente`: URL `pacientes?or=(telefono.eq.{chat},solicitante_chat.eq.{chat})&select=…,pareja_de,consentimiento,solicitante_id` → también aparecen las personas registradas desde este chat; el prompt pregunta "¿La consulta es para ti o para {nombre}?".
- `ConsultarCitasActivas`: `select` añade `origen,centro_id`.
- Esquemas de `RegistrarPaciente` (`para_otra_persona`, `telefono`, `solicitante_id`, `pareja_nombre`, `pareja_telefono`) y `EjecutarAccion` (`Reenviar consentimiento` en el enum).

## Prompt (`n8n/prompts/somos-system-prompt.md`)

- IDENTIFICACIÓN: los resultados pueden incluir personas registradas desde este chat para otros; con 2 o más, preguntar para quién es.
- Sección nueva **CITA PARA OTRA PERSONA (ADULTA)**: cuándo aplica (el paciente dice que es para otra persona mayor de edad), qué explicar ("Le enviaremos el consentimiento informado a su teléfono; de avisarle de la cita te encargas tú"), datos a pedir uno a uno (nombre completo, móvil, fecha de nacimiento, email opcional, individual o pareja, centro, psicólogo), confirmación, `RegistrarPaciente` con `para_otra_persona: true`, `telefono`, `solicitante_id` (si quien escribe es paciente), después huecos y `EjecutarAccion` con el `paciente_id` devuelto. Prohibido decir que ya era paciente, aunque `ya_existia` sea true. Si da menor → flujo de menor.
- ALTA y GESTIÓN DE CITAS (pareja): cuando el tipo es pareja y la ficha no tiene `pareja_de`, ofrecer una vez "¿Quieres que registremos también a tu pareja para enviarle el consentimiento? Necesito su nombre y su móvil." Si acepta, pasar `pareja_nombre` y `pareja_telefono` en `RegistrarPaciente` (alta nueva, o `vincular_a` = su `paciente_id` si ya es paciente). Respuesta fija "Hecho: le enviaremos el consentimiento a {nombre}." Si no quiere, seguir sin insistir.
- GESTIÓN DE CITAS: `Cambiar cita` puede devolver `aviso_equipo: true` (no decir nada especial al paciente), `limite_cambios: true` o `cita_de_psicologo: true` con `derivado: true` → responder con `mensaje_paciente` tal cual.
- Sección nueva **CONSENTIMIENTO INFORMADO**: qué es (documento que se firma online), cuándo reenviarlo (lo pide, no le llegó, lo perdió) → `EjecutarAccion` con `Reenviar consentimiento`; respuesta "Te lo acabo de reenviar al móvil de {destinatarios}." y, si `ya_firmado`, "Según nuestros datos ya lo tienes firmado, pero te lo reenvío por si lo necesitas."
- ESCALACIÓN: regla de las tres condiciones (objetivo 5). Con `derivado: true` no volver a llamar a `ContactarAgente`. Con `avisado_equipo: true` basta con decir que el equipo le contactará.

## Make (apartado para Sonia)

- Nada nuevo: `Reenviar consentimiento` es la ruta de B4; `Añadir nuevo paciente` ya manda el consentimiento al `telefono` recibido.
- Revisar en la ruta 14 (módulos 232/250/251/254) que un `telefono` que no sea chat de Telegram **no rompa el escenario** (error "chat not found"): poner "Ignorar errores" en esos módulos hasta que esté WhatsApp, o comprobar que ya está así.

## Textos de Dante (fijos, devueltos por las herramientas en `mensaje_paciente`)

- `Esa cita la gestiona directamente tu psicólogo/a. He avisado al equipo para que te la cambien; te contactarán en breve.`
- `Esta cita ya se ha cambiado dos veces. He avisado al equipo para que lo revise contigo; te contactarán en breve.`
- `Ahora mismo no puedo gestionar esa cita. He avisado al equipo y te contactarán en breve.`
- `Necesito que una persona del equipo revise tu ficha. Ya les he avisado; te contactarán en breve.`
- `El equipo revisará la solicitud y te contactará para cerrar la cita.`
- Prompt: `Le enviaremos el consentimiento informado a su teléfono; de avisarle de la cita te encargas tú.` · `Hecho: le enviaremos el consentimiento a {nombre}.` · `Te lo acabo de reenviar al móvil de {destinatarios}.`

## Comprobación de aceptación (workflow copia, chat de prueba)

1. "Quiero una cita para mi padre" → Dante pide los datos del padre, agenda a su nombre; la ficha tiene teléfono real, `solicitante_chat` = chat de prueba; Make recibe `Añadir nuevo paciente` con ese teléfono. Repetir con el mismo nombre y teléfono → no se crea ficha nueva y Dante **no** dice que ya existía.
2. Alta de pareja con pareja ya paciente de adultos → esa ficha gana `psicologo_pareja_id` y `pareja_de`; Dante solo dice "Hecho: le enviaremos…". Con pareja desconocida → ficha mínima y consentimiento.
3. Cita movida una vez por Dante: segundo cambio se hace y Marta recibe el aviso ⚠️; tercer intento: no se cambia, hay fila en `derivaciones`, Dante responde con el texto fijo.
4. "No me ha llegado el consentimiento" → Make recibe `Reenviar consentimiento` (adulto: su teléfono; menor: tutores).
5. Cita con `origen = psicologo`: "cámbiala al jueves" → no se cambia, derivación con la fecha pedida, texto fijo.
6. Psicólogo desactivado: `derivaciones` tiene fila y el paciente recibe el texto fijo sin que el modelo llame a `ContactarAgente`.
7. `Sin disponibilidad`: Marta recibe el Telegram de Make y **no** hay fila nueva en `derivaciones`.
