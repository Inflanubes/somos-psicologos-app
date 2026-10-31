# B9 — Pequeños cambios de interfaz: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renombrar Usuarios a Accesos, dejar Agentes solo con teléfono y activo, ocultar "Nueva recomendación", añadir el pie informativo a todos los mensajes salientes y documentar los estados de paciente en el manual.

**Architecture:** Dos constantes en `lib/` (`flags.ts`, `mensajes-pie.ts`) y un cambio en la API de mensajes; el resto son ediciones de pantalla y de manual.

**Tech Stack:** Next.js App Router, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-b9-pequenos-cambios-design.md`

## Global Constraints

- Rama `b9-pequenos-cambios` desde `main`. Cualquier momento; sin migraciones ni Make.
- Cada tarea: `npx tsc --noEmit -p tsconfig.json` limpio, `npm test` verde, commit en español.
- Texto del pie exacto: `Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: {contacto}`. `CONTACTO_DANTE` = enlace del bot de Telegram que dé Sonia (si no lo da, `91 166 50 47`); comentario en el archivo: "al pasar a WhatsApp, poner aquí el número de Dante".
- La ruta `/dashboard/usuarios` no cambia.

## Review Focus

1. Mensaje que ya lleva el pie (reenvío o doble clic): `conPie` no lo duplica (test T2).
2. Cuerpo sin campo `mensaje` o con `mensaje` no textual: la API lo reenvía intacto (test manual T2 con `curl`).
3. Guardar un teléfono vacío en Agentes: se envía `null` y la fila muestra `—` (T1).
4. Agente sin cuenta de acceso (`sinCuenta`): editar teléfono sigue funcionando porque `PATCH` va por el id de `agentes` (T1, comprobar con uno sin `auth_user_id`).
5. Paciente antiguo en `Revisar recomendado` con la casilla oculta: Comunicaciones lo sigue listando (T3, comprobación manual).

---

### Task 1: Accesos y Agentes (30)

**Hecho 31-10-2026.** Prueba en navegador diferida a las pruebas de aceptación del final. También se cambiaron los textos «en Usuarios» de Psicólogos (`FichaPsicologo.tsx`, `equipo/page.tsx`) y `gestion.tsx`.

**Files:**
- Modify: `app/dashboard/_components/SidebarNav.tsx:69` (`label: 'Accesos'`), `app/dashboard/usuarios/page.tsx` (título `Accesos`, textos "Usuarios" → "Accesos"), `app/dashboard/agentes/page.tsx:95-115,265-295`, `docs/roles-y-permisos.md` (fila "Usuarios" → "Accesos")

**Interfaces:**
- Consumes: `PATCH /api/usuarios/[id]` con `{ tipo: 'agente', telefono: string | null }` (ya existe, `route.ts:35`).
- Produces: en `agentes/page.tsx`, `guardarTelefono(a: Agente, telefono: string): Promise<void>`.

- [x] **Step 1: Quitar `restablecer`, `setResultado`/`resultado` si solo lo usaba, y los dos `ActionButton` de contraseña.** Tooltips restantes: "créala desde Accesos".
- [x] **Step 2: Editar teléfono**: estado `editando: string | null`, `telefonoNuevo: string`; en la celda Teléfono, si `editando === a.id` → `<input>` + `Guardar` / `Cancelar`, si no → texto + `ActionButton` `Editar teléfono`. `guardarTelefono` hace el `PATCH` (`telefono: telefonoNuevo.trim() || null`), actualiza `agentes` en memoria y muestra `Teléfono guardado.` o `No se pudo guardar el teléfono.` en el aviso existente.
- [x] **Step 3: Renombrar** en menú, título de `usuarios/page.tsx` y `roles-y-permisos.md`.
- [x] **Step 4: tsc; prueba manual** (aceptaciones 1 y 2; Review Focus 3 y 4).
- [x] **Step 5: Commit** `git commit -m "B9: Usuarios pasa a Accesos; Agentes solo teléfono y activo"`

### Task 2: Pie de los mensajes (37)

**Hecho 31-10-2026.** Decisiones: `CONTACTO_DANTE = 91 166 50 47` (Sonia no dio el enlace; en docs hay dos bots, @Jaimervr_bot y @Dantito_bot: cambiar la constante si se prefiere uno); el aviso al psicólogo (`notificar_psicologo`) no lleva pie (`llevaPie`, con test). Envío real a un teléfono de prueba diferido a las pruebas de aceptación.

**Files:**
- Create: `lib/mensajes-pie.ts`, `lib/mensajes-pie.test.ts`
- Modify: `app/api/webhook/mensajes/route.ts:9-16`, `app/dashboard/mensajes/page.tsx` (vista previa en los tres sitios donde se muestra el texto antes de enviar: ~479 textarea, ~583 espera, ~704 dudosos), `app/dashboard/mensajes-psicologo/page.tsx` (vista previa de reseña y de libre)

**Interfaces:**
- Produces: `CONTACTO_DANTE: string`; `pieMensaje(contacto?: string): string`; `conPie(mensaje: string, contacto?: string): string`.

- [x] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { conPie, pieMensaje } from './mensajes-pie'

describe('conPie', () => {
  it('añade el pie separado por línea en blanco', () => {
    expect(conPie('Hola Ana', 'X')).toBe('Hola Ana\n\nMensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: X')
  })
  it('no lo duplica y respeta espacios finales', () => {
    const una = conPie('Hola  \n', 'X')
    expect(conPie(una, 'X')).toBe(una)
    expect(una.startsWith('Hola\n\n')).toBe(true)
  })
  it('mensaje vacío → solo el pie', () => {
    expect(conPie('', 'X')).toBe(pieMensaje('X'))
  })
})
```

