# B3 — Reglas del call center — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Estado 30-10-2026:** Tareas 1–7 hechas en la rama `b3-reglas-call-center` (7 commits sobre `main` e34d643). Queda la Tarea 8 (cierre).
>
> **Revisar al empezar:** escrito el 26-10-2026 contra `main`. Si B1 o B2 ya están fusionados, `app/dashboard/psicologos/page.tsx` habrá cambiado de líneas: buscar por los nombres de función y constante que se citan, no por número de línea.

**Goal:** El call center trabaja con reglas propias (no toca citas de psicólogos, busca por teléfono, deja su operador, pide cambios de psicólogo en vez de vincular, avisa de citas repetidas) y dispone de las acciones de solicitud hacia el equipo, que los agentes también tienen.

**Architecture:** Reglas en `lib/call-center.ts` (puro, con tests). La pantalla Citas las aplica; un componente nuevo `BuscadorTelefono` consulta Supabase y rellena el formulario. Migración 017 añade `operador`. Make no cambia salvo el mapeo de `operador` (apartado para Sonia).

**Tech Stack:** Next.js App Router + TypeScript, Supabase JS v2, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-b3-reglas-call-center-design.md`. Rutas de Make: `Z:\Claude\Somos Psicológos\docs\make-cambios-2026-10-22.md`.

## Global Constraints

- Rama `b3-reglas-call-center` desde `main`. Commits en español. Cada tarea: tsc limpio y `npm test` verde.
- Textos de acción hacia Make **exactos**: `Otro`, `Sin disponibilidad`, `hablar con psicologo` (sin tilde), `Cambio solicitado`. Etiquetas de pantalla solo en la UI.
- Textos de interfaz exactos: los de la sección "Textos de interfaz" de la especificación.
- `Supabase/migrations/` está fuera del repo git (anotar en el tablero al cerrar).
- Nada en Supabase de producción ni Make sin autorización de Sonia en ese chat.

## Review Focus

1. **Cita con `origen` nulo** (anterior a la migración 004) elegida por el call center: se puede cambiar (Tarea 1 test, Tarea 3).
2. **Teléfono con espacios, prefijo +34 o guiones** en el buscador: encuentra al paciente guardado sin formato (Tarea 1 `normalizarTelefono`, Tarea 4).
3. **Cambiar cita al mismo día que ya tiene otra cita distinta**: el aviso debe salir, pero la propia cita que se está cambiando no debe contarse (Tarea 1 test con `excluirId`, Tarea 6).
4. **Operador vacío**: ninguna acción se bloquea, `pacientes.operador` queda null y Pacientes muestra "Call center" a secas (Tarea 2).
5. **Acción de solicitud sin paciente seleccionado**: el envío se bloquea con "Debes seleccionar un paciente para esta acción." (Tarea 7).

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `Supabase/migrations/017_operador.sql` | `operador` en pacientes, acciones_psicologos, acciones_historial; trigger | Crear (fuera del repo) |
| `types/database.ts` | `operador` en `Paciente`, `PacienteInsert`, `AccionPsicologo`, `AccionHistorial`; `EventoActivo.origen` | Modificar |
| `lib/call-center.ts` (+ `.test.ts`) | Reglas puras | Crear |
| `lib/eventos-activos.ts` | `fetchCitasActivas` devuelve `origen` | Modificar |
| `app/dashboard/psicologos/BuscadorTelefono.tsx` | Buscador por teléfono con histórico | Crear |
| `app/dashboard/psicologos/page.tsx` | Operador, selector con citas protegidas, aviso a agentes, acciones de solicitud, alta con cambio de psicólogo, aviso mismo día, consentimiento, buscador | Modificar |
| `app/dashboard/pacientes/page.tsx`, `PacientesClient.tsx` | "Añadido por" con operador | Modificar |
| `docs/roles-y-permisos.md`, `docs/manual-somos/index.html` | Documentación | Modificar |
| `docs/make-cambios-2026-10-b3.md` | Mapeo de `operador` para Sonia | Crear |

---

### Task 1: Migración 017, tipos y módulo puro `lib/call-center.ts`

**Files:**
- Create: `Supabase/migrations/017_operador.sql`, `lib/call-center.ts`, `lib/call-center.test.ts`
- Modify: `types/database.ts`, `lib/eventos-activos.ts:15-25,102-135`

**Interfaces:**
- SQL: `ALTER TABLE … ADD COLUMN IF NOT EXISTS operador text` en `pacientes`, `acciones_psicologos`, `acciones_historial`; `CREATE OR REPLACE FUNCTION` del trigger de la migración 011 con `operador` añadido en la lista de columnas del `INSERT INTO acciones_historial` (copiar la función entera de 011 y añadir la columna; comentario arriba explicando que sustituye a la de 011).
- TS: `Paciente.operador: string | null`, `PacienteInsert.operador?: string | null`, `AccionPsicologo.operador: string | null`, `AccionHistorial.operador: string | null`; `EventoActivo.origen: string | null`; `fetchCitasActivas` selecciona `origen`.
- `lib/call-center.ts` exporta exactamente lo listado en la especificación ("Módulo puro"), con estas firmas:
  - `type Rol = 'agente' | 'psicologo' | 'call_center'`
  - `puedeGestionarCita(rol: Rol, origenCita: string | null): boolean`
  - `ACCIONES_SOLICITUD = ['Otro', 'Sin disponibilidad', 'hablar con psicologo', 'Cambio solicitado'] as const`; `type AccionSolicitud = typeof ACCIONES_SOLICITUD[number]`; `ACCIONES_SOLICITUD_ACTIVAS: readonly AccionSolicitud[] = ['Otro']` (comentario: "añadir aquí las que apruebe Jaime, tarea 51"); `ETIQUETA_SOLICITUD: Record<AccionSolicitud, string>`; `esAccionSolicitud(a: string): a is AccionSolicitud`.
  - `normalizarTelefono(s: string): string`; `sufijoBusquedaTelefono(s: string): string` (últimos 9 dígitos, o todos si hay menos).
  - `citasMismoDia(citas: CitaDia[], fecha: string, hora: string, excluirId?: string): { cita: CitaDia; seguida: boolean }[]` con `CitaDia = { id: string; fecha: string; hora: string; psicologoNombre: string; psicologoId: string; centroId: string | null }`.
  - `estadoCitaHistorico(c: { activo: boolean; fecha_cita: string | null }, hoy: string): 'activa' | 'pasada' | 'anulada'`.
  - `etiquetaOrigen(origen: string | null, operador: string | null, rolQueMira: Rol): string`.
  - `comentarioAvisoCita(c: { fecha: string; hora: string; psicologoNombre: string }, texto: string): string`; `comentarioCambioPsicologo(nombrePsicologo: string, operador: string | null): string`; `textoAvisoMismoDia(c: CitaDia): string` (con el día en formato `lunes 27/10` **[decisión del plan]**).

- [x] **Step 1: Tests**

```ts
it('call center no gestiona citas de psicólogo; origen nulo sí', () => {
  expect(puedeGestionarCita('call_center', 'psicologo')).toBe(false)
  expect(puedeGestionarCita('call_center', null)).toBe(true)
  expect(puedeGestionarCita('call_center', 'dante')).toBe(true)
  expect(puedeGestionarCita('agente', 'psicologo')).toBe(true)
})
it('normalizarTelefono y sufijo', () => {
  expect(normalizarTelefono('+34 600-11 22 33')).toBe('34600112233')
  expect(sufijoBusquedaTelefono('+34 600-11 22 33')).toBe('600112233')
  expect(sufijoBusquedaTelefono('6001')).toBe('6001')
})
it('citasMismoDia: misma fecha, seguida a ±60 min, excluye la propia', () => {
  const c = (id: string, hora: string) => ({ id, fecha: '2026-10-27', hora, psicologoNombre: 'Jaime', psicologoId: 'j', centroId: null })
  const r = citasMismoDia([c('a', '10:00:00'), c('b', '13:00')], '2026-10-27', '11:00')
  expect(r.map((x) => [x.cita.id, x.seguida])).toEqual([['a', true], ['b', false]])
  expect(citasMismoDia([c('a', '10:00')], '2026-10-27', '11:00', 'a')).toEqual([])
  expect(citasMismoDia([c('a', '10:00')], '2026-10-28', '11:00')).toEqual([])
})
it('estadoCitaHistorico', () => {
  expect(estadoCitaHistorico({ activo: false, fecha_cita: '2026-12-01' }, '2026-10-26')).toBe('anulada')
  expect(estadoCitaHistorico({ activo: true, fecha_cita: '2026-10-01' }, '2026-10-26')).toBe('pasada')
  expect(estadoCitaHistorico({ activo: true, fecha_cita: '2026-10-26' }, '2026-10-26')).toBe('activa')
})
it('etiquetaOrigen muestra el operador solo al agente', () => {
  expect(etiquetaOrigen('call_center', 'Ana', 'agente')).toBe('Call center (Ana)')
  expect(etiquetaOrigen('call_center', 'Ana', 'psicologo')).toBe('Call center')
  expect(etiquetaOrigen('call_center', null, 'agente')).toBe('Call center')
  expect(etiquetaOrigen(null, null, 'agente')).toBe('')
})
it('comentarios', () => {
  expect(comentarioAvisoCita({ fecha: '2026-10-27', hora: '10:00', psicologoNombre: 'Jaime' }, 'el paciente no puede'))
    .toBe('Solicita cambiar o anular la cita del 27/10/2026 a las 10:00 con Jaime (creada por el psicólogo): el paciente no puede')
  expect(comentarioCambioPsicologo('Marta', 'Ana')).toBe('Pide pasar a Marta. Operador: Ana.')
  expect(comentarioCambioPsicologo('Marta', null)).toBe('Pide pasar a Marta.')
})
```

- [x] **Step 2: Ejecutar y ver fallar** — `npx vitest run lib/call-center.test.ts`.
- [x] **Step 3: Implementar** módulo, migración, tipos y `fetchCitasActivas`.
- [x] **Step 4: Ejecutar** — PASS; tsc limpio.
- [x] **Step 5: Commit** — `git add lib/call-center.ts lib/call-center.test.ts types/database.ts lib/eventos-activos.ts && git commit -m "Call center: reglas puras, operador en tipos y origen en citas activas"`

---

### Task 2: Operador

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (estado y campo; `crearPaciente`; `datosProcesados` en `handleSubmit`), `app/dashboard/pacientes/page.tsx:55-66`, `app/dashboard/pacientes/PacientesClient.tsx:330-345`
- Create: `docs/make-cambios-2026-10-b3.md`

**Interfaces:**
- `page.tsx`: `const [operador, setOperador] = useState('')`, cargado de `localStorage['operador:' + userId]` al conocer `userId` y guardado en cada cambio (`try/catch`). Campo `Operador` (placeholder "Tu nombre") en una tarjeta encima del formulario, solo `esCallCenter`. `datosProcesados.operador: esCallCenter ? operador.trim() || null : null` en todos los envíos (citas, bloqueos, solicitudes); `pacientes.insert({ …, operador: … })`.
- Pacientes: `page.tsx` añade `operador: p.operador ?? null` y pasa `rol`; `PacientesClient` muestra `etiquetaOrigen(p.origen, p.operador, rol)` en lugar de la lógica actual de `p.origen`.
- `docs/make-cambios-2026-10-b3.md`: módulos de las rutas 1, 3 y 4 que insertan/actualizan `acciones_psicologos`: añadir el campo `operador` = `{{1.datosProcesados.operador}}`. Opcional: añadir "Operador: …" a los Telegram del call center.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; `npm test`; en dev con usuario call center, el campo se recuerda tras recargar; alta de paciente → `operador` en la fila.
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git commit -am "Call center: campo Operador guardado en altas y enviado a Make"`

