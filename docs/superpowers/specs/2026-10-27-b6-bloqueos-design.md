# B6 — Bloqueos: menú simplificado y "Baja médica" (diseño)

Fecha: 27-10-2026. Bloque B6 del tablero (tareas 34, 35). No depende de otros bloques; B3 añade acciones de solicitud al mismo desplegable (revisar al empezar: integrarlas en `accionesMenu`). Decisiones con Sonia el 27-10; **[mi decisión]** = lo decidió Claude.

## Cómo funciona hoy (verificado el 27-10)

- El desplegable "¿Qué necesitas hoy?" de Citas tiene 10 acciones planas (`ACCIONES` en `app/dashboard/psicologos/page.tsx`). Un psicólogo sin `puede_bloquear` no ve "Bloquear agenda" ni "Desbloquear agenda", pero **sí** ve Vacaciones, Asuntos propios, Baja laboral y Modificar bloqueo personal (a propósito, migración 007). Eso es lo que vio Jaime.
- "Baja laboral" es un valor literal en: la app (tipo `AccionPsicologo`, `LABEL_MAP`, `MotivoBloqueo`, `MOTIVOS_MODIFICABLES`, estadísticas), Make (ruta propia con filtro `accion = Baja laboral` y `motivo_bloqueo: "Baja laboral"` literal en el upsert, más textos de Telegram), la base (`acciones_psicologos.accion` / `motivo_bloqueo`, `acciones_historial`, `formulario_citas_psicologos.accion`; `accion` y `motivo_bloqueo` se castean a `::text` en las migraciones, así que probablemente son enum) y el manual. Dante no bloquea agendas: no le afecta.

## Objetivos

1. **Menú (34).** El desplegable queda en cinco opciones: `Agendar cita`, `Añadir nuevo paciente`, `Cambiar cita`, `Cancelar cita`, `Bloquear / Desbloquear agenda`. Al elegir la última aparece un segundo desplegable `Tipo de bloqueo` con: `Vacaciones`, `Asuntos propios`, `Baja médica`, `Modificar un bloqueo`, y solo para agentes o psicólogos con `puede_bloquear`: `Bloqueo general`, `Desbloquear`. Lo que viaja a Make y se guarda no cambia de nombre (salvo Baja médica): cada tipo se traduce a la acción de siempre (`Vacaciones`, `Asuntos propios`, `Baja médica`, `Modificar bloqueo personal`, `Bloquear agenda`, `Desbloquear agenda`).
2. **Psicólogo sin permiso (34, decisión de Sonia):** no ve `Bloquear / Desbloquear agenda` en absoluto (ni vacaciones ni asuntos propios). Sus bloqueos los pone un agente. El call center sigue sin bloqueos.
3. **Baja médica (35, opción A):** se renombra en todas partes la misma madrugada: migración 020 (valores del enum si lo hay, y filas antiguas), Make (apartado), app, estadísticas y manual.

## No objetivos

- Cambiar el flujo de cada bloqueo (fechas, selector de evento, Make): solo cambia cómo se llega a él.
- Dante.

## Modelo de datos (migración `020_baja_medica.sql`)

Bloque `DO $$` idempotente:
1. Para cada tipo enum que tenga la etiqueta `'Baja laboral'` (consulta a `pg_enum` + `pg_type`): `ALTER TYPE … RENAME VALUE 'Baja laboral' TO 'Baja médica'` (requiere ejecutarlo fuera de una transacción con otras sentencias que usen el enum; el script lo documenta).
2. Si las columnas son texto: `UPDATE acciones_psicologos SET accion = 'Baja médica' WHERE accion::text = 'Baja laboral'` y lo mismo para `motivo_bloqueo`, `acciones_historial.accion` / `motivo_bloqueo` y `formulario_citas_psicologos.accion`. Con enum, el `RENAME VALUE` ya cambia las filas.
3. `SELECT` final de comprobación: cero filas con `'Baja laboral'` en las cinco columnas.

## Módulo puro `lib/acciones-menu.ts`

- `ACCION_BLOQUEOS = 'Bloquear / Desbloquear agenda'`.
- `TIPOS_BLOQUEO: { etiqueta: string; accion: AccionPsicologo; requierePermiso: boolean }[]` en el orden del objetivo 1 (`Bloqueo general` y `Desbloquear` con `requierePermiso: true`).
- `tiposBloqueoDisponibles(rol: Rol, puedeBloquear: boolean)` → agente: todos; psicólogo con permiso: todos; psicólogo sin permiso: `[]`; call center: `[]`.
- `accionesMenu(rol: Rol, opts: { puedeBloquear: boolean; psicologoInactivo: boolean })` → lista de opciones del primer desplegable: las cuatro de citas/alta (con la regla actual de `Añadir nuevo paciente` para psicólogo inactivo), más `ACCION_BLOQUEOS` solo si `tiposBloqueoDisponibles` no está vacío. Las acciones de solicitud de B3 (`ACCIONES_SOLICITUD_ACTIVAS`) se añaden aquí cuando B3 esté hecho.
- `accionReal(menu: string, tipoBloqueo: string): AccionPsicologo | ''` → la acción que se envía.
- `AccionPsicologo` y `MotivoBloqueo` pasan a decir `'Baja médica'`; `LABEL_MAP['Baja médica'] = 'Confirmar baja médica'`.

## Pantalla Citas

- Estado nuevo `accionMenu` y `tipoBloqueo`; `accion` (la de siempre, usada por todo el formulario y el envío) se calcula con `accionReal`. Al cambiar `accionMenu` se vacía `tipoBloqueo`. El segundo desplegable aparece debajo del primero, con la etiqueta `Tipo de bloqueo` y el texto vacío `Selecciona el tipo`.
- La comprobación de permiso de `handleSubmit` (`No tienes permiso para usar el bloqueo general…`) se mantiene como red de seguridad.
- Estadísticas (`stats/page.tsx`, `MotivosChart`, `StatsDashboard`): clave interna `baja_laboral` → `baja_medica`, etiquetas `Baja médica`.
- `lib/eventos-activos.ts`: `MOTIVOS_MODIFICABLES = ['Vacaciones', 'Asuntos propios', 'Baja médica']`.

## Make (apartado para Sonia, la misma madrugada que la migración)

En "Formulario Citas Psicologos": en la ruta de Baja laboral, cambiar el filtro (`accion` = `Baja médica`), el literal `motivo_bloqueo` = `Baja médica` en el módulo que escribe en `acciones_psicologos`, y los textos de los Telegram que digan "Baja laboral". Si algún módulo de Supabase lista los valores del enum en un desplegable, volver a elegir el valor tras aplicar la migración.

## Textos de interfaz

`Bloquear / Desbloquear agenda` · `Tipo de bloqueo` · `Selecciona el tipo` · `Vacaciones` · `Asuntos propios` · `Baja médica` · `Modificar un bloqueo` · `Bloqueo general` · `Desbloquear` · `Confirmar baja médica`.

## Comprobación de aceptación

1. Agente: el desplegable tiene cinco opciones; al elegir bloqueos salen los seis tipos; "Baja médica" + fechas llega a Make como `accion = Baja médica` y se guarda con `motivo_bloqueo = Baja médica`.
2. Psicólogo con permiso: seis tipos. Psicólogo sin permiso: no ve `Bloquear / Desbloquear agenda`. Call center: tampoco.
3. Estadísticas: los bloqueos antiguos de baja laboral se cuentan como "Baja médica" (migración aplicada).
4. Calendario y selector "Modificar un bloqueo" siguen listando las bajas antiguas.