- [x] **Step 2: `npm test -- mensajes-pie` → falla**
- [x] **Step 3: Escribir `lib/mensajes-pie.ts`** (`trimEnd()` del mensaje; `contacto` por defecto `CONTACTO_DANTE`).
- [x] **Step 4: `npm test -- mensajes-pie` → pasa**
- [x] **Step 5: API**: tras `const body = await req.json()`, `if (typeof body.mensaje === 'string') body.mensaje = conPie(body.mensaje)`.
- [x] **Step 6: Vistas previas**: bajo cada texto editable o plantilla, bloque gris `Así llegará el mensaje:` + `conPie(texto)` en `white-space: pre-wrap` (solo lectura).
- [x] **Step 7: Prueba manual**: enviar reseña y lista de espera a un teléfono de prueba (aceptación 4); `curl` con cuerpo sin `mensaje` → Make recibe lo mismo de antes.
- [x] **Step 8: Commit** `git commit -m "B9: pie informativo en todos los mensajes salientes"`

### Task 3: Ocultar "Nueva recomendación" (33)

**Files:**
- Create: `lib/flags.ts`
- Modify: `app/dashboard/psicologos/page.tsx` (~1580: `{MOSTRAR_RECOMENDACION && (...)}` alrededor de la casilla; `npEsRecomendado` se mantiene en `false`)

- [x] **Step 1: `lib/flags.ts`**: `export const MOSTRAR_RECOMENDACION = false` con comentario (tarea 33, 27-10-2026: el cliente no la usa; para volver a verla poner `true`).
- [x] **Step 2: Envolver la casilla; tsc; comprobar** que el alta sigue enviando `es_paciente_recomendado: false` y que Comunicaciones › Recomendaciones sigue listando a los antiguos.
- [x] **Step 3: Commit** `git commit -m "B9: casilla Nueva recomendación oculta tras MOSTRAR_RECOMENDACION"`

### Task 4: Manual: estados y novedades (27)

**Quedó así:** manual editado y `check-manual` OK; los estados se verificaron contra el código y `docs/make-cambios-2026-10-22.md` (rutas 6–9), sin reabrir los blueprints (la tabla anterior ya estaba verificada el 28-09). Falta Step 4: republicar el manual y merge a `main`.

