# B4 — Consentimiento informado (diseño)

Fecha: 26-10-2026. Bloque B4 del tablero (tareas 38, 39, 40, 41, 57). No depende de otros bloques. B5 (tarea 6) reutiliza la acción de reenvío desde Dante. Decisiones con Sonia el 26-10; **[mi decisión]** = lo decidió Claude.

## Cómo funciona hoy (verificado en los blueprints el 26-10)

- Al dar de alta un paciente, Make (ruta 14 "Añadir nuevo paciente", módulos 232/250/251/254) manda el enlace del consentimiento por **Telegram** al `telefono` del paciente (adulto: `/consentimiento/`) o de cada tutor (`/consentimiento-menores/`). Solo llega si ese "teléfono" es un chat de Dante: a los pacientes dados de alta desde la app no les llega nada.
- La firma la procesa el escenario "Cto general" leyendo el email de WPForms: adulto → `pacientes` por `nombre ilike` + `telefono =` → `consentimiento = true` y `DNI`; menor → `asociados_menores` por `T1_teléfono` / `T2_teléfono` → `T1_consentimiento` / `T2_consentimiento`, y cuando los dos están firmados, `pacientes.consentimiento = true` del menor.
- Teléfono repetido menor/tutor: ya está permitido (`evaluarDuplicado` ignora menores al buscar adultos por teléfono y busca menores por nombre + fecha). Tarea 41: solo falta cubrirlo con tests.
- Canal: ahora todo por Telegram; cuando Meta apruebe la cuenta, Make pasará los envíos a WhatsApp. **La app no cambia por eso**: solo manda webhooks.

## Objetivos

1. **Reenviar consentimiento (38):** botón en Pacientes (psicólogos y agentes, por fila) y en Comunicaciones (agentes). Nunca para el call center. Envía al webhook de Citas la acción `Reenviar consentimiento` con los datos del paciente (y de los tutores si es menor); Make manda el enlace que toque por el canal activo. Sonia crea la ruta en Make (apartado Make).
2. **Marcar firmado a mano (39):** botón "Consentimiento firmado" (psicólogos y agentes) que pone `consentimiento = true` y guarda quién, cuándo y que fue manual. En menores marca también a los dos tutores. Los agentes pueden desmarcar, con confirmación.
3. **Parejas (40, segunda persona opcional hasta que Jaime conteste):** en el alta de pareja, campos opcionales "Segunda persona: nombre y teléfono". Al guardar, si ya existe un paciente con ese teléfono y nombre se le vincula como paciente de pareja del mismo psicólogo **sin decirlo en pantalla** (intimidad); si no existe, se crea una ficha mínima (nombre, teléfono, tipo pareja, mismo psicólogo y centro) y se le pide el consentimiento. Las dos fichas se enlazan con `pareja_de`.
4. **Menores (41):** tests que fijan que el mismo teléfono entre menor y tutor no es duplicado, y que un tutor que ya es paciente adulto conserva su consentimiento propio.
5. **Arranque (57):** las fichas migradas salen con consentimiento pendiente; procedimiento escrito para el día de la entrega (va a B10).

## No objetivos

- Elegir el canal (Telegram / WhatsApp) ni las plantillas de Meta: es de Make.
- Cambiar el formulario de WPForms ni el escenario "Cto general".
- Una "ficha de paciente" nueva para el psicólogo: los botones van en la tabla.

## Modelo de datos (migración `018_consentimiento_manual.sql`)

```
pacientes
  + consentimiento_origen      text      -- 'formulario' | 'manual' | null
  + consentimiento_marcado_por text      -- nombre de quien lo marcó a mano
  + consentimiento_marcado_en  timestamptz
  + pareja_de                  uuid REFERENCES pacientes(id)   -- la otra persona de la pareja
```

`consentimiento_origen` lo pone la app ('manual') al marcar; Make no lo toca (queda null = formulario). Idempotente, de madrugada.

## Módulo puro `lib/consentimiento.ts`

- `enlaceConsentimiento(esMenor: boolean): string` → `https://www.somospsicologos.es/consentimiento/` | `…/consentimiento-menores/`.
- `destinatariosReenvio(p: { nombre; telefono; es_menor }, tutores: { T1_nombre_completo; T1_teléfono; T2_nombre_completo; T2_teléfono } | null): { nombre: string; telefono: string }[]` — adulto: él mismo; menor: tutores con teléfono (1 o 2).
- `payloadReenvio(p, tutores, actor): datosProcesados` con `accion: 'Reenviar consentimiento'`, `paciente_id`, `paciente_nombre`, `telefono`, `es_menor`, `enlace`, `tutor1_nombre`, `tutor1_telefono`, `tutor2_nombre`, `tutor2_telefono`, atribución.
- `marcarFirmado(actor): Partial<PacienteInsert>` → `{ consentimiento: true, consentimiento_origen: 'manual', consentimiento_marcado_por, consentimiento_marcado_en }`; `desmarcar()` → `{ consentimiento: false, consentimiento_origen: null, …null }`.
- `textoEstadoConsentimiento(p): string` → `Firmado` / `Firmado a mano por {nombre} el {dd/mm/aaaa}` / `Pendiente`.
- Tarea 41: tests sobre `evaluarDuplicado` (ya existe) con menor y tutor con el mismo teléfono.