---

### Task 3: Citas creadas por un psicólogo y aviso a los agentes

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (selector de citas `citasActivas.map`, `handleSubmit`, nuevo bloque bajo el selector)

**Interfaces:**
- Opción del selector: `disabled={!puedeGestionarCita(rol, e.origen)}`, etiqueta `{label} (creada por el psicólogo)` cuando está deshabilitada (todos los roles ven el sufijo, solo el call center la tiene deshabilitada **[decisión del plan]**).
- Bajo el selector, si `esCallCenter` y alguna cita está deshabilitada: el texto fijo de la especificación y el botón `Avisar a los agentes`, que despliega un `<select>` con esas citas, un textarea `Comentario para el equipo` y "Enviar aviso". Envío: misma función de webhook (`/api/webhook/psicologos`) con `accion: 'Otro'`, `paciente_id`, `paciente_iniciales`, `centro_id`, `psicologo_id`, `comentario: comentarioAvisoCita(...)`, `operador`, `created_by`, `created_by_id`, `origen`; registro en `formulario_citas_psicologos`; mensaje de éxito "Aviso enviado al equipo."
- `handleSubmit`: si `requiereSelectorCita` y la cita elegida no es gestionable → error con el texto fijo (defensa aunque la opción esté deshabilitada).

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; `npm test`; dev: cita creada por un psicólogo (hacerla con un usuario psicólogo) → call center la ve deshabilitada y el aviso llega por Telegram (Make ruta 9).
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git commit -am "Call center: no cambia citas creadas por el psicólogo y puede avisar a los agentes"`

---

### Task 4: Buscador por teléfono

**Files:**
- Create: `app/dashboard/psicologos/BuscadorTelefono.tsx`
- Modify: `app/dashboard/psicologos/page.tsx` (montar encima del formulario para `!esPsicologo`; `onSeleccionar`)

**Interfaces:**
- Props: `{ rol: Rol; centros: Centro[]; psicologos: Psicologo[]; onSeleccionar: (s: { centroId: string; psicologoId: string; pacienteId: string }) => void }`.
- Consultas (en el componente, con `supabase` del navegador): `pacientes.select('id, nombre, iniciales, telefono, centro_id, estado, es_menor, origen, operador, psicologo_adultos_id, psicologo_pareja_id, psicologo_infantil_id').ilike('telefono', `%${sufijo}%`).limit(10)`; `asociados_menores.select('id_menor').or(`"T1_teléfono".ilike.%${sufijo}%,"T2_teléfono".ilike.%${sufijo}%`)` → ids de menores añadidos con una segunda consulta `in('id', ids)`. Histórico por paciente al desplegarlo: `acciones_psicologos.select('id, fecha_cita, hora_cita, psicologo_id, centro_id, activo, origen, operador').eq('paciente_id', id).eq('accion', 'Agendar cita').order('fecha_cita', { ascending: false }).limit(20)`.
- `onSeleccionar`: `centroId` = centro de la cita activa más próxima si existe, si no `centro_id` de la ficha, si no `''`; `psicologoId` = psicólogo de esa cita o el primero no nulo de adultos/pareja/infantil.
- En `page.tsx`, `onSeleccionar` hace `setCentroId`, luego `setPsicologoId` y guarda `pacientePendienteId`; un efecto fija `setPacienteId` cuando `pacientes` contiene ese id (como el flujo de B2 con `cita=`).

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; `npm test`; dev: teléfono de un tutor → aparece el menor; "Usar en el formulario" rellena los tres campos; retardo de 300 ms y sin consulta con menos de 4 dígitos.
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git add app/dashboard/psicologos && git commit -m "Citas: buscador por teléfono con histórico de citas"`