**Files:**
- Modify: `docs/manual-somos/index.html` (tabla "Estados del paciente" ~613-631; Usuarios → Accesos ~504-508 y menú; Agentes ~554-556; Comunicaciones y Mensajes: nota del pie; Citas: nota de recomendación oculta; Novedades)

- [x] **Step 1: Verificar en los blueprints de Make** (`docs/` de la raíz, exportados) qué estado escribe cada ruta: Agendar/Cambiar → Agendado, Cancelar → Anulado, Sin disponibilidad, Cambio solicitado; y en el código qué cambia Comunicaciones (`mensajes/page.tsx`: En espera, Dudoso contactado, Inactivo, Nuevo paciente al resolver recomendación). Si B3 ya está en main, tomar de su spec los estados que activa el call center.
- [x] **Step 2: Reescribir la tabla** con columnas *Estado · Quién lo pone · Cuándo · Qué pasa después*; mantener `decisión pendiente` solo donde la tarea 51 no esté resuelta.
- [x] **Step 3: Resto de textos** del manual (Accesos, Agentes, pie de mensajes con el texto exacto, recomendación oculta) y entrada en Novedades: `Usuarios se llama ahora Accesos. En Agentes solo se edita el teléfono. Los mensajes a pacientes llevan un pie que indica que no se reciben respuestas y cómo contactar con Dante. La casilla "Nueva recomendación" ya no se muestra.`
- [ ] **Step 4: Republicar el manual** (artifact de la memoria "Manual Somos para dueños"); tablero: 30, 33, 37, 27 → hecha; merge a `main` tras `npm run build`.
- [x] **Step 5: Commit** `git commit -m "B9: manual (estados de paciente, Accesos, pie de mensajes)"`

## Cierre (31-10-2026)

tsc limpio, 241 tests y `npm run build` OK. Revisión independiente: 0 críticos. Pendiente antes o durante las pruebas de aceptación:

- **Contacto del pie:** hoy `91 166 50 47` (teléfono de la clínica) tras «contacta con Dante:». Sonia decide: enlace del bot o cambiar el texto a «contacta con la clínica». Una constante en `lib/mensajes-pie.ts`.
- **Make (escenario de envío de mensajes):** el export de marzo solo confirma que `mensaje_dudoso` y `mensaje_espera` mandan `{{1.mensaje}}`. Comprobar en el escenario vivo que `mensaje_sin_disponibilidad`, `solicitar_resena` y `mensaje_libre` también envían el campo `mensaje` (si montan su propio texto, el pie no llega). Prueba de aceptación 4: enviar uno de cada tipo.
- **Posible fallo anterior a B9:** en el export viejo, la ruta `notificar_psicólogo` filtra con tilde y envía a `{{1.paciente.telefono}}`. Comprobar en Make que el aviso al psicólogo va al teléfono del psicólogo.
- Menores diferidos: Agentes no muestra el error concreto del servidor al guardar el teléfono; `conPie` no reconoce un pie antiguo si cambia el contacto.

**Make revisado (31-10-2026, blueprint exportado por Sonia, `Make blueprints/SPs envio mensajes.json`):** seis rutas, una por `tipo` (`notificar_psicologo` sin tilde en el valor, `mensaje_dudoso`, `mensaje_espera`, `mensaje_sin_disponibilidad`, `solicitar_resena`, `mensaje_libre`); todas envían `{{1.mensaje}}`, así que el pie llega en las cinco de pacientes. El aviso al psicólogo va a `{{1.psicologo.telefono}}` (bien). Nada que tocar en Make. Detalle: todo sale por Telegram con la conexión «Dante Bot SPs» (el mismo bot que Dante), así que el paciente lo recibe en el chat de Dante y si contesta ahí le responde Dante: el texto del pie («no recibimos respuestas… contacta con Dante») hay que ajustarlo a eso (decisión de Sonia).

**Decisión de Sonia (31-10-2026):** el pie se queda como está; `91 166 50 47` es donde hay que contactar ahora. Se revisa al pasar a producción (tarea 37b del tablero, B10).
