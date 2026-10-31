# B4 — Consentimiento informado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revisar al empezar:** escrito el 26-10-2026 contra `main`. Si B3 ya está fusionado, el call center ya no ve la etiqueta de consentimiento en Citas y existe `lib/call-center.ts`. Buscar en `page.tsx` por nombres (`crearPaciente`, `ejecutarAlta`, `npTipoConsulta`), no por líneas.

**Goal:** Reenviar el consentimiento desde la app, marcarlo firmado a mano con trazabilidad, registrar a la segunda persona de una pareja sin revelar si ya era paciente, y dejar probado el caso menor/tutor con el mismo teléfono.

**Architecture:** Lógica en `lib/consentimiento.ts` (puro, tests). Migración 018 añade trazabilidad y `pareja_de`. Las pantallas Pacientes y Comunicaciones llaman al webhook de Citas (`/api/webhook/psicologos`) con la acción nueva `Reenviar consentimiento`; Make decide el canal. El alta de pareja amplía `crearPaciente`.

**Tech Stack:** Next.js App Router + TypeScript, Supabase JS v2, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-b4-consentimiento-design.md`.

## Global Constraints

- Rama `b4-consentimiento` desde `main`. Commits en español. tsc limpio y `npm test` verde por tarea.
- Texto de acción hacia Make exacto: `Reenviar consentimiento`. Enlaces exactos: `https://www.somospsicologos.es/consentimiento/` y `https://www.somospsicologos.es/consentimiento-menores/`.
- Textos de interfaz exactos (sección "Textos de interfaz" de la especificación).
- ~~La pantalla **nunca** revela que la segunda persona de una pareja ya era paciente.~~ Cambiado por Sonia el 30-10-2026: el equipo sí lo ve en pantalla; quien no debe revelarlo es Dante ni los mensajes al paciente (sección "Decisiones de Sonia del 30-10-2026" de la especificación).
- `Supabase/migrations/` está fuera del repo git. Nada en producción sin autorización de Sonia en ese chat.

## Review Focus

1. **Menor con un solo tutor** (`npSoloUnTutor`): el reenvío va solo al tutor 1 y "Marcar firmado" no intenta poner `T2_consentimiento` (Tarea 1 tests, Tarea 3).
2. **Paciente sin teléfono** (menor cuyos tutores no tienen teléfono, o ficha antigua): "Reenviar" muestra "Este paciente no tiene teléfono al que enviar el consentimiento." y no llama al webhook (Tarea 1 `destinatariosReenvio` devuelve `[]`, Tarea 3).
3. **Segunda persona con el mismo teléfono que la primera** (parejas que comparten móvil): se crea igualmente como ficha nueva si el nombre es distinto; si nombre y teléfono coinciden con la primera, error "La segunda persona no puede ser la misma que la primera." (Tarea 4).
4. **Desmarcar por un psicólogo**: no existe el botón y la API de Supabase no lo impide; la app lo bloquea en la UI (Tarea 3). Anotar en "Seguridad pendiente" que RLS no protege esto.
5. **Alta de pareja sin segunda persona**: funciona exactamente como hoy (Tarea 4 comprobación manual).

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `Supabase/migrations/018_consentimiento_manual.sql` | Trazabilidad y `pareja_de` | Crear (fuera del repo) |
| `types/database.ts` | Campos nuevos en `Paciente` / `PacienteInsert` | Modificar |
| `lib/consentimiento.ts` (+ `.test.ts`) | Enlaces, destinatarios, payload, marcar/desmarcar, texto de estado | Crear |
| `lib/pacientes-tipos.test.ts` | Tests menor/tutor mismo teléfono (41) | Modificar |
| `app/dashboard/_components/ConsentimientoAcciones.tsx` | Botones Reenviar / Marcar firmado / Desmarcar reutilizables | Crear |
| `app/dashboard/pacientes/page.tsx`, `PacientesClient.tsx` | Columna Consentimiento con estado y botones | Modificar |
| `app/dashboard/mensajes/page.tsx` | Botón Reenviar consentimiento | Modificar |
| `app/dashboard/psicologos/page.tsx` | Segunda persona en el alta de pareja | Modificar |
| `docs/make-cambios-2026-10-b4.md` | Ruta "Reenviar consentimiento" para Sonia | Crear |
| `docs/arranque-consentimientos.md` | Procedimiento del día de la entrega (57) | Crear |

---

### Task 1: Migración 018, tipos y `lib/consentimiento.ts`

