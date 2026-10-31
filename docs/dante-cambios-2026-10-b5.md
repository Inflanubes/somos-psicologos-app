# Dante — bloque B5: cita para otra persona, pareja, dos cambios por cita y reenvío del consentimiento

Fecha: 31-10-2026. Rama `b5-dante-terceros`. Plan: `docs/superpowers/plans/2026-10-27-b5-dante-citas-terceros.md`.

> **⚠️ NO importar este Dante antes de aplicar la migración 019.** Sin ella Dante no reconoce a nadie, no da altas y no gestiona citas: todas sus consultas piden las columnas nuevas y Supabase las rechaza.

## Qué cambia para el paciente

- **Cita para otra persona adulta** (un hijo mayor de edad, un padre, un amigo): Dante pide sus datos y su móvil y agenda a su nombre. La ficha queda con el teléfono real de esa persona y apunta a quién la pidió ("a petición de …" en Pacientes). Si esa persona ya era paciente, Dante no lo dice.
- **Pareja:** en un alta o una cita de pareja, Dante ofrece una vez registrar a la pareja (nombre y móvil) para enviarle el consentimiento.
- **Máximo dos cambios por cita** pedidos por el paciente (Dante o call center). El segundo se hace y Marta recibe un aviso ⚠️. Al tercero Dante no cambia nada y deriva.
- **Reenviar el consentimiento** cuando el paciente lo pide (adulto: a su móvil; menor: a los tutores).
- **Citas creadas por el psicólogo:** Dante no las cambia ni anula; deriva al equipo con la fecha que pedía el paciente.
- **Sin limbo:** cuando Dante no puede seguir (psicólogo desactivado, ficha incompleta, cita del psicólogo, tercer cambio) la herramienta deriva sola y Dante responde con un texto fijo. Dante solo dice "te contactarán" si de verdad se ha avisado a alguien.

## Archivos que cambian (fuera del repo, sin git)

| Archivo | Copia de antes |
|---|---|
| `n8n/tools/_comun.js` | `n8n/tools/_backups/2026-10-31-_comun.js` |
| `n8n/tools/contactar-agente.js` | `n8n/tools/_backups/2026-10-31-contactar-agente.js` |
| `n8n/tools/registrar-paciente.js` | `n8n/tools/_backups/2026-10-31-registrar-paciente.js` |
| `n8n/tools/ejecutar-accion.js` | `n8n/tools/_backups/2026-10-31-ejecutar-accion.js` |
| `n8n/tools/build-workflow.mjs` | `n8n/tools/_backups/2026-10-31-build-workflow.mjs` |
| `n8n/prompts/somos-system-prompt.md` | `n8n/prompts/_backups/2026-10-31-somos-system-prompt.md` |
| `n8n/workflows/somos-main-agent.json` (regenerado) | `n8n/workflows/_backups/2026-10-31-somos-main-agent.json` |
| `Supabase/migrations/019_solicitante.sql` | nueva |

## 1. Migración 019 (de madrugada)

- [x] Aplicar `Supabase/migrations/019_solicitante.sql` en el SQL Editor (añade `pacientes.solicitante_id` y `pacientes.solicitante_chat`). Es idempotente. **Aplicada por Sonia el 31-10-2026.**

**Va antes que todo lo demás:** sin la 019, `ConsultarPaciente` falla (pide `solicitante_chat`) y Dante no reconoce a nadie. La app sí funciona sin ella (la etiqueta "a petición de" no sale).

## 2. Make

Nada nuevo que construir.

**Ojo: no son las rutas de crear, cambiar o anular cita**, sino estas dos: ruta 14 «Añadir nuevo paciente» y ruta 16 «Reenviar consentimiento».

Revisado en el blueprint exportado el 31-10-2026 (`Make blueprints/Formulario Citas Psicologos.blueprint.json`): en la ruta 14 los envíos del consentimiento son los **últimos** módulos (250 y 251 a los tutores, 254 al paciente) y en la ruta 16 «Reenviar consentimiento», los 271, 272 y 273. **Ninguno de los seis tiene gestor de errores**; el resto de envíos a pacientes del escenario sí lo tienen (avisan al chat de Be Banana). Hoy ya les llega un teléfono real en cada alta hecha desde la app, así que esto no es nuevo de B5.

- [ ] **Comprobar sin enviar nada:** en el historial del escenario, abrir la ejecución de un alta reciente hecha desde la app (paciente con su móvil real). Si el módulo 254 sale en rojo con "chat not found" y el escenario sigue activo, Make aguanta el error; solo queda la ejecución marcada como fallida.
- [x] **Hecho por Sonia el 31-10-2026.** En los módulos 250, 251, 254, 271, 272 y 273, botón derecho → «Add error handler» → **Ignore**. Así un móvil que Telegram no conoce no deja ejecuciones en error ni hay riesgo de que Make desactive el escenario por errores seguidos. Se quita cuando estos envíos pasen a WhatsApp.
- [ ] Comprobar que la ruta «Reenviar consentimiento» (B4) está activa. Dante manda el mismo sobre que la app, con `psicologo_id` del psicólogo de referencia y `origen: dante`.

## 3. Importar el Dante nuevo y probarlo

**Importado y publicado por Sonia el 31-10-2026.** Quedan las pruebas de abajo.

**Qué es "importar":** sustituir el contenido del workflow de Dante que está funcionando en n8n (id `6nzKwBire02c9qx3`) por el archivo `n8n/workflows/somos-main-agent.json`, como en los reimportados anteriores. La versión de antes queda guardada en `n8n/workflows/_backups/2026-10-31-somos-main-agent.json`: si algo va mal, se vuelve a importar esa y Dante queda como estaba.