---

### Task 5: Alta con teléfono existente (48) y consentimiento (45)

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (caja `npConfirmacion`, `vincularExistente`, etiqueta de consentimiento)

**Interfaces:**
- Caja de confirmación: botón principal = `esCallCenter ? 'Solicitar cambio de psicólogo' : 'Sí, asignar a este psicólogo'`. Para call center `onClick` = `solicitarCambioPsicologo()`: envía `Cambio solicitado` con `paciente_id = npConfirmacion.decision.paciente.id`, `paciente_iniciales` del existente, `centro_id = effCentroId`, `psicologo_id = effPsicologoId`, `comentario = comentarioCambioPsicologo(nombre del psicólogo del formulario, operador)`, `operador`, atribución; éxito: "Solicitud enviada: el equipo cambiará el psicólogo." y `resetForm()`. Para agentes y psicólogos, `vincularExistente()` como hoy.
- Consentimiento: envolver el bloque en `{pacienteSeleccionado && !esCallCenter && (…)}`.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; dev: call center con teléfono existente → botón y Telegram (ruta 8, estado `Cambio solicitado` y aparece en Comunicaciones); agente → "Sí, asignar a este psicólogo" vincula como hoy; call center no ve la etiqueta de consentimiento.
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git commit -am "Call center: solicitar cambio de psicólogo en el alta y sin etiqueta de consentimiento"`

---

### Task 6: Aviso de dos citas el mismo día (49)

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (`handleSubmit` antes del envío de Agendar / Cambiar; nueva caja `avisoMismoDia`)

**Interfaces:**
- Estado `avisoMismoDia: { citas: ReturnType<typeof citasMismoDia>; continuar: () => void } | null`.
- En `handleSubmit`, cuando `accion` es Agendar o Cambiar y pasan las validaciones: consulta `acciones_psicologos.select('id, fecha_cita, hora_cita, psicologo_id, centro_id').eq('paciente_id', pacienteId).eq('accion','Agendar cita').eq('activo', true).eq('fecha_cita', fecha)`; `citasMismoDia(filas, fecha, hora, excluirAccionId)`; si hay alguna y aún no se ha confirmado (`confirmadoMismoDia` false) → guardar en `avisoMismoDia` y salir. Caja con `textoAvisoMismoDia(cita)` por cita, botones `Ir a cambiarla` (→ `setAccion('Cambiar cita')`, psicólogo y centro de esa cita, `eventoSeleccionadoId` cuando cargue; cierra la caja) y `Sí, es otra cita` (→ `confirmadoMismoDia = true`, cierra y reenvía). `confirmadoMismoDia` se resetea al cambiar fecha, hora o paciente.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; dev: prueba de aceptación 5 con los tres roles.
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git commit -am "Citas: aviso cuando el paciente ya tiene cita ese día"`

