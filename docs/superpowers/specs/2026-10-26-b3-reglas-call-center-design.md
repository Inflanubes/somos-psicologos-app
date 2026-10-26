# B3 — Reglas del call center (diseño)

Fecha: 26-10-2026. Bloque B3 del tablero (tareas 42/12, 43, 44, 45, 48, 49, 50, 51, 36). No depende de otros bloques; la regla de "citas creadas por un psicólogo" se repite en Dante en B5 (tarea 12). Decisiones con Sonia el 26-10; **[mi decisión]** = lo decidió Claude.

## Objetivos

1. **Citas creadas por un psicólogo (42):** el call center no puede cambiarlas ni anularlas; las ve en el selector deshabilitadas con "(creada por el psicólogo)" y puede **avisar a los agentes** para que la cambien (ruta 9 "Otro" de Make, con comentario). Agentes y psicólogos sin restricción. Citas antiguas sin `origen` se tratan como permitidas **[mi decisión]**.
2. **Buscador por teléfono (43):** arriba de Citas, para agentes y call center. Lista los pacientes cuyo teléfono (o el de un tutor) coincide: nombre, iniciales, psicólogos por tipo, centro, estado; debajo, su histórico de citas (fecha, hora, psicólogo, centro, estado activa / pasada / anulada). Sin comentarios ni datos clínicos. Pulsar un paciente rellena centro, psicólogo y paciente en el formulario.
3. **Operador (44):** campo de texto opcional solo para el call center, recordado en el navegador. Se guarda en `pacientes.operador` (altas) y en `acciones_psicologos.operador` vía Make (citas), y se copia al histórico. Lo ven los agentes ("Call center (Ana)" en Pacientes › Añadido por y en el histórico del buscador); el psicólogo solo ve "Call center".
4. **Consentimiento (45):** la etiqueta "Consentimiento firmado / pendiente" no se muestra al call center.
5. **Psicólogo no asignado en el alta (48):** cuando el teléfono ya existe con otro psicólogo, el call center no puede vincular: botón "Solicitar cambio de psicólogo" que envía `Cambio solicitado` (ruta 8, aviso a Marta) con el psicólogo deseado en el comentario. Para agentes, el botón pasa a llamarse "Sí, asignar a este psicólogo". "No, es otra persona" y "Cancelar" se mantienen para todos.
6. **Dos citas el mismo día (49):** para todos los roles, al agendar (o cambiar) una cita de un paciente que ya tiene otra cita activa ese día, o justo la hora anterior o posterior, aviso de confirmación: "Este paciente ya tiene cita el {día} a las {hora} con {psicólogo}. ¿Quieres modificarla o es otra cita (por ejemplo, de pareja)?" con "Ir a cambiarla" y "Sí, es otra cita".
7. **Acciones de solicitud (50, 51):** cuatro acciones nuevas para call center **y agentes**, con paciente y comentario, enviadas a Make con el texto exacto que espera: `Otro`, `Sin disponibilidad`, `hablar con psicologo`, `Cambio solicitado`. Etiquetas en pantalla: "Otros (aviso al equipo)", "Sin cita disponible", "Pendiente de psicólogo", "Cambio de psicólogo". Se activan desde una lista de configuración: hoy solo `Otro`; las otras tres se encienden cuando Jaime conteste (tarea 51).
8. **Comunicaciones (36):** sin código. Las pestañas se llenan solas cuando se activen las acciones de 7 (estados `Sin disponibilidad`, `Psicólogo`, `Cambio solicitado`).

## No objetivos

- Cambiar las rutas de Make (ya están listas desde el 22-10, `docs/make-cambios-2026-10-22.md` en la raíz). Solo se añade el mapeo de `operador` (apartado Make).
- Dante (tarea 12): B5.

## Modelo de datos (migración `017_operador.sql`)

```
pacientes            + operador text
acciones_psicologos  + operador text
acciones_historial   + operador text
trigger de historial (función de la migración 011): copia `operador`
```

Idempotente; se aplica de madrugada o con Dante y Make parados (regla general). Make tiene que mapear `datosProcesados.operador` → columna `operador` en los módulos que insertan o actualizan `acciones_psicologos` (rutas 1, 3, 4). Hasta que lo haga, las citas llegan sin operador (no rompe nada).

## Módulo puro `lib/call-center.ts`

- `puedeGestionarCita(rol, origenCita: string | null): boolean` — `call_center` → `origenCita !== 'psicologo'`; otros → `true`.
- `ACCIONES_SOLICITUD`, `ACCIONES_SOLICITUD_ACTIVAS` (configuración), `ETIQUETA_SOLICITUD`.
- `normalizarTelefono(s): string` (solo dígitos; para buscar se usan los últimos 9).
- `citasMismoDia(citas: { fecha; hora; psicologoNombre; id }[], fecha, hora): { cita; seguida: boolean }[]` — misma fecha; `seguida` si la diferencia es exactamente 60 min.
- `estadoCitaHistorico(c: { activo; fecha_cita }, hoy): 'activa' | 'pasada' | 'anulada'` — `!activo` → anulada; `fecha < hoy` → pasada; si no, activa.
- `etiquetaOrigen(origen, operador, rolQueMira): string` — `call_center` → "Call center" + ` (${operador})` solo si `rolQueMira === 'agente'` y hay operador; `dante` → "Dante"; `psicologo` → "Psicólogo"; `agente` → "Agente"; null → "".
- `comentarioAvisoCita(cita, texto)` → `Solicita cambiar o anular la cita del {fecha} a las {hora} con {psicólogo} (creada por el psicólogo): {texto}`.
- `comentarioCambioPsicologo(nombrePsicologoDeseado, operador)` → `Pide pasar a {psicólogo}.` + ` Operador: {operador}.` si hay.