**Files:**
- Create: `Supabase/migrations/018_consentimiento_manual.sql`, `lib/consentimiento.ts`, `lib/consentimiento.test.ts`
- Modify: `types/database.ts` (`Paciente`, `PacienteInsert`), `lib/pacientes-tipos.test.ts`

**Interfaces:**
- SQL: las cuatro columnas de la especificación en `pacientes`, `ADD COLUMN IF NOT EXISTS`, con `COMMENT`.
- TS: `Paciente` añade `consentimiento_origen: 'formulario' | 'manual' | null`, `consentimiento_marcado_por: string | null`, `consentimiento_marcado_en: string | null`, `pareja_de: string | null`; `PacienteInsert` los mismos opcionales.
- `lib/consentimiento.ts`:
  - `ENLACE_ADULTO`, `ENLACE_MENORES`; `enlaceConsentimiento(esMenor: boolean): string`.
  - `type Tutores = { T1_nombre_completo: string | null; 'T1_teléfono': string | null; T2_nombre_completo: string | null; 'T2_teléfono': string | null }`.
  - `destinatariosReenvio(p: { nombre: string; telefono: string | null; es_menor: boolean }, tutores: Tutores | null): { nombre: string; telefono: string }[]`.
  - `type Actor = { nombre: string; id: string | null; rol: string }`.
  - `payloadReenvio(p: { id: string; nombre: string; telefono: string | null; es_menor: boolean }, tutores: Tutores | null, actor: Actor): Record<string, unknown>` → `{ accion: 'Reenviar consentimiento', paciente_id, paciente_nombre, telefono, es_menor, enlace, tutor1_nombre, tutor1_telefono, tutor2_nombre, tutor2_telefono, created_by: actor.nombre, created_by_id: actor.id, origen: actor.rol }`.
  - `marcarFirmado(actor: Actor, ahora: Date): Pick<PacienteInsert, 'consentimiento' | 'consentimiento_origen' | 'consentimiento_marcado_por' | 'consentimiento_marcado_en'>`; `desmarcarFirmado()`.
  - `camposTutoresFirmados(soloUnTutor: boolean): Partial<AsociadoMenorInsert>` → `{ T1_consentimiento: true }` o `{ T1_consentimiento: true, T2_consentimiento: true }`.
  - `textoEstadoConsentimiento(p: Pick<Paciente, 'consentimiento' | 'consentimiento_origen' | 'consentimiento_marcado_por' | 'consentimiento_marcado_en'>): string`.
  - `puedeDesmarcar(rol: string): boolean` → `rol === 'agente'`.

- [x] **Step 1: Tests**

```ts
it('destinatarios: adulto él mismo; menor sus tutores con teléfono; sin teléfono → []', () => {
  expect(destinatariosReenvio({ nombre: 'Ana', telefono: '600', es_menor: false }, null)).toEqual([{ nombre: 'Ana', telefono: '600' }])
  expect(destinatariosReenvio({ nombre: 'Leo', telefono: '611', es_menor: true }, { T1_nombre_completo: 'Pa', 'T1_teléfono': '611', T2_nombre_completo: 'Ma', 'T2_teléfono': null }))
    .toEqual([{ nombre: 'Pa', telefono: '611' }])
  expect(destinatariosReenvio({ nombre: 'X', telefono: null, es_menor: false }, null)).toEqual([])
})
it('payloadReenvio lleva la acción exacta y el enlace según es_menor', () => {
  const p = payloadReenvio({ id: 'p1', nombre: 'Leo', telefono: '611', es_menor: true }, null, { nombre: 'Marta', id: 'u1', rol: 'agente' })
  expect(p.accion).toBe('Reenviar consentimiento')
  expect(p.enlace).toBe('https://www.somospsicologos.es/consentimiento-menores/')
  expect(p.origen).toBe('agente')
})
it('marcarFirmado / desmarcar / tutores', () => {
  const m = marcarFirmado({ nombre: 'Jaime', id: 'u2', rol: 'psicologo' }, new Date('2026-10-26T10:00:00Z'))
  expect(m).toEqual({ consentimiento: true, consentimiento_origen: 'manual', consentimiento_marcado_por: 'Jaime', consentimiento_marcado_en: '2026-10-26T10:00:00.000Z' })
  expect(desmarcarFirmado()).toEqual({ consentimiento: false, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })
  expect(camposTutoresFirmados(true)).toEqual({ T1_consentimiento: true })
  expect(camposTutoresFirmados(false)).toEqual({ T1_consentimiento: true, T2_consentimiento: true })
})
it('textoEstadoConsentimiento', () => {
  expect(textoEstadoConsentimiento({ consentimiento: true, consentimiento_origen: 'manual', consentimiento_marcado_por: 'Jaime', consentimiento_marcado_en: '2026-10-26T10:00:00Z' })).toBe('Firmado a mano por Jaime el 26/10/2026')
  expect(textoEstadoConsentimiento({ consentimiento: true, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })).toBe('Firmado')
  expect(textoEstadoConsentimiento({ consentimiento: false, consentimiento_origen: null, consentimiento_marcado_por: null, consentimiento_marcado_en: null })).toBe('Pendiente')
})
```