---

### Task 7: Acciones de solicitud (50, 51) y roles

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (`ACCIONES`, `accionesDisponibles`, formulario, `handleSubmit`, payload), `docs/roles-y-permisos.md`

**Interfaces:**
- `accionesDisponibles`: call center → `ACCIONES_CITA`, `Añadir nuevo paciente` y `ACCIONES_SOLICITUD_ACTIVAS`; agente → lo de hoy más `ACCIONES_SOLICITUD_ACTIVAS`; psicólogo → sin cambios. El `<select>` de acción muestra `ETIQUETA_SOLICITUD[a]` para esas acciones.
- `esSolicitud = esAccionSolicitud(accion)`: pide paciente (mismo selector) y textarea `Comentario para el equipo` (obligatorio para `Otro`; opcional en las otras). Sin fecha, hora ni tipo.
- `handleSubmit`: validación de paciente ("Debes seleccionar un paciente para esta acción.") y de comentario para `Otro` ("Escribe el comentario para el equipo."). Payload `datosProcesados`: `accion`, `paciente_id`, `paciente_iniciales`, `centro_id`, `psicologo_id`, `comentario`, `operador`, atribución; el resto `null`. `respuestasFormulario` como siempre. Registro en `formulario_citas_psicologos`. Éxito: "Solicitud enviada al equipo."
- `docs/roles-y-permisos.md`: fila de Citas para call center y agentes con las acciones de solicitud; nota de cómo activar las tres pendientes.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; `npm test`; dev: "Otros (aviso al equipo)" visible para agente y call center, Telegram recibido; activar temporalmente `'Sin disponibilidad'` en la lista y comprobar que el paciente pasa a ese estado y sale en Comunicaciones › Sin disponibilidad (tarea 36); volver a dejar solo `Otro`.
  **Quedó así (30-10-2026):** tsc y npm test en verde; la comprobación en navegador/Make queda para las pruebas de aceptación del final (decisión de Sonia 30-10).