## Pantallas

- **Pacientes** (`PacientesClient`, agentes y psicólogos): en la columna Consentimiento, el estado con `textoEstadoConsentimiento` y dos botones pequeños: `Reenviar` y `Marcar firmado` (o `Desmarcar` si está firmado y el rol es agente). Confirmaciones: "¿Enviar de nuevo el consentimiento a {nombre}?" y "¿Marcar el consentimiento de {nombre} como firmado?" / "¿Quitar la marca de firmado de {nombre}?".
- **Comunicaciones** (agentes): mismo botón `Reenviar consentimiento` en cada paciente de las pestañas.
- **Call center**: no ve nada de consentimiento (B3 ya quita la etiqueta de Citas).
- **Alta de pareja** (Citas, acción Añadir nuevo paciente con tipo pareja): bloque "Segunda persona (opcional)" con nombre y teléfono. Lógica al guardar: `candidatosDuplicado` por el teléfono de la segunda persona; si hay un adulto con mismo teléfono y mismo nombre (`normalizarNombre`), se actualiza `psicologo_pareja_id` y `pareja_de`; si no, insert mínimo + `pareja_de` en ambas direcciones + alta a Make (`Añadir nuevo paciente`, que manda el consentimiento). En pantalla solo: "Pareja registrada." **Nunca** "ya era paciente". *(Cambiado el 30-10-2026, ver "Decisiones de Sonia del 30-10-2026" al final.)*

## Make (apartado para Sonia)

Nueva ruta en "Formulario Citas Psicologos": `accion = Reenviar consentimiento` → mensaje con `datosProcesados.enlace` a `telefono` (adulto) o a `tutor1_telefono` / `tutor2_telefono` (menor), por Telegram ahora y por WhatsApp cuando esté aprobado. Texto sugerido: el mismo de los módulos 250/251/254.

## Textos de interfaz

`Reenviar` · `Marcar firmado` · `Desmarcar` · `Reenviar consentimiento` · `Firmado` · `Firmado a mano por {nombre} el {fecha}` · `Pendiente` · `Segunda persona (opcional)` · `Pareja registrada.` · `Consentimiento reenviado.` · confirmaciones de arriba.

## Comprobación de aceptación

1. Psicólogo: "Reenviar" en un adulto → Make recibe la acción y manda el enlace de adulto; en un menor, a los dos tutores.
2. "Marcar firmado" en un menor: `consentimiento`, `T1_consentimiento` y `T2_consentimiento` a true; Pacientes muestra "Firmado a mano por X el …". Agente puede desmarcar; psicólogo no ve "Desmarcar".
3. Alta de pareja con segunda persona que ya es paciente: queda vinculada, la pantalla no lo revela, no se crea ficha nueva. Con segunda persona nueva: ficha creada y consentimiento enviado.
4. Alta de un adulto con el teléfono de un menor existente (su hijo): no se bloquea (tests).
5. Call center no ve botones ni estado de consentimiento en ninguna pantalla.

## Decisiones de Sonia del 30-10-2026 (tras la primera ejecución)

1. **Reenviar y la firma existente:** Make marca `consentimiento = true` al recibir el formulario, así que antes de reenviar hay que ver si ya está firmado. El estado se muestra siempre junto al botón (también en Comunicaciones) y, si consta firmado, la confirmación avisa: "El consentimiento de {nombre} ya está firmado. ¿Enviarlo de nuevo igualmente?".
2. **Privacidad de la segunda persona:** agentes, psicólogos y call center tienen acceso a Pacientes y saben quién es paciente; la pantalla **sí** puede decir que la segunda persona ya era paciente. Lo que nunca lo revela es Dante ni el mensaje de confirmación que recibe quien pide la cita. Mensajes: "Pareja registrada: la segunda persona ya era paciente y se ha vinculado a este psicólogo (no se le reenvía el consentimiento)." / "Pareja registrada: se ha creado la ficha de la segunda persona y se le ha enviado el consentimiento." Si ya es paciente de pareja de otro psicólogo, no se pisa y la app dice de quién es.
3. **Desmarcar en un menor** pregunta de qué progenitor se quita la firma ("¿De qué tutor quitas la firma?": tutor 1, tutor 2 o "Los dos"). Al quitar cualquiera, `pacientes.consentimiento` pasa a false (hacen falta las dos).
4. **Segunda persona que ya era paciente:** no se le manda consentimiento. El consentimiento es por persona, no por psicólogo.