**Por qué no en una copia:** Telegram solo deja un workflow escuchando cada bot. Una copia con el mismo bot le quitaría los mensajes al Dante de producción mientras está activa (o mientras se prueba con «Test workflow»). Sin un bot de pruebas, lo práctico es probar en el propio Dante en un rato tranquilo, con la copia de vuelta a mano.

**Cómo:** en un rato con poco movimiento, avisar a Marta (le llegarán avisos de prueba), importar, y hacer las pruebas de abajo escribiendo a Dante desde tu propio Telegram. Cada prueba es una conversación; después se mira en Supabase lo que dice cada casilla. Lo que se cree para probar (fichas, citas, derivaciones) se borra después. Si una prueba falla y no se puede arreglar en el momento, se reimporta la copia de antes.

Una casilla por prueba:

- [ ] **1b. Cita para alguien que ya es paciente con su propio teléfono** (dado de alta en la app): Dante no la agenda ni dice que ya era paciente; responde «El equipo revisará la solicitud…» y hay fila en `derivaciones` con el detalle.
- [ ] **1. Cita para otra persona.** "Quiero una cita para mi padre" → Dante pide nombre, móvil, fecha de nacimiento, email, tipo, centro y psicólogo; agenda a nombre del padre.
  Supabase: la ficha nueva tiene `telefono` = móvil del padre, `solicitante_chat` = chat de prueba y `solicitante_id` = ficha de quien escribe. Make recibe «Añadir nuevo paciente» con ese teléfono. En Pacientes, "Añadido por Dante (a petición de …)".
  Repetir con el mismo nombre y móvil → no se crea otra ficha y Dante **no** dice que ya existía.
- [ ] **2. Pareja.** Alta de pareja dando los datos de una pareja que ya es paciente de adultos → esa ficha gana `psicologo_pareja_id` y las dos fichas tienen `pareja_de` apuntando a la otra; Dante solo dice "Hecho: le enviaremos el consentimiento a …". Con una pareja que no existe → ficha mínima nueva y Make recibe «Añadir nuevo paciente» con su móvil.
- [ ] **3. Dos cambios.** (Cuentan los cambios hechos por Dante o por una cuenta de call center, según quién hizo el cambio en el historial; los de agentes y psicólogos no cuentan.) Con una cita ya movida una vez por Dante: el segundo cambio se hace y Marta (o el siguiente de la cadena) recibe "⚠️ Segundo cambio de cita". Tercer intento: la cita no cambia, hay fila nueva en `derivaciones` y Dante responde "Esta cita ya se ha cambiado dos veces…".
- [ ] **4. Consentimiento.** "No me ha llegado el consentimiento" → Make recibe «Reenviar consentimiento» (adulto: su teléfono; con un menor: los tutores). Si la ficha tiene `consentimiento = true`, Dante dice que ya consta firmado y lo reenvía igual.
- [ ] **5. Cita del psicólogo.** Con una cita con `origen = psicologo`: "cámbiala al jueves" → la cita no cambia, hay fila en `derivaciones` con la fecha pedida y Dante responde "Esa cita la gestiona directamente tu psicólogo/a…".
- [ ] **6. Psicólogo desactivado.** Paciente con psicólogo desactivado pide cita → hay fila en `derivaciones` y Dante responde "Ahora mismo no puedo gestionar esa cita…" **sin** llamar a ContactarAgente (en la ejecución de n8n no aparece ContactarAgente).
- [ ] **7. Sin disponibilidad.** Marta recibe el Telegram de Make y **no** hay fila nueva en `derivaciones`.

## 4. Cierre

- [x] Anotar en el plan la fecha en que se importó Dante (31-10-2026).
- [ ] Merge de la rama `b5-dante-terceros` a `main` y despliegue de la app (etiqueta "a petición de").

## 5. Cuando llegue WhatsApp

Hoy Dante apunta como «chat» el id de Telegram de quien escribe: en `pacientes.telefono` de los pacientes que dio de alta él y, desde B5, en `pacientes.solicitante_chat` de las personas para las que alguien pidió cita. Con WhatsApp el chat será el número de teléfono. Al hacer el cambio:

- En Dante: `chatIdTelegram` (en `n8n/tools/_comun.js`) y las URL de `ConsultarPaciente` (en `build-workflow.mjs`) leen el id del disparador de Telegram; pasarán a leer el número del disparador de WhatsApp. El resto de la lógica de B5 no cambia.
- En los datos: los ids de Telegram guardados hay que pasarlos a teléfono. Igual que con `pacientes.telefono` de los pacientes de Dante, **también `pacientes.solicitante_chat`**; si no, quien pidió una cita para otra persona dejará de verla desde su chat.
- El consentimiento a terceros y parejas empezará a llegar solo, y una persona registrada por otra será reconocida cuando escriba ella misma.

**Decisión de Sonia (31-10-2026):** si registrar a la pareja desde Dante da problemas, las citas de pareja por Dante llevarán solo a la persona que pide la cita (se quita la oferta de registrar a la pareja del prompt; la herramienta puede quedarse como está).

## Textos fijos que dice Dante

- Esa cita la gestiona directamente tu psicólogo/a. He avisado al equipo para que te la cambien; te contactarán en breve.
- Esta cita ya se ha cambiado dos veces. He avisado al equipo para que lo revise contigo; te contactarán en breve.
- Ahora mismo no puedo gestionar esa cita. He avisado al equipo y te contactarán en breve.
- Necesito que una persona del equipo revise tu ficha. Ya les he avisado; te contactarán en breve.
- El equipo revisará la solicitud y te contactará para cerrar la cita.
- Si no consigue avisar a nadie: No he podido avisar al equipo. Llama al 91 166 50 47.
