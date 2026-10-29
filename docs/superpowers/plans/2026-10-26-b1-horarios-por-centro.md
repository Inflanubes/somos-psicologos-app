# B1 — Horarios por centro y reglas de agenda — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada franja de horario pertenece a un centro, cada centro de un psicólogo se puede apagar para citas nuevas, nadie agenda en el pasado ni (salvo agentes, con aviso) con menos de 2 h, sin horario no hay citas, y Dante pide los huecos a la app en vez de a Make.

**Architecture:** Supabase es la fuente de verdad (migración 016). La lógica de decisión vive en módulos puros de `lib/` con tests Vitest (`horarios.ts`, `disponibilidad.ts`, `fechas.ts`, `huecos-dante.ts`); `disponibilidad-datos.ts` carga los datos con el cliente de Supabase que le pasen (navegador o service role), y por eso el formulario de Citas y el endpoint nuevo `/api/disponibilidad` calculan los huecos con el mismo código. Dante (n8n) llama a ese endpoint para ofrecer horas y para comprobar antes de mandar a Make; Make no cambia.

**Tech Stack:** Next.js (App Router) + TypeScript, Supabase JS v2, Vitest (`npm test`), n8n (tools en `n8n/tools/*.js`, build con `node n8n/tools/build-workflow.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-26-b1-horarios-por-centro-design.md`.

> **Estado 29-10-2026:** Tareas 1–11 hechas en la rama `b1-horarios-por-centro` (tsc limpio, 133 tests en verde; revisión final hecha el 29-10-2026, ver al final). Tarea 12 pendiente de Sonia: migración 016 de madrugada, token en el hosting, pruebas de aceptación, republicar el manual y merge. Instrucciones de Dante en `docs/dante-cambios-2026-10-b1.md`. Decisiones tomadas durante la ejecución al final de este archivo. Tablero: `docs/backlog-2026-10-21.md` (B1: tareas 13, 28, 46, 47, 31). Método: `docs/metodo-trabajo.md`.

## Global Constraints

- Rama `b1-horarios-por-centro` creada desde `main`. Commits pequeños en español. Merge a `main` solo cuando la migración 016 esté aplicada (Tarea 12): el código de las Tareas 5–10 lee columnas que sin la migración no existen.
- Cada tarea termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde.
- Fechas `YYYY-MM-DD` como texto en `Europe/Madrid`; nunca `new Date('YYYY-MM-DD')`. "Ahora" se inyecta siempre como parámetro (`ahora: { fecha, minutos }`) para poder testear.
- Antelación mínima: `ANTELACION_MIN = 120` (minutos). Huecos de 08:00 a 21:30, cita de 60 min, como hoy.
- Textos de interfaz exactos (copiar tal cual, en español):
  - Casilla: `Citar fuera de horario`
  - Avisos de agente: `quedan menos de 2 horas para esa cita` · `{nombre} no recibe citas nuevas en {centro}` · `{nombre} no tiene horario definido`
  - Error duro (todos): `Esa hora ya ha pasado. Elige otra.`
  - Ficha: `Recibe citas nuevas` · `Sin horario: no se le pueden dar citas` · `Horario asignado automáticamente a {centro}: revísalo`
  - Psicólogo / call center sin horario: `{nombre} no tiene horario: pídele a un agente que lo defina en Psicólogos.`
  - Error de solape: `Los tramos del {día} se solapan ({centro A} {hh:mm}–{hh:mm} y {centro B} {hh:mm}–{hh:mm}).`
- No se toca Supabase de producción, Make ni el n8n de producción sin que Sonia lo autorice en ese chat. La migración se aplica de madrugada (4–5 h) o con Dante y Make parados.
- **Fuera del repo git:** `Supabase/migrations/` y `n8n/` están en `Z:ClaudeSomos Psicológos` pero fuera del git de `somos-app` (y sin git propio). Antes de editar un archivo de `n8n/tools` o `n8n/workflows`, copiarlo a su carpeta `_backups/` con fecha; al cerrar el chat, anotar en el tablero qué archivos de fuera del repo cambiaron.
- No se toca `lib/eventos-activos.ts` salvo lo indicado; `todayISODate` sigue existiendo (lo usan otras pantallas).

## Decisiones del plan que afinan la especificación

Las toma el plan porque la especificación las dejaba al builder o porque al bajar al código encajaban peor. Sonia puede revertirlas.

1. **Psicólogo con centro apagado sigue apareciendo en el desplegable de ese centro para todos los roles**, con sufijo `(no recibe citas nuevas)`; se bloquea al llegar a "Agendar cita" (psicólogo/call center: mensaje fijo y sin horas; agente: estado `centro_inactivo` con aviso). Motivo: el desplegable de psicólogo se elige antes que la acción, y "Cambiar" y "Cancelar" tienen que seguir funcionando con él. La especificación decía "no aparece"; esto cumple el mismo objetivo sin romper cambiar/cancelar.
2. **Interruptor de centro en el PATCH:** campo `centro_activo: { centro_id, activo }` (un toggle por pulsación, como los demás interruptores de la ficha) en vez de la lista de `{id, activo}`. `centro_ids` sigue siendo la lista de ids y conserva el `activo` de los centros que ya estaban.
3. **Marca "revisar":** columna `horarios_psicologos.revisar boolean` que la migración pone a `true` en las franjas asignadas por defecto a psicólogos con varios centros; cualquier guardado del horario escribe filas nuevas con `false`.
4. **Sin tramos = fuera de horario** en el módulo puro (`generarHuecos`, `trabajaEseDia`): desaparece el modo "sin restricción". El formulario decide el mensaje con `tieneAlgunHorario`.
5. **Hora ya ocupada** se sigue listando deshabilitada con `· ocupada` (como hoy) en los dos modos; `pasado` no se lista nunca.
6. **Token de Dante:** constante `APP_API_TOKEN` en `n8n/tools/_comun.js` con el marcador `__DANTE_API_TOKEN__`; `build-workflow.mjs` lo sustituye por `process.env.DANTE_API_TOKEN` (falla si no está). El JSON generado lleva el token, como ya ocurre con el del bot (pendiente de "Seguridad pendiente Supabase").
7. **Centro Online:** `centros.es_online` (la migración lo marca donde `nombre ILIKE 'online'`); solo se usa en la validación de solapes.

## Review Focus

1. **Hoy a las 12:00, agente elige hoy 13:30**: debe poder, con el aviso `quedan menos de 2 horas para esa cita`; a las 12:00 o antes, error `Esa hora ya ha pasado. Elige otra.` (tests en Tarea 4; comprobación en Tarea 8).
2. **Franjas L 10–14 Moratalaz y L 10–14 Online** se guardan; L 10–14 Moratalaz y L 13–17 San Blas no (Tarea 3). Con cita Online a las 11, Moratalaz a las 11 sale `ocupado` (Tarea 4).
3. **Cambiar cita en un centro apagado**: permitido para todos; solo "Agendar cita" se bloquea (Tarea 4 `centroInactivo`, Tarea 8, Tarea 10 `comprobar` con `excluir_accion_id`).
4. **Horas con segundos** (`'10:00:00'` de Supabase) en tramos y citas siguen funcionando (`aMinutos` ya los admite; tests en Tarea 4 y 6 con ese formato).
5. **Dante inventa una hora** (`10:15`, o `10:00` fuera de franja): `comprobar` devuelve `ok:false` con motivo y `EjecutarAccion` no manda nada a Make (Tareas 6 y 11).

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `Supabase/migrations/016_horarios_por_centro.sql` | `centro_id` y `revisar` en horarios, `activo` en psicologos_centros, `es_online` en centros, vista ampliada, relleno | Crear |
| `types/database.ts` | Tipos de fila de lo anterior | Modificar |
| `lib/fechas.ts` (+ `.test.ts`) | `ahoraMadrid`, `ANTELACION_MIN` | Crear |
| `lib/horarios.ts` (+ `.test.ts`) | `Tramo.centro_id`, `CentroHorario`, `validarTramos` con Online, `resumenHorario` por centro | Modificar |
| `lib/disponibilidad.ts` (+ `.test.ts`) | Estados `pasado`, `antelacion`, `centro_inactivo`; sin tramos = fuera de horario; `motivoAviso` | Modificar |
| `lib/citas-recurrentes.ts` | `comprobarSerie` veta `pasado` | Modificar |
| `lib/disponibilidad-datos.ts` | Carga isomorfa (cliente inyectado) por psicólogo × centro | Modificar |
| `app/dashboard/psicologos/useDisponibilidad.ts` | Hook con `centroId` | Modificar |
| `lib/huecos-dante.ts` (+ `.test.ts`) | Próximos huecos, motivo, elección de psicólogo (puro) | Crear |
| `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts` | GET/PATCH con centro en horarios, `centro_activo`, `es_online` | Modificar |
| `app/dashboard/_components/gestion.tsx` | Tipos `PsicologoGestion`, `CentroGestion` | Modificar |
| `app/dashboard/_components/HorarioEditor.tsx` | Editor por centro | Modificar |
| `app/dashboard/equipo/page.tsx`, `app/dashboard/equipo/FichaPsicologo.tsx` | Interruptor por centro, "Sin horario" en rojo, aviso revisar | Modificar |
| `app/dashboard/_components/TimeSelect.tsx` | Sufijos nuevos | Modificar |
| `app/dashboard/psicologos/page.tsx` | Casilla, mensajes, vetos, sufijo de psicólogo, centro apagado | Modificar |
| `app/dashboard/calendario/page.tsx` | Sombreado con las franjas del centro filtrado | Modificar |
| `app/api/disponibilidad/route.ts` | Endpoint para Dante (`psicologo` / `centro` / `comprobar`) | Crear |
| `lib/disponibilidad-servidor.ts` | Carga con service role y orquestación del endpoint | Crear |
| `n8n/tools/_comun.js`, `n8n/tools/ejecutar-accion.js`, `n8n/tools/build-workflow.mjs`, `n8n/prompts/somos-system-prompt.md` | Dante: endpoint, comprobar, prompt | Modificar |
| `docs/manual-somos/index.html` | Manual: ficha de Psicólogos y Citas | Modificar |
| `.env.local` (no en git) + hosting | `DANTE_API_TOKEN` | Sonia |

---

### Task 1: Migración 016 y tipos

**Files:**
- Create: `Supabase/migrations/016_horarios_por_centro.sql` (carpeta `Z:ClaudeSomos PsicológosSupabasemigrations`, fuera del repo git)
- Modify: `types/database.ts:29-55`, `types/database.ts:317-331`

**Interfaces:**
- Produces (SQL): `horarios_psicologos.centro_id uuid NOT NULL REFERENCES centros(id)`, `horarios_psicologos.revisar boolean NOT NULL DEFAULT false`, `psicologos_centros.activo boolean NOT NULL DEFAULT true`, `centros.es_online boolean NOT NULL DEFAULT false`, vista `psicologos_por_centro` con columnas añadidas al final `centro_activo boolean`, `es_online boolean`.
- Produces (TS): `Centro.es_online: boolean`; `PsicologoCentro = { psicologo_id; centro_id; activo: boolean }` (Insert con `activo?`); `HorarioPsicologo` y `HorarioPsicologoInsert` con `centro_id: string` y `revisar?: boolean`; `PsicologoPorCentro` con `centro_activo: boolean; es_online: boolean`.

- [x] **Step 1: Crear la rama**

```bash
git checkout main && git pull && git checkout -b b1-horarios-por-centro
```

- [x] **Step 2: Escribir la migración**

Cabecera de contexto como en `012_horarios_psicologos.sql` (fecha 26-10-2026, por qué: reunión 21-10, horarios por centro; idempotente; se aplica de madrugada). Dentro de `BEGIN; … COMMIT;`, en este orden:

1. `ALTER TABLE centros ADD COLUMN IF NOT EXISTS es_online boolean NOT NULL DEFAULT false;` y `UPDATE centros SET es_online = true WHERE nombre ILIKE 'online';`
2. `ALTER TABLE psicologos_centros ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;` con `COMMENT`: "false = no recibe citas nuevas en este centro; cambiar y cancelar siguen permitidos".
3. `ALTER TABLE horarios_psicologos ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES centros(id);` y `ADD COLUMN IF NOT EXISTS revisar boolean NOT NULL DEFAULT false;`
4. Relleno solo de filas con `centro_id IS NULL`: para cada `psicologo_id`, el centro de `psicologos_centros` con menor `c.nombre` (subconsulta `ORDER BY c.nombre LIMIT 1`). `revisar = true` cuando el psicólogo tiene más de un centro.
5. Filas que sigan con `centro_id IS NULL` (psicólogo sin ningún centro): `DELETE` con `RAISE NOTICE` del número borrado.
6. `ALTER TABLE horarios_psicologos ALTER COLUMN centro_id SET NOT NULL;` (idempotente: no falla si ya es NOT NULL) e índice `horarios_psicologos_centro_idx ON (psicologo_id, centro_id, dia_semana, hora_inicio)`.
7. `CREATE OR REPLACE VIEW psicologos_por_centro` igual que en 014 más `pc.activo AS centro_activo, c.es_online` **al final de la lista de columnas** (Postgres solo permite añadir al final en `OR REPLACE`).
8. Comentarios de columna actualizados: `horarios_psicologos` ya no es "sin filas = sin restricción"; ahora "sin filas = no se le pueden dar citas".

Después del `COMMIT`, un `SELECT` de comprobación que liste `psicologo_id, nombre` con `revisar = true` (para que el agente revise esas fichas) y los `SELECT` de comprobación de columnas.

- [x] **Step 3: Actualizar `types/database.ts`** con los tipos del bloque Interfaces. En `PsicologoPorCentro` añadir los dos campos; en `Database.Tables.psicologos_centros.Insert` usar `Omit<PsicologoCentro,'activo'> & { activo?: boolean }`.

- [x] **Step 4: Comprobar**

Run: `npx tsc --noEmit -p tsconfig.json` → sin errores. `npm test` → verde (nada cambia aún).

- [x] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "Tipos para la migración 016: horarios por centro, centro activo y centro online"
# La migración queda en Supabase/migrations (fuera del repo); anotarlo en el tablero al cerrar.
```

---

### Task 2: `lib/fechas.ts` — ahora en Madrid

**Files:**
- Create: `lib/fechas.ts`, `lib/fechas.test.ts`

**Interfaces:**
- Produces: `export type Instante = { fecha: string; minutos: number }` (fecha `YYYY-MM-DD` en Madrid, minutos desde medianoche en Madrid). `export const ANTELACION_MIN = 120`. `export function ahoraMadrid(d: Date = new Date()): Instante`. `export function sumarMinutos(i: Instante, min: number): Instante` (no pasa de medianoche: si `minutos + min >= 1440`, devuelve `{ fecha: i.fecha, minutos: 1439 }`; basta para "ahora + 2 h" porque los huecos acaban a las 21:30).

- [x] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { ahoraMadrid, sumarMinutos, ANTELACION_MIN } from './fechas'

describe('ahoraMadrid', () => {
  it('convierte un instante UTC a fecha y minutos de Madrid (verano, +2)', () => {
    expect(ahoraMadrid(new Date('2026-07-01T22:30:00Z'))).toEqual({ fecha: '2026-07-02', minutos: 30 })
  })
  it('invierno, +1', () => {
    expect(ahoraMadrid(new Date('2026-12-01T10:05:00Z'))).toEqual({ fecha: '2026-12-01', minutos: 665 })
  })
})
describe('sumarMinutos', () => {
  it('suma dentro del día', () => {
    expect(sumarMinutos({ fecha: '2026-10-26', minutos: 600 }, ANTELACION_MIN)).toEqual({ fecha: '2026-10-26', minutos: 720 })
  })
  it('no pasa de medianoche', () => {
    expect(sumarMinutos({ fecha: '2026-10-26', minutos: 1400 }, 120)).toEqual({ fecha: '2026-10-26', minutos: 1439 })
  })
})
```

- [x] **Step 2: Ejecutar y ver fallar** — Run: `npx vitest run lib/fechas.test.ts` → FAIL (módulo no existe).

- [x] **Step 3: Implementar** con `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year, month, day, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })` y `formatToParts`.

- [x] **Step 4: Ejecutar** — Run: `npx vitest run lib/fechas.test.ts` → PASS.

- [x] **Step 5: Commit** — `git add lib/fechas.ts lib/fechas.test.ts && git commit -m "lib/fechas: ahora en Madrid y antelación mínima"`

---

### Task 3: `lib/horarios.ts` — franjas con centro y excepción Online

**Files:**
- Modify: `lib/horarios.ts`, `lib/horarios.test.ts`

**Interfaces:**
- Produces: `Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string; centro_id?: string }` (opcional para no romper a quien no lo use; la API lo exige). `export type CentroHorario = { id: string; nombre: string; es_online: boolean }`. `validarTramos(tramos: Tramo[], centros?: CentroHorario[]): string | null`. `resumenHorario(tramos: Tramo[], centros?: CentroHorario[]): string`.
- Reglas de solape (mismo día, intervalos que se cruzan; contiguos permitidos): si los dos tramos tienen el mismo `centro_id` (o alguno no tiene) → error. Si son de centros distintos y **alguno** es `es_online` → permitido. Si son de centros distintos y ninguno es online → error. Mensaje con centros: `Los tramos del martes se solapan (San Blas 10:00–14:00 y Moratalaz 13:00–17:00).` (día en minúsculas, centros por nombre). Sin `centros`: el mensaje actual `Los tramos de Martes se solapan.`
- `resumenHorario` con centros y tramos con `centro_id`: grupos por centro ordenados por nombre, `San Blas: L, X 10:00–14:00 · Online: M 16:00–20:00`; dentro de cada centro, el agrupado actual. Sin centros: comportamiento actual.

- [x] **Step 1: Tests** (añadir al `describe('validarTramos')` y a `resumenHorario`)

```ts
const C = [
  { id: 'mor', nombre: 'Moratalaz', es_online: false },
  { id: 'sb', nombre: 'San Blas', es_online: false },
  { id: 'on', nombre: 'Online', es_online: true },
]
const tc = (dia: number, ini: string, fin: string, centro_id: string): Tramo => ({ dia_semana: dia, hora_inicio: ini, hora_fin: fin, centro_id })

it('dos centros presenciales no pueden solaparse', () => {
  expect(validarTramos([tc(2, '10:00', '14:00', 'sb'), tc(2, '13:00', '17:00', 'mor')], C))
    .toBe('Los tramos del martes se solapan (San Blas 10:00–14:00 y Moratalaz 13:00–17:00).')
})
it('Online puede solaparse con un presencial', () => {
  expect(validarTramos([tc(1, '10:00', '14:00', 'mor'), tc(1, '10:00', '14:00', 'on')], C)).toBeNull()
})
it('dos franjas Online no pueden solaparse', () => {
  expect(validarTramos([tc(1, '10:00', '14:00', 'on'), tc(1, '12:00', '15:00', 'on')], C)).not.toBeNull()
})
it('contiguos de centros distintos se permiten', () => {
  expect(validarTramos([tc(1, '10:00', '14:00', 'mor'), tc(1, '14:00', '18:00', 'sb')], C)).toBeNull()
})
it('resumen agrupa por centro, centros por nombre', () => {
  expect(resumenHorario([tc(1, '10:00', '14:00', 'sb'), tc(3, '10:00', '14:00', 'sb'), tc(2, '16:00', '20:00', 'on')], C))
    .toBe('Online: M 16:00–20:00 · San Blas: L, X 10:00–14:00')
})
```

- [x] **Step 2: Ejecutar y ver fallar** — Run: `npx vitest run lib/horarios.test.ts`.
- [x] **Step 3: Implementar** (comparar pares del mismo día ordenados por inicio; la decisión "permitido" se calcula con una función interna `puedenSolaparse(a, b, centros)`).
- [x] **Step 4: Ejecutar** — `npx vitest run lib/horarios.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.json` limpio (el campo es opcional, nada más cambia).
- [x] **Step 5: Commit** — `git commit -am "Horarios: franjas con centro y excepción Online en los solapes"`

---

### Task 4: `lib/disponibilidad.ts` — estados nuevos

**Files:**
- Modify: `lib/disponibilidad.ts`, `lib/disponibilidad.test.ts`, `lib/citas-recurrentes.ts:51-67`, `lib/citas-recurrentes.test.ts` (si algún test dependía de "sin tramos = libre")

**Interfaces:**
- Consumes: `Instante`, `ANTELACION_MIN`, `sumarMinutos` de `lib/fechas.ts`.
- Produces: `EstadoHueco = 'libre' | 'ocupado' | 'pasado' | 'antelacion' | 'bloqueado' | 'fuera_horario' | 'centro_inactivo' | 'media_hora'`. `ParamsHuecos` añade `ahora?: Instante` (si falta, no se evalúan `pasado` ni `antelacion`) y `centroInactivo?: boolean` (default `false`). Orden de evaluación por hueco: `ocupado` → `pasado` → `antelacion` → `bloqueado` → `centro_inactivo` → `fuera_horario` → `media_hora` → `libre`. `pasado`: `fecha < ahora.fecha`, o misma fecha y `inicio <= ahora.minutos`. `antelacion`: misma fecha y `inicio < sumarMinutos(ahora, ANTELACION_MIN).minutos`. **Sin tramos: todos los huecos `fuera_horario`** y `trabajaEseDia([], f) === false`.
- `export const ESTADOS_VETO_DURO: EstadoHueco[] = ['ocupado', 'pasado']` (nadie, ni el agente). `export const ESTADOS_FUERA_HORARIO: EstadoHueco[] = ['bloqueado', 'fuera_horario', 'centro_inactivo']` (solo con la casilla).
- `ParamsAviso` añade `tieneAlgunHorario?: boolean` (default `true`). `motivoAviso` devuelve, en este orden: bloqueo del día (como hoy) → `tieneAlgunHorario === false` → `{nombre} no tiene horario definido` → día sin franja → `{nombre} no trabaja los {día} en {centro}` (como hoy) → por estado del hueco: `ocupado` como hoy; `pasado` → `esa hora ya ha pasado`; `antelacion` → `quedan menos de 2 horas para esa cita`; `centro_inactivo` → `{nombre} no recibe citas nuevas en {centro}`; `fuera_horario` y `media_hora` como hoy.
- `comprobarSerie`: en modo aviso vale si el estado no está en `['ocupado', 'bloqueado', 'pasado']`.

- [x] **Step 1: Tests** (sustituir el test "sin tramos siempre trabaja" y añadir)

```ts
const AHORA = { fecha: LUNES, minutos: 12 * 60 } // lunes 12:00
const conHorario = { ...base, tramos: [t(1, '09:00', '21:00')] }

it('sin tramos = fuera de horario en todos los huecos y no trabaja ese día', () => {
  expect(trabajaEseDia([], LUNES)).toBe(false)
  expect(generarHuecos(base).every((h) => h.estado === 'fuera_horario')).toBe(true)
})
it('hoy: hora ≤ ahora es pasado, menos de 2 h es antelacion, 2 h o más es libre', () => {
  const h = generarHuecos({ ...conHorario, ahora: AHORA })
  expect(estado(h, '11:00')).toBe('pasado')
  expect(estado(h, '12:00')).toBe('pasado')
  expect(estado(h, '13:00')).toBe('antelacion')
  expect(estado(h, '14:00')).toBe('libre')
})
it('fecha anterior a hoy: todo pasado; fecha futura: no aplica', () => {
  expect(generarHuecos({ ...conHorario, fecha: DOMINGO, tramos: [t(7, '09:00', '21:00')], ahora: AHORA }).every((h) => h.estado === 'pasado')).toBe(true)
  expect(estado(generarHuecos({ ...conHorario, fecha: MARTES, tramos: [t(2, '09:00', '21:00')], ahora: AHORA }), '09:00')).toBe('libre')
})
it('ocupado gana a pasado; pasado gana a bloqueado', () => {
  const h = generarHuecos({ ...conHorario, ahora: AHORA, citas: [{ fecha: LUNES, hora: '11:00:00' }], bloqueos: [{ inicio: LUNES, fin: LUNES }] })
  expect(estado(h, '11:00')).toBe('ocupado')
  expect(estado(h, '10:00')).toBe('pasado')
})
it('centro inactivo marca las horas dentro de franja; fuera de franja sigue fuera_horario', () => {
  const h = generarHuecos({ ...base, tramos: [t(1, '10:00', '14:00')], centroInactivo: true })
  expect(estado(h, '10:00')).toBe('centro_inactivo')
  expect(estado(h, '16:00')).toBe('fuera_horario')
})
it('una cita en otro centro (Online) ocupa la hora: las citas vienen de todos los centros', () => {
  const h = generarHuecos({ ...conHorario, citas: [{ fecha: LUNES, hora: '11:00' }] })
  expect(estado(h, '11:00')).toBe('ocupado')
})
describe('motivoAviso nuevos', () => {
  const p = { ...conHorario, ahora: AHORA, incluirMedias: true, nombrePsicologo: 'Jaime', nombreCentro: 'Moratalaz' }
  it('antelacion', () => expect(motivoAviso({ ...p, hora: '13:00' })).toBe('quedan menos de 2 horas para esa cita'))
  it('pasado', () => expect(motivoAviso({ ...p, hora: '11:00' })).toBe('esa hora ya ha pasado'))
  it('centro inactivo', () => expect(motivoAviso({ ...p, hora: '15:00', centroInactivo: true })).toBe('Jaime no recibe citas nuevas en Moratalaz'))
  it('sin horario en ningún centro', () => expect(motivoAviso({ ...p, tramos: [], tieneAlgunHorario: false, hora: '15:00' })).toBe('Jaime no tiene horario definido'))
})
```

En `citas-recurrentes.test.ts`: un test de que `comprobarSerie` en modo aviso descarta una fecha cuyo hueco sea `pasado` (fecha anterior a `ahora.fecha`).

- [x] **Step 2: Ejecutar y ver fallar** — `npx vitest run lib/disponibilidad.test.ts lib/citas-recurrentes.test.ts`.
- [x] **Step 3: Implementar** en `disponibilidad.ts` y `citas-recurrentes.ts`. Revisar los tests antiguos que asumían "sin tramos = libre" (`base` tiene `tramos: []`): darles un tramo `t(1,'08:00','22:00')` donde haga falta.
- [x] **Step 4: Ejecutar** — `npm test` → PASS; `npx tsc --noEmit -p tsconfig.json` limpio (en `page.tsx` y `TimeSelect` aún compila: los estados nuevos solo amplían la unión; si `SUFIJO: Record<EstadoHueco,string>` falla, añadir las tres claves ya en esta tarea con los textos de la Tarea 8).
- [x] **Step 5: Commit** — `git commit -am "Disponibilidad: pasado, antelación, centro inactivo y sin horario = sin citas"`

---

### Task 5: Carga de datos por centro (navegador y servidor) y hook

**Files:**
- Modify: `lib/disponibilidad-datos.ts`, `app/dashboard/psicologos/useDisponibilidad.ts`, `app/dashboard/psicologos/page.tsx:387` (solo la llamada al hook), `app/dashboard/calendario/page.tsx:159-172`

**Interfaces:**
- Produces: `cargarDatosDisponibilidad(cliente: SupabaseClient<Database>, p: PsicologoDisponibilidad, centroId: string): Promise<DatosDisponibilidad>` con `DatosDisponibilidad = { tramos: Tramo[]; citas: CitaOcupada[]; bloqueos: Bloqueo[]; mediaHora: boolean; tieneAlgunHorario: boolean; centroActivo: boolean }`. Tramos: **todas** las filas del psicólogo (`select('dia_semana, hora_inicio, hora_fin, centro_id')`), `tramos` = las de `centroId`, `tieneAlgunHorario = todas.length > 0`. `centroActivo`: fila de `psicologos_centros` para (psicólogo, centro) con `activo`; sin fila → `false`. Citas y bloqueos como hoy (todos los centros). `hoy` = `ahoraMadrid().fecha` (quitar el import de `eventos-activos`: ese módulo arrastra el cliente del navegador y este archivo ahora se usa en el servidor).
- `useDisponibilidad(psicologo: PsicologoDisponibilidad | null, centroId: string | null)`: clave de carga `${id}:${centroId}`; sin `centroId` no carga (`datos = null`). Pasa `supabase` de `@/lib/supabase` como cliente. En error, el fallback es `{ tramos: [], citas: [], bloqueos: [], mediaHora, tieneAlgunHorario: false, centroActivo: true }` (con el nuevo significado de "sin tramos", el fallback ya no deja agendar a cualquier hora: el mensaje de error de carga sigue mostrándose como hoy).
- Calendario: la consulta de tramos añade `centro_id`; `tramos = filtros.centroId ? todos.filter(t => t.centro_id === filtros.centroId) : todos`.

- [x] **Step 1: Cambiar firma y tipos** en `disponibilidad-datos.ts`; actualizar el hook; en `page.tsx` cambiar la llamada a `useDisponibilidad(psicologoDisp, effCentroId || null)`; en calendario, el filtro por centro.
- [x] **Step 2: Comprobar** — `npx tsc --noEmit -p tsconfig.json` limpio; `npm test` verde. Arrancar `npm run dev`, entrar como agente en Citas, elegir centro y psicólogo: la consola de red muestra la consulta a `horarios_psicologos` con `centro_id` (aún no hay columna si la migración no está aplicada en local: usar un proyecto/rama de Supabase de pruebas o aplicar la 016 en el entorno que Sonia indique; si no hay entorno, dejar la comprobación manual para la Tarea 12).
- [x] **Step 3: Commit** — `git commit -am "Disponibilidad: datos por psicólogo y centro, carga reutilizable en servidor"`

---

### Task 6: `lib/huecos-dante.ts` — próximos huecos y motivos (puro)

**Files:**
- Create: `lib/huecos-dante.ts`, `lib/huecos-dante.test.ts`

**Interfaces:**
- Consumes: `generarHuecos`, `DatosDisponibilidad`, `Instante`, `sumarMinutos`, `ANTELACION_MIN`.
- Produces:
  - `export const DIAS_VISTA = 14`, `export const MAX_HUECOS = 10`.
  - `export type HuecoFecha = { fecha: string; hora: string }`.
  - `export type MotivoSinHuecos = 'sin_horario_en_centro' | 'centro_inactivo' | 'sin_huecos' | 'psicologo_inactivo'`.
  - `export function sumarDias(fecha: string, n: number): string` (aritmética en UTC sobre `YYYY-MM-DD`, como `diaSemanaISO`).
  - `export function proximosHuecos(datos: DatosDisponibilidad, ahora: Instante, desde?: string, max = MAX_HUECOS, dias = DIAS_VISTA): HuecoFecha[]` — recorre desde `max(desde ?? ahora.fecha, ahora.fecha)` durante `dias` días, `generarHuecos({ ...datos, fecha, incluirMedias: false, ahora, centroInactivo: !datos.centroActivo })`, solo `libre`, hasta `max`.
  - `export function motivoSinHuecos(datos: DatosDisponibilidad): MotivoSinHuecos` — `!centroActivo` → `centro_inactivo`; `tramos.length === 0` → `sin_horario_en_centro`; si no `sin_huecos`.
  - `export function elegirMasProximo<T extends { nombre: string; huecos: HuecoFecha[] }>(candidatos: T[]): T | null` — el de primer hueco más temprano (`fecha` y luego `hora`); empate por `nombre` (localeCompare); sin candidatos con huecos → `null`.
  - `export function comprobarHueco(datos: DatosDisponibilidad, ahora: Instante, fecha: string, hora: string, excluirAccionId?: string): { ok: true } | { ok: false; motivo: EstadoHueco | 'hora_no_valida' }` — `centroInactivo: !datos.centroActivo && !excluirAccionId`; hora no presente en la rejilla (`10:15`) → `hora_no_valida`.

- [x] **Step 1: Tests**

```ts
const AHORA = { fecha: '2026-10-26', minutos: 10 * 60 } // lunes 10:00
const datos = (extra: Partial<DatosDisponibilidad> = {}): DatosDisponibilidad => ({
  tramos: [t(1, '09:00', '13:00'), t(2, '16:00', '18:00')], citas: [], bloqueos: [], mediaHora: false, tieneAlgunHorario: true, centroActivo: true, ...extra,
})
it('salta las horas pasadas y las de menos de 2 h; lista en orden y corta en max', () => {
  expect(proximosHuecos(datos(), AHORA, undefined, 3)).toEqual([
    { fecha: '2026-10-26', hora: '12:00' }, { fecha: '2026-10-27', hora: '16:00' }, { fecha: '2026-10-27', hora: '17:00' },
  ])
})
it('desde una fecha futura empieza ahí; desde una pasada empieza hoy', () => {
  expect(proximosHuecos(datos(), AHORA, '2026-10-27', 1)).toEqual([{ fecha: '2026-10-27', hora: '16:00' }])
  expect(proximosHuecos(datos(), AHORA, '2026-10-20', 1)).toEqual([{ fecha: '2026-10-26', hora: '12:00' }])
})
it('no mira más allá de 14 días', () => {
  expect(proximosHuecos(datos({ tramos: [] }), AHORA)).toEqual([])
  expect(proximosHuecos(datos({ tramos: [t(1, '09:00', '13:00')], bloqueos: [{ inicio: '2026-10-26', fin: '2026-11-30' }] }), AHORA)).toEqual([])
})
it('motivoSinHuecos', () => {
  expect(motivoSinHuecos(datos({ centroActivo: false }))).toBe('centro_inactivo')
  expect(motivoSinHuecos(datos({ tramos: [] }))).toBe('sin_horario_en_centro')
  expect(motivoSinHuecos(datos())).toBe('sin_huecos')
})
it('elegirMasProximo: más temprano, empate por nombre', () => {
  const a = { nombre: 'Marta', huecos: [{ fecha: '2026-10-27', hora: '16:00' }] }
  const b = { nombre: 'Jaime', huecos: [{ fecha: '2026-10-27', hora: '16:00' }] }
  const c = { nombre: 'Ana', huecos: [] as HuecoFecha[] }
  expect(elegirMasProximo([a, b, c])).toBe(b)
  expect(elegirMasProximo([c])).toBeNull()
})
it('comprobarHueco', () => {
  expect(comprobarHueco(datos(), AHORA, '2026-10-26', '12:00')).toEqual({ ok: true })
  expect(comprobarHueco(datos(), AHORA, '2026-10-26', '11:00')).toEqual({ ok: false, motivo: 'antelacion' })
  expect(comprobarHueco(datos(), AHORA, '2026-10-26', '10:15')).toEqual({ ok: false, motivo: 'hora_no_valida' })
  expect(comprobarHueco(datos({ centroActivo: false }), AHORA, '2026-10-27', '16:00')).toEqual({ ok: false, motivo: 'centro_inactivo' })
  expect(comprobarHueco(datos({ centroActivo: false }), AHORA, '2026-10-27', '16:00', 'acc-1')).toEqual({ ok: true })
})
```

- [x] **Step 2: Ejecutar y ver fallar** — `npx vitest run lib/huecos-dante.test.ts`.
- [x] **Step 3: Implementar.**
- [x] **Step 4: Ejecutar** — PASS; tsc limpio.
- [x] **Step 5: Commit** — `git add lib/huecos-dante.ts lib/huecos-dante.test.ts && git commit -m "Huecos para Dante: próximos huecos, motivo y comprobación (módulo puro)"`

---

### Task 7: API de usuarios — horario con centro, interruptor por centro

**Files:**
- Modify: `app/api/usuarios/route.ts:13-76`, `app/api/usuarios/[id]/route.ts:9-108`, `app/dashboard/_components/gestion.tsx:12-24`

**Interfaces:**
- GET `/api/usuarios`: `psicologos[].horarios: Tramo[]` con `centro_id`; nuevo `psicologos[].centros_inactivos: string[]` (ids con `psicologos_centros.activo = false`); nuevo `psicologos[].horario_revisar: boolean` (alguna fila con `revisar`); `centros[]` ahora `{ id, nombre, es_online }`. Consultas: `psicologos_centros.select('psicologo_id, centro_id, activo')`, `horarios_psicologos.select('psicologo_id, dia_semana, hora_inicio, hora_fin, centro_id, revisar')`, `centros.select('id, nombre, es_online')`.
- PATCH `/api/usuarios/[id]` (`tipo: 'psicologo'`):
  - `horarios?: Tramo[]`: cada tramo debe traer `centro_id` perteneciente a los centros del psicólogo (si no, 400 `Cada franja necesita un centro del psicólogo`); `validarTramos(nuevos, centrosDelPsicologo)` con `CentroHorario[]` leídos de `centros`; insert con `revisar: false`. Reposición en caso de fallo igual que hoy (incluyendo `centro_id`).
  - `centro_ids?: string[]`: antes de borrar, leer `activo` actual por centro; reinsertar conservando `activo` de los que ya existían (nuevos `true`); después, `delete` de `horarios_psicologos` del psicólogo con `centro_id` **no** incluido en la lista nueva.
  - Nuevo `centro_activo?: { centro_id: string; activo: boolean }`: `update psicologos_centros set activo where psicologo_id and centro_id`; 400 si no existe la fila (`El psicólogo no trabaja en ese centro`).
- `gestion.tsx`: `PsicologoGestion` añade `centros_inactivos: string[]; horario_revisar: boolean`; `CentroGestion = { id; nombre; es_online: boolean }`.

- [x] **Step 1: Implementar GET y tipos** (`gestion.tsx`).
- [x] **Step 2: Implementar PATCH** (los tres puntos).
- [x] **Step 3: Comprobar** — tsc limpio; `npm test` verde; con `npm run dev` y sesión de agente: `curl -s http://localhost:3000/api/usuarios` (con cookie) muestra `centros_inactivos` y `horario_revisar`. Si no hay base con la 016, dejarlo para la Tarea 12.
- [x] **Step 4: Commit** — `git commit -am "API usuarios: horario por centro, centro activo y centro online"`

---

### Task 8: Ficha de Psicólogos y editor de horario por centro

**Files:**
- Modify: `app/dashboard/_components/HorarioEditor.tsx`, `app/dashboard/equipo/FichaPsicologo.tsx`, `app/dashboard/equipo/page.tsx`

**Interfaces:**
- Consumes: GET/PATCH de la Tarea 7; `validarTramos(tramos, centros)`, `resumenHorario(tramos, centros)` de la Tarea 3.
- `HorarioEditor` props: añade `centros: CentroGestion[]` (solo los del psicólogo, orden por nombre). Estado `centroActual` (el primero). Arriba, pastillas con los centros (estilo `pill` de `gestion.tsx`); cada día muestra editables solo los tramos del `centroActual` y, en gris y sin controles, los de los otros centros (`Moratalaz 10:00–14:00`). "+ Añadir tramo" crea `{ dia_semana, hora_inicio: '09:00', hora_fin: '14:00', centro_id: centroActual }`. `guardar()` valida con `validarTramos(tramos, centros)` y llama a `onGuardar(tramos)` con **todos** los tramos. Subtítulo fijo: `Cada franja pertenece a un centro. Una franja de Online puede coincidir con una presencial; dos presenciales no.`
- `FichaPsicologo`: bajo las chips de Centros, por cada centro de `p.centro_ids` una fila `{nombre del centro}` + `Interruptor` etiqueta `Recibe citas nuevas` (activo = `!p.centros_inactivos.includes(id)`), `onChange` → `guardar({ centro_activo: { centro_id, activo: !activo } })`. Fila Horario: `resumenHorario(p.horarios, centros)`; sin horarios → texto rojo `Sin horario: no se le pueden dar citas`; `p.horario_revisar` → texto ámbar `Horario asignado automáticamente a {centro}: revísalo` (centro = nombre del `centro_id` de la primera franja). `guardarBorrador`: si quita un centro que tiene franjas, `window.confirm('Al quitar {centro} se borrarán sus franjas de horario. ¿Continuar?')`.
- `equipo/page.tsx`: columna Horario: sin horarios → `Sin horario` en rojo (`#b91c1c`) y, si `p.activo`, un punto rojo delante (`●`); "Centros y tipos": los centros apagados con sufijo ` (no recibe citas nuevas)`. `guardar()` actualiza en local `centros_inactivos` al recibir `centro_activo`, y `horario_revisar = false` al recibir `horarios`. Al abrir el editor pasa `centros={centros.filter(c => abierto.centro_ids.includes(c.id))}` y quita el subtítulo "vale para todos sus centros".

- [x] **Step 1: HorarioEditor** por centro.
- [x] **Step 2: FichaPsicologo** (interruptores, textos, confirm).
- [x] **Step 3: equipo/page.tsx** (tabla y actualización local).
- [x] **Step 4: Comprobar** — tsc limpio; `npm test`; en `npm run dev` (con base 016): guardar L 10–14 Moratalaz + L 13–17 San Blas → error de solape con los nombres; L 10–14 Moratalaz + L 10–14 Online → guarda; apagar un centro → la fila lo muestra con el sufijo; quitar un centro con franjas → confirm y las franjas desaparecen.
- [x] **Step 5: Commit** — `git commit -am "Psicólogos: horario por centro, interruptor por centro y sin horario en rojo"`

---

### Task 9: Formulario de Citas — casilla, estados y mensajes

**Files:**
- Modify: `app/dashboard/_components/TimeSelect.tsx:14-20`, `app/dashboard/psicologos/page.tsx` (zonas: estado ~198–290, carga ~296–323, disponibilidad ~382–422, `handleSubmit` ~845–910, selector de centro del psicólogo ~1133, desplegable de psicólogo ~1405–1420, fecha/hora ~1808–1855)

**Interfaces:**
- Consumes: `useDisponibilidad(psicologo, centroId)`; `generarHuecos` con `ahora` y `centroInactivo`; `motivoAviso` con `tieneAlgunHorario`; `ESTADOS_VETO_DURO`, `ESTADOS_FUERA_HORARIO`; `ahoraMadrid`.
- `TimeSelect.SUFIJO`: `pasado: ' · ya ha pasado'`, `antelacion: ' · menos de 2 h'`, `centro_inactivo: ' · no recibe citas nuevas'`. Nuevo prop opcional `ocultar?: EstadoHueco[]` (estados que no se listan); `ocupado` sigue listándose deshabilitado.
- `page.tsx`:
  - `const [ahora, setAhora] = useState(() => ahoraMadrid())` con `setInterval` cada 60 s.
  - `psicologosCentros` se carga con `activo` (`select('psicologo_id, centro_id, activo')`); `misCentros` pasa a `{ id: string; activo: boolean }[]` (o se añade `misCentrosApagados: Set<string>`; elegir lo que menos toque).
  - `esAgendar = accion === 'Agendar cita'`; `centroInactivo = esAgendar && !!disp && !disp.centroActivo`.
  - `huecos = generarHuecos({ ...disp, fecha, incluirMedias: modo === 'aviso', excluirAccionId, ahora, centroInactivo })`.
  - Nuevo estado `citarFueraHorario` (solo agente, `false` por defecto; se resetea al cambiar de psicólogo). Casilla encima del selector de hora con la etiqueta `Citar fuera de horario`, visible solo en modo aviso.
  - `TimeSelect`: `soloLibres={restringido}`; `ocultar={restringido ? [] : citarFueraHorario ? ['pasado'] : ['pasado', ...ESTADOS_FUERA_HORARIO]}`.
  - `min={todayISODate()}` en el input de fecha para todos los roles.
  - Mensajes fijos bajo la hora (modo restringido, en este orden, solo uno): `disp && !disp.tieneAlgunHorario` → `{nombre} no tiene horario: pídele a un agente que lo defina en Psicólogos.`; `centroInactivo` → `{nombre} no recibe citas nuevas en {centro}`; bloqueo / día sin franja / sin huecos como hoy. `sinHorasHoy` incluye los dos casos nuevos.
  - Modo aviso: si `!disp.tieneAlgunHorario`, nota gris `{nombre} no tiene horario definido` bajo la casilla. `avisoDisp` usa `motivoAviso({ ..., ahora, centroInactivo, tieneAlgunHorario: disp.tieneAlgunHorario })`.
  - `handleSubmit`: restringido como hoy. Modo aviso: si el hueco elegido tiene estado en `ESTADOS_VETO_DURO`: `ocupado` → mensaje actual; `pasado` → `Esa hora ya ha pasado. Elige otra.`
  - Desplegable de psicólogos (agente y call center): opción con sufijo ` (no recibe citas nuevas)` cuando `psicologos_centros.activo === false` para ese centro (además del ` (inactivo)` actual). Selector "¿En qué centro vas a trabajar hoy?": sufijo ` (no recibe citas nuevas)` en los apagados.
  - Series: `comprobarSerie(fechas, hora, { ...disp, ahora, centroInactivo }, restringido)`.
  - `useEffect` que vacía la hora al cambiar la fecha: en modo aviso vacía si el estado está en `ESTADOS_VETO_DURO`.

- [x] **Step 1: TimeSelect** (sufijos y `ocultar`).
- [x] **Step 2: page.tsx** (todos los puntos).
- [x] **Step 3: Comprobar** — tsc limpio; `npm test`; en `npm run dev` con base 016 y un psicólogo con franja L 10–14 Moratalaz y L 16–20 San Blas: agente ve solo 10–13 en Moratalaz; marca la casilla y ve el resto con sufijos; elige 15:00 → aviso; hoy a una hora pasada no aparece; call center ve solo 10–13; psicóloga sin horario → mensaje fijo y sin horas (call center), nota + casilla (agente).
- [x] **Step 4: Commit** — `git commit -am "Citas: casilla fuera de horario, antelación, pasado y centro sin citas nuevas"`

---

### Task 10: Endpoint `/api/disponibilidad` para Dante

**Files:**
- Create: `app/api/disponibilidad/route.ts`, `lib/disponibilidad-servidor.ts`
- Modify: `.env.local` (Sonia: `DANTE_API_TOKEN=<cadena larga aleatoria>`)

**Interfaces:**
- Consumes: `createSupabaseAdmin`, `cargarDatosDisponibilidad(admin, p, centroId)`, `proximosHuecos`, `motivoSinHuecos`, `elegirMasProximo`, `comprobarHueco`, `ahoraMadrid`.
- `lib/disponibilidad-servidor.ts`:
  - `export type PeticionDisponibilidad = { tipo: 'psicologo'; centro_id: string; psicologo_id: string; fecha_deseada?: string; tipo_consulta?: TipoCita } | { tipo: 'centro'; centro_id: string; fecha_deseada?: string; tipo_consulta?: TipoCita } | { tipo: 'comprobar'; psicologo_id: string; centro_id: string; fecha: string; hora: string; excluir_accion_id?: string }`.
  - `export type RespuestaHuecos = { psicologo_id: string | null; psicologo_nombre: string | null; huecos: HuecoFecha[]; motivo?: MotivoSinHuecos; centros_alternativos?: { centro_id: string; nombre: string; primer_hueco: HuecoFecha }[] }`.
  - `export type RespuestaComprobar = { ok: true } | { ok: false; motivo: string }`.
  - `export async function resolverDisponibilidad(admin: SupabaseClient<Database>, req: PeticionDisponibilidad, ahora: Instante): Promise<RespuestaHuecos | RespuestaComprobar>`.
  - `tipo: 'psicologo'`: psicólogo (`id, nombre, activo, calendar_id, citas_media_hora`) → `!activo` ⇒ `motivo: 'psicologo_inactivo'`, `huecos: []`. Datos del centro → `proximosHuecos`. Si vacío: `motivo = motivoSinHuecos(datos)` y `centros_alternativos` = para cada otro centro del psicólogo con `psicologos_centros.activo` y franjas, el primer hueco (`proximosHuecos(..., max 1)`), omitiendo los que no tengan.
  - `tipo: 'centro'`: psicólogos del centro (`psicologos_centros.activo = true`, `psicologos.activo = true`, y `tipos_consulta` contiene `tipo_consulta` si viene); por cada uno `proximosHuecos`; `elegirMasProximo`; sin ninguno ⇒ `{ psicologo_id: null, psicologo_nombre: null, huecos: [], motivo: 'sin_huecos' }`.
  - `tipo: 'comprobar'`: psicólogo inactivo ⇒ `{ ok: false, motivo: 'psicologo_inactivo' }`; si no, `comprobarHueco(datos, ahora, fecha, hora, excluir_accion_id)`.
- `route.ts`: `POST`. Sin `process.env.DANTE_API_TOKEN` → 500 `{ error: 'DANTE_API_TOKEN no configurado' }`. Cabecera `Authorization` ≠ `Bearer <token>` → 401. Cuerpo que no cumpla `tipo` o falten campos → 400 con `{ error }`. Respuesta 200 con el JSON de `resolverDisponibilidad`. `export const dynamic = 'force-dynamic'`.
- `proxy.ts` (el middleware de sesión): comprobar que `/api/disponibilidad` no exige sesión (si el matcher protege `/api/*`, excluir esta ruta).

- [x] **Step 1: `lib/disponibilidad-servidor.ts`** (sin tests unitarios: orquesta consultas; la lógica ya está testeada en las Tareas 4 y 6).
- [x] **Step 2: `route.ts`** y revisión de `proxy.ts`.
- [x] **Step 3: Comprobar** — tsc limpio; con `npm run dev` y `DANTE_API_TOKEN=prueba` en `.env.local`:

```bash
curl -s -X POST http://localhost:3000/api/disponibilidad -H "Authorization: Bearer prueba" -H "Content-Type: application/json" \
  -d '{"tipo":"psicologo","centro_id":"<uuid>","psicologo_id":"<uuid>"}'
curl -s -X POST http://localhost:3000/api/disponibilidad -H "Authorization: Bearer mal" -d '{}'   # → 401
curl -s -X POST http://localhost:3000/api/disponibilidad -H "Authorization: Bearer prueba" -H "Content-Type: application/json" \
  -d '{"tipo":"comprobar","centro_id":"<uuid>","psicologo_id":"<uuid>","fecha":"2026-10-27","hora":"10:15"}'   # → {"ok":false,"motivo":"hora_no_valida"}
```

- [x] **Step 4: Commit** — `git add app/api/disponibilidad lib/disponibilidad-servidor.ts && git commit -m "API de disponibilidad para Dante: huecos por centro y comprobación"`

---

### Task 11: Dante — huecos desde la app y comprobación antes de Make

**Files:**
- Modify (fuera del repo git; copia previa en `_backups/`): `n8n/tools/_comun.js:15-21` (constantes) y helpers, `n8n/tools/ejecutar-accion.js` (bloque "Fecha, hora y tipo" y antes de "Enviar a Make"), `n8n/tools/build-workflow.mjs:89-98` (ListarPsicologos y BuscarDisponibilidad), `n8n/prompts/somos-system-prompt.md:70-85`
- Regenerar: `n8n/workflows/somos-main-agent.json`

**Interfaces:**
- `_comun.js`: `const APP_URL = 'https://somos.eltodi.net'; const APP_API_TOKEN = '__DANTE_API_TOKEN__';` y `async function appPost(ruta, body)` (`POST APP_URL + ruta`, cabeceras `Authorization: Bearer APP_API_TOKEN`, `Content-Type: application/json`, devuelve el JSON).
- `build-workflow.mjs`: `const DANTE_API_TOKEN = process.env.DANTE_API_TOKEN; if (!DANTE_API_TOKEN) throw new Error('Falta DANTE_API_TOKEN');` y `codigo()` sustituye `__DANTE_API_TOKEN__`. Nodo `BuscarDisponibilidad`: `url: APP_URL + '/api/disponibilidad'`, `sendHeaders: true`, `headerParameters: { parameters: [{ name: 'Authorization', value: 'Bearer ' + DANTE_API_TOKEN }] }`, mismo `jsonBody` (+ placeholder opcional `tipo_consulta`). `toolDescription` ampliada: "Si `huecos` viene vacío, `motivo` dice por qué (`sin_horario_en_centro`, `centro_inactivo`, `sin_huecos`, `psicologo_inactivo`) y `centros_alternativos` lista otros centros del psicólogo con su primer hueco: ofrécelos antes de dar por imposible la cita." Nodo `ListarPsicologos`: URL con `&centro_activo=eq.true`.
- `ejecutar-accion.js`: tras resolver `psicologoId`, `centroId`, `fecha`, `hora` y solo para `Agendar cita` / `Cambiar cita`: `const chk = await appPost('/api/disponibilidad', { tipo: 'comprobar', psicologo_id, centro_id, fecha, hora, excluir_accion_id: citaSel ? citaSel.id : undefined })`; si `!chk.ok` → `fail(TEXTO[chk.motivo] || 'Esa hora no está disponible. Ofrece otra de BuscarDisponibilidad.', { motivo: chk.motivo })` con `TEXTO = { ocupado: 'Esa hora ya está ocupada.', pasado: 'Esa hora ya ha pasado.', antelacion: 'Las citas necesitan al menos 2 horas de antelación.', bloqueado: 'La agenda del psicólogo está bloqueada ese día.', fuera_horario: 'Esa hora queda fuera del horario del psicólogo en ese centro.', centro_inactivo: 'El psicólogo no recibe citas nuevas en ese centro ahora mismo.', media_hora: 'Ese psicólogo solo tiene citas en punto.', hora_no_valida: 'Las citas empiezan en punto o y media entre 08:00 y 21:30.', psicologo_inactivo: 'El psicólogo no está disponible: deriva al equipo con ContactarAgente.' }` seguido de ` Ofrece al paciente otra hora de BuscarDisponibilidad.`. Si la llamada falla por red → `fail('No se ha podido comprobar la disponibilidad. Inténtalo de nuevo o deriva al equipo.')` (no se manda a Make).
- Prompt, sección CONSULTAR DISPONIBILIDAD: añadir que si `huecos` está vacío y hay `centros_alternativos`, se ofrecen esos centros ("Jaime no tiene hueco en Moratalaz estas dos semanas, pero en San Blas tiene el martes a las 16:00, ¿te vendría bien?"); solo si no hay alternativas se registra "Sin disponibilidad". Y en GESTIÓN DE CITAS: si [EjecutarAccion] responde con `motivo`, no insistir con la misma hora: explicar el motivo con las palabras que devuelve y ofrecer otro hueco.

- [x] **Step 1: `_comun.js` y `ejecutar-accion.js`.**
- [x] **Step 2: `build-workflow.mjs` y prompt.**
- [x] **Step 3: Regenerar** — `DANTE_API_TOKEN=<el mismo de .env.local> node n8n/tools/build-workflow.mjs` (en PowerShell: `$env:DANTE_API_TOKEN='…'; node n8n/tools/build-workflow.mjs`). Comprobar en el JSON que `BuscarDisponibilidad.parameters.url` apunta a la app y que el código de `EjecutarAccion` contiene `appPost`.
- [x] **Step 4: Apartado para Sonia** (escribir en `docs/dante-cambios-2026-10-b1.md`): 1) poner `DANTE_API_TOKEN` en el hosting de somos.eltodi.net y desplegar; 2) importar el JSON en un workflow **copia** de n8n, probar con un chat de prueba: pedir huecos (deben caer en franja y con más de 2 h), intentar agendar "a las 10:15" (rechazo), agendar un hueco válido (Make lo procesa como siempre); 3) importar en el workflow de producción; 4) desactivar el escenario de Make de disponibilidad (webhook `dthvwqk…`) cuando lleve una semana sin usarse.
- [x] **Step 5: Commit** — `git add docs/dante-cambios-2026-10-b1.md && git commit -m "Dante: huecos desde la app y comprobación antes de agendar (instrucciones)"`. Los archivos de `n8n/` están fuera del repo: copia previa en `n8n/tools/_backups/` y `n8n/workflows/_backups/` con fecha, y nota en el tablero.

