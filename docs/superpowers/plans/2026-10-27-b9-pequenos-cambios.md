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

**Files:**
- Modify: `app/dashboard/_components/SidebarNav.tsx:69` (`label: 'Accesos'`), `app/dashboard/usuarios/page.tsx` (título `Accesos`, textos "Usuarios" → "Accesos"), `app/dashboard/agentes/page.tsx:95-115,265-295`, `docs/roles-y-permisos.md` (fila "Usuarios" → "Accesos")

**Interfaces:**
- Consumes: `PATCH /api/usuarios/[id]` con `{ tipo: 'agente', telefono: string | null }` (ya existe, `route.ts:35`).
- Produces: en `agentes/page.tsx`, `guardarTelefono(a: Agente, telefono: string): Promise<void>`.

- [ ] **Step 1: Quitar `restablecer`, `setResultado`/`resultado` si solo lo usaba, y los dos `ActionButton` de contraseña.** Tooltips restantes: "créala desde Accesos".
- [ ] **Step 2: Editar teléfono**: estado `editando: string | null`, `telefonoNuevo: string`; en la celda Teléfono, si `editando === a.id` → `<input>` + `Guardar` / `Cancelar`, si no → texto + `ActionButton` `Editar teléfono`. `guardarTelefono` hace el `PATCH` (`telefono: telefonoNuevo.trim() || null`), actualiza `agentes` en memoria y muestra `Teléfono guardado.` o `No se pudo guardar el teléfono.` en el aviso existente.
- [ ] **Step 3: Renombrar** en menú, título de `usuarios/page.tsx` y `roles-y-permisos.md`.
- [ ] **Step 4: tsc; prueba manual** (aceptaciones 1 y 2; Review Focus 3 y 4).
- [ ] **Step 5: Commit** `git commit -m "B9: Usuarios pasa a Accesos; Agentes solo teléfono y activo"`

### Task 2: Pie de los mensajes (37)

**Files:**
- Create: `lib/mensajes-pie.ts`, `lib/mensajes-pie.test.ts`
- Modify: `app/api/webhook/mensajes/route.ts:9-16`, `app/dashboard/mensajes/page.tsx` (vista previa en los tres sitios donde se muestra el texto antes de enviar: ~479 textarea, ~583 espera, ~704 dudosos), `app/dashboard/mensajes-psicologo/page.tsx` (vista previa de reseña y de libre)

**Interfaces:**
- Produces: `CONTACTO_DANTE: string`; `pieMensaje(contacto?: string): string`; `conPie(mensaje: string, contacto?: string): string`.

- [ ] **Step 1: Test**

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

- [ ] **Step 2: `npm test -- mensajes-pie` → falla**
- [ ] **Step 3: Escribir `lib/mensajes-pie.ts`** (`trimEnd()` del mensaje; `contacto` por defecto `CONTACTO_DANTE`).
- [ ] **Step 4: `npm test -- mensajes-pie` → pasa**
- [ ] **Step 5: API**: tras `const body = await req.json()`, `if (typeof body.mensaje === 'string') body.mensaje = conPie(body.mensaje)`.
- [ ] **Step 6: Vistas previas**: bajo cada texto editable o plantilla, bloque gris `Así llegará el mensaje:` + `conPie(texto)` en `white-space: pre-wrap` (solo lectura).
- [ ] **Step 7: Prueba manual**: enviar reseña y lista de espera a un teléfono de prueba (aceptación 4); `curl` con cuerpo sin `mensaje` → Make recibe lo mismo de antes.
- [ ] **Step 8: Commit** `git commit -m "B9: pie informativo en todos los mensajes salientes"`

### Task 3: Ocultar "Nueva recomendación" (33)

**Files:**
- Create: `lib/flags.ts`
- Modify: `app/dashboard/psicologos/page.tsx` (~1580: `{MOSTRAR_RECOMENDACION && (...)}` alrededor de la casilla; `npEsRecomendado` se mantiene en `false`)

- [ ] **Step 1: `lib/flags.ts`**: `export const MOSTRAR_RECOMENDACION = false` con comentario (tarea 33, 27-10-2026: el cliente no la usa; para volver a verla poner `true`).
- [ ] **Step 2: Envolver la casilla; tsc; comprobar** que el alta sigue enviando `es_paciente_recomendado: false` y que Comunicaciones › Recomendaciones sigue listando a los antiguos.
- [ ] **Step 3: Commit** `git commit -m "B9: casilla Nueva recomendación oculta tras MOSTRAR_RECOMENDACION"`

### Task 4: Manual: estados y novedades (27)

**Files:**
- Modify: `docs/manual-somos/index.html` (tabla "Estados del paciente" ~613-631; Usuarios → Accesos ~504-508 y menú; Agentes ~554-556; Comunicaciones y Mensajes: nota del pie; Citas: nota de recomendación oculta; Novedades)

- [ ] **Step 1: Verificar en los blueprints de Make** (`docs/` de la raíz, exportados) qué estado escribe cada ruta: Agendar/Cambiar → Agendado, Cancelar → Anulado, Sin disponibilidad, Cambio solicitado; y en el código qué cambia Comunicaciones (`mensajes/page.tsx`: En espera, Dudoso contactado, Inactivo, Nuevo paciente al resolver recomendación). Si B3 ya está en main, tomar de su spec los estados que activa el call center.
- [ ] **Step 2: Reescribir la tabla** con columnas *Estado · Quién lo pone · Cuándo · Qué pasa después*; mantener `decisión pendiente` solo donde la tarea 51 no esté resuelta.
- [ ] **Step 3: Resto de textos** del manual (Accesos, Agentes, pie de mensajes con el texto exacto, recomendación oculta) y entrada en Novedades: `Usuarios se llama ahora Accesos. En Agentes solo se edita el teléfono. Los mensajes a pacientes llevan un pie que indica que no se reciben respuestas y cómo contactar con Dante. La casilla "Nueva recomendación" ya no se muestra.`
- [ ] **Step 4: Republicar el manual** (artifact de la memoria "Manual Somos para dueños"); tablero: 30, 33, 37, 27 → hecha; merge a `main` tras `npm run build`.
- [ ] **Step 5: Commit** `git commit -m "B9: manual (estados de paciente, Accesos, pie de mensajes)"`