- [x] **Step 3: Commit** — `git commit -am "Citas: acciones de solicitud al equipo para call center y agentes"`

---

### Task 8: Cierre

- [ ] **Step 1: Migración 017** aplicada por Sonia (de madrugada). `Aplicada el: ______`. Make: mapeo de `operador` (`docs/make-cambios-2026-10-b3.md`). `Hecho el: ______`.
  **Orden obligatorio:** la 017 va ANTES de desplegar la app (el buscador y las altas del call center con operador necesitan la columna).
- [ ] **Step 2: Pruebas de aceptación** 1–7 de la especificación:
  - [ ] 1 · [ ] 2 · [ ] 3 · [ ] 4 · [ ] 5 · [ ] 6 · [ ] 7
- [x] **Step 3: Manual** (ficha Citas para call center: operador, buscador, avisos, acciones nuevas) + `check-manual.mjs` + republicar.
  **Quedó así (30-10-2026):** manual actualizado en la rama y check OK; el artifact se republica al hacer el merge (como en B2).
- [x] **Step 4: Tablero** — 42, 43, 44, 45, 48, 49, 50 → `hecha`; 51 → sigue `espera cliente` con nota "activar en `ACCIONES_SOLICITUD_ACTIVAS`"; 36 → `verificar` tras 51; B3 → `hecha`. Memoria: actualizar la nota "Call center rutas 6-9".
- [ ] **Step 5: Merge a `main` de madrugada** y commit de cierre.