---

### Task 12: Puesta en marcha, manual y cierre del bloque

**Files:**
- Modify: `docs/manual-somos/index.html` (ficha Psicólogos: horario por centro, interruptor por centro, "Sin horario"; ficha Citas: casilla, antelación, pasado; Novedades; fecha de versión), `docs/backlog-2026-10-21.md` (B1), este plan (casillas)

- [ ] **Step 1: Migración 016** (archivo listo: `Supabase/migrations/016_horarios_por_centro.sql`) — Sonia la aplica en el SQL Editor **de madrugada** o con Dante y Make parados. Anotar aquí la fecha: `Aplicada el: ______`. Revisar el `SELECT` final (psicólogos con `revisar = true`) y avisar a un agente para que repase esos horarios en Psicólogos.
- [ ] **Step 2: Variable `DANTE_API_TOKEN`** en el hosting y en `.env.local` (en `.env.local` ya está desde el 29-10-2026; el JSON de n8n se generó con ese valor: usa el mismo en el hosting). Anotar: `Puesta el: ______`.
- [ ] **Step 3: Pruebas de aceptación** (las 6 de la especificación, apartado "Comprobación de aceptación") contra la app desplegada desde la rama o en local con la base ya migrada. Marcar cada una:
  - [ ] 1 Jaime L 10–14 Moratalaz / L 16–20 San Blas
  - [ ] 2 Solape presencial rechazado; Online admitido; una sola cita a las 11
  - [ ] 3 Centro apagado: call center bloqueado al agendar, agente con aviso; cambiar/cancelar siguen
  - [ ] 4 Psicóloga sin horario
  - [ ] 5 Hoy a las 12:00: 11:00 nadie, 13:00 solo agente con aviso, 14:30 todos
  - [ ] 6 Dante: huecos reales y rechazo de hora inventada