En `lib/pacientes-tipos.test.ts` (tarea 41):

```ts
it('un adulto con el teléfono de un menor existente no es duplicado', () => {
  const menor = { id: 'm', nombre: 'Leo Pérez', telefono: '611', es_menor: true, fecha_nacimiento: '2015-01-01', psicologo_adultos_id: null, psicologo_pareja_id: null, psicologo_infantil_id: 'j' }
  expect(evaluarDuplicado({ nombre: 'Pablo Pérez', telefono: '611', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'j' }, [menor])).toEqual({ tipo: 'ninguno' })
})
it('un menor con el teléfono de un adulto existente (su padre) no es duplicado', () => {
  const padre = { id: 'p', nombre: 'Pablo Pérez', telefono: '611', es_menor: false, fecha_nacimiento: '1980-01-01', psicologo_adultos_id: 'j', psicologo_pareja_id: null, psicologo_infantil_id: null }
  expect(evaluarDuplicado({ nombre: 'Leo Pérez', telefono: '611', fechaNacimiento: '2015-01-01', esMenor: true, tipoConsulta: 'menor', psicologoId: 'j' }, [padre])).toEqual({ tipo: 'ninguno' })
})
```

(Ajustar la forma de `PacienteExistente` a la real del módulo.)

- [x] **Step 2: Ejecutar y ver fallar.** — [x] **Step 3: Implementar.** — [x] **Step 4: PASS + tsc.**
- [x] **Step 5: Commit** — `git add lib types && git commit -m "Consentimiento: módulo puro, trazabilidad en tipos y tests menor/tutor"` (b2a75bd, 30-10-2026)

---

### Task 2: Componente `ConsentimientoAcciones`

**Files:**
- Create: `app/dashboard/_components/ConsentimientoAcciones.tsx`

**Interfaces:**
- Props: `{ paciente: { id; nombre; telefono; es_menor; consentimiento; consentimiento_origen; consentimiento_marcado_por; consentimiento_marcado_en }; rol: 'agente' | 'psicologo'; actor: Actor; onCambio: (p: Partial<Paciente>) => void; compacto?: boolean }`.
- Comportamiento: muestra `textoEstadoConsentimiento`; botón `Reenviar` → `confirm('¿Enviar de nuevo el consentimiento a {nombre}?')` → si `es_menor`, carga `asociados_menores` por `id_menor` → `destinatariosReenvio` vacío → mensaje "Este paciente no tiene teléfono al que enviar el consentimiento."; si no, `fetch('/api/webhook/psicologos', { method: 'POST', body: { mensaje: 'Formulario Web Psicólogos', responseId, timestampFormulario, datosProcesados: payloadReenvio(...), respuestasFormulario: { '¿Qué necesitas hoy?': 'Reenviar consentimiento' } } })` y "Consentimiento reenviado."; botón `Marcar firmado` → confirm → `supabase.from('pacientes').update(marcarFirmado(actor, new Date()))` y, si menor, `asociados_menores.update(camposTutoresFirmados(soloUnTutor))` (soloUnTutor = `T2_nombre_completo` vacío) → `onCambio`; botón `Desmarcar` solo si `puedeDesmarcar(rol)` y está firmado → confirm → `desmarcarFirmado()` (en menores también `T1/T2_consentimiento = false`).

- [x] **Step 1: Implementar.** — [x] **Step 2: tsc.** — [x] **Step 3: Commit** — `git add app/dashboard/_components/ConsentimientoAcciones.tsx && git commit -m "Consentimiento: botones de reenviar y marcar firmado"` (a5417f6)

---

### Task 3: Pacientes y Comunicaciones

**Files:**
- Modify: `app/dashboard/pacientes/page.tsx` (seleccionar los campos nuevos, pasar `rol` y `actor`), `app/dashboard/pacientes/PacientesClient.tsx` (columna Consentimiento → `ConsentimientoAcciones`), `app/dashboard/mensajes/page.tsx` (botón `Reenviar consentimiento` por paciente, con `compacto`)