## Pantalla Citas

- Operador: campo `Operador` encima del formulario (solo call center), guardado en `localStorage` (`operador:{userId}`); viaja en `datosProcesados.operador` en todas las acciones y en el insert de `pacientes`.
- Selector de citas (Cambiar / Cancelar): `fetchCitasActivas` devuelve también `origen`; opción deshabilitada si `!puedeGestionarCita`. Si hay alguna deshabilitada y el rol es call center: texto "Esta cita la creó el psicólogo: solo él o un agente pueden cambiarla o anularla." y botón "Avisar a los agentes" que abre un campo de texto y envía `Otro` con `comentarioAvisoCita`.
- Acciones de solicitud: en el desplegable de acción para call center y agentes (las activas); piden paciente y comentario (obligatorio para `Otro`); payload `{ accion, paciente_id, paciente_iniciales, centro_id, psicologo_id, comentario, operador, created_by, created_by_id, origen }`, sin fecha ni hora. Registro en `formulario_citas_psicologos` como el resto.
- Alta con teléfono existente: call center → "Solicitar cambio de psicólogo" (envía `Cambio solicitado` con `paciente_id` = el existente, `centro_id` = el del formulario, `comentario` = `comentarioCambioPsicologo`), "No, es otra persona", "Cancelar". Agentes → "Sí, asignar a este psicólogo", "No, es otra persona", "Cancelar".
- Aviso mismo día: antes de enviar Agendar o Cambiar, consulta `acciones_psicologos` activas del paciente (cualquier psicólogo) en la fecha elegida (y para Cambiar, excluyendo la propia); si `citasMismoDia` devuelve algo, caja de confirmación. "Ir a cambiarla" → acción Cambiar cita con esa cita seleccionada (y su psicólogo y centro). "Sí, es otra cita" → continúa el envío.
- Consentimiento: `!esCallCenter`.

## Buscador (`app/dashboard/psicologos/BuscadorTelefono.tsx`)

- Campo "Buscar por teléfono" con retardo de 300 ms; busca en `pacientes.telefono` y en `asociados_menores."T1_teléfono"` / `"T2_teléfono"` (`ilike %últimos 9 dígitos%`).
- Por paciente: nombre, iniciales, centro, estado, psicólogos (adultos / pareja / infantil), "Añadido por" con `etiquetaOrigen`. Botón "Usar en el formulario" → `onSeleccionar({ centroId, psicologoId, pacienteId })` (centro: el de la última cita activa o el de la ficha; psicólogo: el de la última cita activa o el primero no vacío de la ficha).
- Histórico: `acciones_psicologos` del paciente con `accion = 'Agendar cita'` (activas o no), orden descendente, 20 últimas: fecha, hora, psicólogo, centro, estado (`estadoCitaHistorico`), quién (`etiquetaOrigen`).

## Textos de interfaz

`Operador` · `Buscar por teléfono` · `Usar en el formulario` · `(creada por el psicólogo)` · `Esta cita la creó el psicólogo: solo él o un agente pueden cambiarla o anularla.` · `Avisar a los agentes` · `Solicitar cambio de psicólogo` · `Sí, asignar a este psicólogo` · `Este paciente ya tiene cita el {día} a las {hora} con {psicólogo}. ¿Quieres modificarla o es otra cita (por ejemplo, de pareja)?` · `Ir a cambiarla` · `Sí, es otra cita` · `Otros (aviso al equipo)` · `Sin cita disponible` · `Pendiente de psicólogo` · `Cambio de psicólogo` · `Comentario para el equipo`.

## Comprobación de aceptación

1. Call center: una cita creada por el psicólogo sale deshabilitada; "Avisar a los agentes" manda un Telegram con el comentario. Un agente sí puede cambiarla.
2. Buscador: teléfono de un tutor encuentra al menor; "Usar en el formulario" deja centro, psicólogo y paciente puestos.
3. Operador "Ana": el alta queda con `operador = Ana`; Pacientes muestra "Call center (Ana)" al agente y "Call center" al psicólogo.
4. Alta con teléfono de otro psicólogo: call center ve "Solicitar cambio de psicólogo" y Marta recibe el aviso; el agente ve "Sí, asignar a este psicólogo".
5. Paciente con cita el martes a las 10: agendar otra el martes a las 11 muestra el aviso; "Ir a cambiarla" abre Cambiar cita con esa cita.
6. Call center y agente ven "Otros (aviso al equipo)"; las otras tres no aparecen hasta activarlas en `ACCIONES_SOLICITUD_ACTIVAS`.
7. El call center no ve la etiqueta de consentimiento.