- [x] **Step 4: Manual** — actualizar `index.html` según `docs/manual-somos/README.md`, `node docs/manual-somos/check-manual.mjs` → OK, republicar al artifact `FWj2hP27NkTXLFMUQvBuqi`.
  **Quedó así (29-10-2026):** `index.html` actualizado y `check-manual.mjs` OK (versión 29-10-2026). **Falta republicar el artifact**: se hace en el Step 5, con el merge, para que el manual no describa funciones que aún no están en producción.
- [ ] **Step 5: Merge** — `git checkout main && git merge b1-horarios-por-centro && git push` solo de madrugada (regla del método). Tablero: tareas 13, 28, 46, 47, 31 → `hecha`; B1 → `hecha` en la tabla de orden; nota en B2 de que `cargarDatosDisponibilidad` ya devuelve franjas por centro.
- [ ] **Step 6: Commit** — `git commit -am "B1 cerrado: manual, tablero y plan"`

---

## Decisiones tomadas al ejecutar (29-10-2026)

1. **Tarea 1:** `HorarioPsicologoInsert.centro_id` obligatorio rompía la compilación de la API de usuarios; se adelantó lo mínimo de la Tarea 7 (cada franja recibida trae `centro_id`) en vez de relajar el tipo.
2. **Tarea 4:** `centro_inactivo` se evalúa **después** de `fuera_horario` (el plan decía antes, pero su propio test exigía que fuera de franja siguiera siendo `fuera_horario`): solo marca las horas dentro de franja. Los sufijos nuevos de `TimeSelect` se añadieron ya en esta tarea.
3. **Tarea 11:** no había `DANTE_API_TOKEN`; se generó uno aleatorio y se guardó en `.env.local` para poder regenerar el workflow. Sonia debe poner el mismo valor en el hosting.
4. **Tarea 12:** el manual se actualiza en la rama pero el artifact no se republica hasta el merge.
5. **Archivos fuera del repo cambiados:** `Supabase/migrations/016_horarios_por_centro.sql` (nuevo); `n8n/tools/_comun.js`, `n8n/tools/ejecutar-accion.js`, `n8n/tools/build-workflow.mjs`, `n8n/prompts/somos-system-prompt.md`, `n8n/workflows/somos-main-agent.json` (copias `*.2026-10-29.bak` en sus `_backups/`).