**Interfaces:**
- `PacienteTableRow` añade `es_menor`, `consentimiento_origen`, `consentimiento_marcado_por`, `consentimiento_marcado_en`; `PacientesClient` recibe `rol` y `actor`.
- `onCambio` actualiza la fila en local.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Comprobar** — tsc; dev: psicólogo ve Reenviar y Marcar firmado, no Desmarcar; agente ve los tres; Comunicaciones reenvía; call center no entra en estas pantallas. *(tsc OK; la comprobación en pantalla queda para las pruebas de aceptación, que Sonia difirió al final de todos los bloques; además Comunicaciones necesita la migración 018 para cargar.)*
- [x] **Step 3: Commit** — `git commit -am "Pacientes y Comunicaciones: reenviar y marcar consentimiento"` (50226b1)

---

### Task 4: Segunda persona de la pareja en el alta

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (`crearPaciente`, formulario de alta cuando `npTipoConsulta === 'pareja'`)

**Interfaces:**
- Estado `npParejaNombre`, `npParejaTelefono` (ambos opcionales; si uno viene, el otro es obligatorio: "Indica nombre y teléfono de la segunda persona.").
- Tras crear la primera ficha (`nuevoPaciente.id`): si hay segunda persona → `supabase.from('pacientes').select(...).eq('telefono', tel).eq('es_menor', false)`; `existente = find(normalizarNombre(nombre) === normalizarNombre(npParejaNombre))`; si `normalizarNombre(npParejaNombre) === normalizarNombre(npNombre)` y mismo teléfono → error "La segunda persona no puede ser la misma que la primera." (antes de crear nada). Existe → `update({ psicologo_pareja_id: effPsicologoId, pareja_de: nuevoPaciente.id })`; no existe → `insert({ nombre, iniciales: generarIniciales(nombre), telefono, es_menor: false, centro_id: effCentroId, psicologo_pareja_id: effPsicologoId, estado: 'Nuevo paciente', fecha_incorporacion, created_by…, origen, pareja_de: nuevoPaciente.id })` y envío a Make de `Añadir nuevo paciente` para la segunda persona (mismo payload que la primera, con sus datos). Después `update` de la primera con `pareja_de = idSegunda`. Mensaje final: "Pareja registrada." en ambos casos.

- [x] **Step 1: Implementar.** *(Lógica pura en `lib/pareja.ts` + tests; `registrarSegundaPersona` se llama desde `crearPaciente` y también desde `vincularExistente`, para no perder lo escrito cuando la primera persona ya existía.)*
- [x] **Step 2: Comprobar** — tsc; `npm test` (199 en verde); dev: los tres casos de la especificación (existente, nueva, sin segunda persona). *(Los tres casos en pantalla quedan para las pruebas de aceptación diferidas.)*
- [x] **Step 3: Commit** — `git commit -am "Alta de pareja: segunda persona opcional vinculada sin revelar si ya era paciente"` (10aa79e)

---

### Task 5: Documentos para Sonia y cierre

**Files:**
- Create: `docs/make-cambios-2026-10-b4.md` (ruta `Reenviar consentimiento`: filtro por `datosProcesados.accion`, mensaje a `telefono` o a `tutor1_telefono`/`tutor2_telefono` con `datosProcesados.enlace`, Telegram ahora / WhatsApp después), `docs/arranque-consentimientos.md` (tarea 57: el día de la entrega, listado de pacientes con consentimiento pendiente, aviso a psicólogos, uso de "Marcar firmado" para los que firmaron en papel y "Reenviar" para el resto).

- [x] **Step 1: Escribir los dos documentos.** (30-10-2026)
- [x] **Step 2: Migración 018** aplicada por Sonia (de madrugada): `Aplicada el: 31-10-2026`. Ruta de Make creada: `Hecha el: 31-10-2026`.
- [ ] **Step 3: Pruebas de aceptación** 1–5: [ ] 1 · [ ] 2 · [ ] 3 · [ ] 4 · [ ] 5
- [x] **Step 4: Manual** (Pacientes: botones; Citas: segunda persona) + `check-manual.mjs` *(hecho en la rama; **republicar al fusionar**)*. Memoria "Seguridad pendiente": RLS no impide desmarcar desde el cliente *(anotado)*.
- [ ] **Step 5: Tablero** — 38, 39, 41 → `hecha`; 40 → `hecha (segunda persona opcional; si Jaime dice "siempre 2", hacerla obligatoria)`; 57 → documento listo, se ejecuta en B10; B4 → `hecha`.
- [ ] **Step 6: Merge a `main` de madrugada** y commit de cierre.