## Revisión final (29-10-2026)

Revisor independiente sobre `9187792..83959ca`: **sin críticos**. Tres importantes, arreglados en el commit "Revisión B1": fechas con formato válido pero inexistentes devolvían 500 (ahora 400, `validarPeticion` en `lib/disponibilidad-servidor.ts` con test); `tipos_consulta` vacío excluía al psicólogo en `tipo=centro` (ahora vale para todo, como en el formulario); en modo aviso se podía enviar mientras cargaba la disponibilidad saltándose los vetos duros (guarda para ambos modos).

Menores diferidos (no bloquean el merge; para una tanda pequeña después de B1):

1. TimeSelect relista como libre una hora fuera de horario si se desmarca la casilla con ella elegida: vaciar `hora` al desmarcar.
2. Token comparado sin tiempo constante (`crypto.timingSafeEqual`).
3. `centro_id` inexistente responde `motivo: centro_inactivo` en vez de 400.
4. `tipo=centro` y `centros_alternativos` cargan psicólogos en serie: `Promise.all`.
5. `build-workflow.mjs`: `.replace(re, () => token)` para blindar `$&`.
6. `ejecutar-accion.js`: en `necesita_centro` ofrece también centros apagados (leer `activo`); quitar la frase interna de `TEXTO_MOTIVO.psicologo_inactivo`.
7. Migración 016: dejar vivo (sin `--`) el `SELECT` de `revisar` como última sentencia para que el SQL Editor muestre la lista de fichas a revisar.
8. Tests baratos: `validarTramos` con centros y horas con segundos; estado 13:30 con `incluirMedias`.
9. Documentar la ventana inversa (si la 016 se aplica antes del deploy, guardar horario desde Psicólogos falla hasta el deploy) y que en la prueba de aceptación 3 el call center **sí ve** al psicólogo con sufijo pero no puede agendar (Decisión 1).
10. eslint del proyecto: 5 avisos preexistentes en archivos que B1 no toca.
