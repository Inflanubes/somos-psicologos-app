# B2 — Calendario propio con huecos libres — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revisar al empezar:** este plan se escribió el 26-10-2026 contra el código de `main` + las interfaces que fija el plan de B1 (`generarHuecos` con `ahora` y `centroInactivo`, `Tramo.centro_id`, `cargarDatosDisponibilidad(cliente, p, centroId)`, `DatosDisponibilidad.tieneAlgunHorario/centroActivo`). B1 debe estar en `main` antes de empezar. Comprobar con `git log` y con `lib/disponibilidad.ts` que esas firmas existen tal cual; si B1 las cambió, adaptar aquí antes de la Tarea 1.

**Goal:** Un calendario semanal propio con huecos libres, colores por estado, bloqueos hora a hora y clic que rellena el formulario, usado en Calendario y en Citas (sustituye al iframe de Google), con refresco automático y selector de centros "Todos" para el psicólogo.

**Architecture:** La lógica (eventos libres, primera cita, bloqueos por hora, colores, modo contador, cambios locales) va en módulos puros `lib/calendario.ts` y `lib/calendario-huecos.ts` con tests. `lib/calendario-datos.ts` carga de Supabase. Un componente `CalendarioAgenda` (en `app/dashboard/_components/`) encapsula navegación, carga, leyenda, casilla "Ver anuladas" y clics; `AgendaSemanal` sigue siendo la rejilla. Las dos páginas (Calendario y Citas) solo le pasan filtros y callbacks.

**Tech Stack:** Next.js App Router + TypeScript, Supabase JS v2, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-b2-calendario-propio-design.md`. Tablero: `docs/backlog-2026-10-21.md` (B2). Método: `docs/metodo-trabajo.md`.

## Global Constraints

- Rama `b2-calendario-propio` desde `main` (con B1 ya fusionado). Commits en español. Cada tarea: `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` verde.
- Fechas `YYYY-MM-DD`, semana de lunes a domingo (`lunesDeSemana`), `ahora` inyectado (`ahoraMadrid()` de B1).
- Colores por estado exactos (tabla de la especificación): libre `#e3edff/#2f5aae/#1f3f80`; cita `#fee2e2/#dc2626/#7f1d1d`; primera `#fff1dc/#ed8f0c/#8a5200`; anulada fondo `#ffffff`, borde `#dc2626` discontinuo, texto `#991b1b` tachado; bloqueo `#e5e7eb/#4b5563/#1f2937`.
- Textos: `Ver anuladas` · leyenda `Libre`, `Ocupada`, `Primera cita`, `Anulada`, `Bloqueada` · chip `{N} libres` / `1 libre` · pastilla `Todos` · vacío `No hay citas ni huecos esta semana con los filtros elegidos.`
- Google Calendar desaparece de la app (iframes y CSS). No se añade enlace: se consultará con el cliente el día de la entrega.
- Sin cambios en Supabase, Make ni Dante en este bloque.

## Review Focus

1. **Hora libre en dos centros a la vez** (franja Online solapada con presencial, de B1) sin filtro de centro: un solo bloque libre con `centros` = los dos; con filtro, solo el del centro (Tarea 1).
2. **Cita de psicólogo con `citas_media_hora`** a las 10:30 y hueco libre: los libres de 10:00 y 11:00 no se ofrecen (ocupan 60 min); el libre de 11:30 sí (Tarea 1, por `generarHuecos`).
3. **Semana pasada**: no se calculan libres (todo `pasado`) y la página no se rompe al navegar hacia atrás (Tarea 1 y 3).
4. **Anular y volver a ver**: tras anular, la cita desaparece en local; con "Ver anuladas" marcada aparece tachada aunque Make aún no haya escrito (Tarea 1 `aplicarAccionLocal`, Tarea 4).
5. **Parámetros de URL incompletos o con ids que ya no existen** (`?accion=cambiar&cita=xxx` de una cita ya anulada): el formulario no se queda en un estado inválido, muestra el error "No encontramos esa cita" y sigue usable (Tarea 4).

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `lib/calendario.ts` (+ `.test.ts`) | Tipos de evento ampliados, colores por estado, `modoContador`, `filtrarEventos` con libres/anuladas | Modificar |
| `lib/calendario-huecos.ts` (+ `.test.ts`) | `calcularLibres`, `bloqueosPorHora`, `marcarPrimeras`, `aplicarAccionLocal` (puro) | Crear |
| `lib/calendario-datos.ts` | `cargarSemanaCalendario(cliente, …)` | Crear |
| `app/dashboard/_components/CalendarioAgenda.tsx` | Componente contenedor (semana, carga, leyenda, anuladas, clics, móvil) | Crear |
| `app/dashboard/calendario/AgendaSemanal.tsx` | Rejilla: libres, anuladas, bloqueos por hora, chips de contador, clics | Modificar (mover a `_components/`) |
| `app/dashboard/calendario/page.tsx` | Solo filtros + `CalendarioAgenda` + navegación a Citas | Modificar |
| `app/dashboard/psicologos/page.tsx` | Sustituir iframe, clics, URL, refresco, pastillas de centro | Modificar |
| `lib/centro-activo.ts` | `centroId: 'todos'` válido | Modificar |
| `app/globals.css` | Quitar `.cal-desktop` / `.cal-mobile`; estilos de chip y popover | Modificar |
| `docs/manual-somos/index.html` | Fichas Calendario y Citas | Modificar |

---

### Task 1: Módulos puros — eventos libres, anuladas, bloqueos por hora, primera cita, colores

**Files:**
- Modify: `lib/calendario.ts`, `lib/calendario.test.ts`
- Create: `lib/calendario-huecos.ts`, `lib/calendario-huecos.test.ts`

**Interfaces:**
- Consumes: `generarHuecos`, `diaBloqueado`, `trabajaEseDia`, `type Bloqueo`, `type CitaOcupada` de `lib/disponibilidad.ts`; `Tramo` (con `centro_id`) de `lib/horarios.ts`; `Instante` de `lib/fechas.ts`.
- Produces en `lib/calendario.ts`:
  - `TipoEvento = 'cita' | 'anulada' | 'bloqueo' | 'libre'`; `EventoCalendario` añade `primera: boolean`, `pacienteId: string | null`, `centros?: string[]`.
  - `export type EstadoVisual = 'libre' | 'ocupada' | 'primera' | 'anulada' | 'bloqueo'`; `export const COLORES_ESTADO: Record<EstadoVisual, { fondo; borde; texto; bordeEstilo?: 'dashed'; tachado?: true }>`; `export function estadoVisual(e: EventoCalendario): EstadoVisual`; `export const LEYENDA: { estado: EstadoVisual; etiqueta: string }[]` (5 entradas en el orden de la especificación).
  - `export function modoContador(f: FiltrosCalendario): boolean` → `!f.centroId && !f.psicologoId`.
  - `filtrarEventos`: los `libre` se filtran por `centroId` mirando `centros` (si existe) o `centroId`; las `anulada` como las citas; el filtro `tipoCita` no afecta a libres ni bloqueos.
  - `export function textoChip(n: number): string` → `1 libre` / `N libres`.
  - Se elimina `PALETA_CENTROS` / `colorCentro` (comprobar con grep que nadie más los usa).
- Produces en `lib/calendario-huecos.ts`:
  - `export type PsicologoAgenda = { id: string; nombre: string; activo: boolean; mediaHora: boolean; tramos: Tramo[]; citas: CitaOcupada[]; bloqueos: Bloqueo[] }`.
  - `export function calcularLibres(psicologos: PsicologoAgenda[], dias: string[], ahora: Instante, centroId: string | null, nombreCentro: Map<string, string>): EventoCalendario[]` — por psicólogo y día `>= ahora.fecha`: con `centroId`, franjas de ese centro; sin él, por cada centro con franjas ese día, `generarHuecos({ tramos: franjasDelCentro, citas, bloqueos, fecha, mediaHora, incluirMedias: false, ahora })`, y se unen por `(psicologoId, fecha, hora)` en un evento `libre` con `centroId` (si uno) o `centros` (si varios). `id = `libre:${psicologoId}:${fecha}:${hora}``.
  - `export function bloqueosPorHora(bloqueos: EventoCalendario[], tramosDe: Map<string, Tramo[]>, dias: string[]): EventoCalendario[]` — por cada bloqueo y día cubierto, un evento `bloqueo` por hora en punto dentro de las franjas de ese día (cualquier centro), `fecha` y `hora` rellenas, `id = `${bloqueo.id}:${fecha}:${hora}``. Sin franjas ese día → nada.
  - `export function marcarPrimeras(citas: EventoCalendario[], historial: { accion_id: string | null; paciente_id: string | null; fecha_cita: string | null; creado_en: string }[]): EventoCalendario[]` — `primera = true` si no hay fila de historial del mismo paciente con `accion_id !== cita.id` y (`fecha_cita < cita.fecha` o igual fecha con `creado_en` anterior a la fila de la propia cita). Sin fila propia en el histórico (cita recién creada, trigger aún sin correr): se compara solo por fecha.
  - `export type AccionLocal = { tipo: 'agendar'; cita: EventoCalendario } | { tipo: 'cambiar'; citaId: string; fecha: string; hora: string; centroId: string | null } | { tipo: 'anular'; citaId: string }`; `export function aplicarAccionLocal(eventos: EventoCalendario[], a: AccionLocal): EventoCalendario[]` — agendar: añade; cambiar: mueve; anular: la cita pasa a `tipo: 'anulada'`. Los libres afectados se recalculan fuera (quien llama vuelve a ejecutar `calcularLibres` con las citas actualizadas) **[decisión del plan]**.

- [x] **Step 1: Tests** en `lib/calendario-huecos.test.ts` (helpers `t`, `psi()` locales):

```ts
const AHORA = { fecha: '2026-10-26', minutos: 9 * 60 }
const DIAS = ['2026-10-26', '2026-10-27']
const NOMBRES = new Map([['mor', 'Moratalaz'], ['on', 'Online']])
const jaime = (extra = {}) => ({ id: 'j', nombre: 'Jaime', activo: true, mediaHora: false,
  tramos: [t(1, '10:00', '12:00', 'mor'), t(1, '10:00', '12:00', 'on'), t(2, '16:00', '18:00', 'mor')], citas: [], bloqueos: [], ...extra })

it('libres por día, saltando el pasado; hora libre en dos centros = un evento con centros', () => {
  const l = calcularLibres([jaime()], DIAS, AHORA, null, NOMBRES)
  expect(l.map((e) => `${e.fecha} ${e.hora}`)).toEqual(['2026-10-26 11:00', '2026-10-27 16:00', '2026-10-27 17:00'])
  expect(l[0].centros).toEqual(['mor', 'on'])
  expect(l[1].centroId).toBe('mor')
})
it('con filtro de centro solo sus franjas', () => {
  expect(calcularLibres([jaime()], DIAS, AHORA, 'on', NOMBRES).map((e) => e.fecha)).toEqual(['2026-10-26'])
})
it('una cita a las 10:30 de un psicólogo con medias horas tapa 10:00 y 11:00', () => {
  const p = jaime({ mediaHora: true, tramos: [t(1, '10:00', '13:00', 'mor')], citas: [{ fecha: '2026-10-26', hora: '10:30:00' }] })
  expect(calcularLibres([p], ['2026-10-26'], { fecha: '2026-10-26', minutos: 0 }, 'mor', NOMBRES).map((e) => e.hora)).toEqual(['11:30', '12:00'])
})
it('bloqueosPorHora: una celda por hora dentro de las franjas', () => {
  const b: EventoCalendario = { ...base, id: 'b1', tipo: 'bloqueo', psicologoId: 'j', inicio: '2026-10-26', fin: '2026-10-27', motivo: 'Vacaciones' }
  const r = bloqueosPorHora([b], new Map([['j', jaime().tramos]]), DIAS)
  expect(r.map((e) => `${e.fecha} ${e.hora}`)).toEqual(['2026-10-26 10:00', '2026-10-26 11:00', '2026-10-27 16:00', '2026-10-27 17:00'])
})
it('marcarPrimeras', () => {
  const c1 = { ...cita, id: 'c1', pacienteId: 'p', fecha: '2026-10-26' }
  const c2 = { ...cita, id: 'c2', pacienteId: 'p', fecha: '2026-10-28' }
  const hist = [{ accion_id: 'c1', paciente_id: 'p', fecha_cita: '2026-10-26', creado_en: '2026-10-20T10:00:00Z' }, { accion_id: 'c2', paciente_id: 'p', fecha_cita: '2026-10-28', creado_en: '2026-10-21T10:00:00Z' }]
  const r = marcarPrimeras([c1, c2], hist)
  expect(r.find((e) => e.id === 'c1')?.primera).toBe(true)
  expect(r.find((e) => e.id === 'c2')?.primera).toBe(false)
})
it('aplicarAccionLocal anular → anulada; cambiar → mueve', () => {
  const r = aplicarAccionLocal([cita], { tipo: 'anular', citaId: cita.id })
  expect(r[0].tipo).toBe('anulada')
  const m = aplicarAccionLocal([cita], { tipo: 'cambiar', citaId: cita.id, fecha: '2026-10-29', hora: '12:00', centroId: 'on' })
  expect(m[0]).toMatchObject({ fecha: '2026-10-29', hora: '12:00', centroId: 'on' })
})
```

En `lib/calendario.test.ts`: `estadoVisual` para los cinco casos; `modoContador`; `textoChip(1)`/`textoChip(4)`; `filtrarEventos` con un libre con `centros: ['mor','on']` y filtro `centroId: 'on'` → se conserva.

- [x] **Step 2: Ejecutar y ver fallar** — `npx vitest run lib/calendario.test.ts lib/calendario-huecos.test.ts`.
- [x] **Step 3: Implementar.**
- [x] **Step 4: Ejecutar** — PASS; `npx tsc --noEmit -p tsconfig.json` (si `AgendaSemanal` usa `colorCentro`, dejar un stub temporal o adelantar el cambio mínimo de la Tarea 3).
- [x] **Step 5: Commit** — `git add lib && git commit -m "Calendario: huecos libres, anuladas, bloqueos por hora, primera cita y colores por estado (puro)"`

---

### Task 2: Carga de datos de la semana

**Files:**
- Create: `lib/calendario-datos.ts`

**Interfaces:**
- Produces: `cargarSemanaCalendario(cliente: SupabaseClient<Database>, p: { lunes: string; psicologoIds: string[]; verAnuladas: boolean }): Promise<{ citas: EventoCalendario[]; bloqueos: EventoCalendario[]; anuladas: EventoCalendario[]; historial: HistorialAgendar[]; tramosDe: Map<string, Tramo[]>; citasDe: Map<string, CitaOcupada[]>; bloqueosDe: Map<string, Bloqueo[]> }` con `HistorialAgendar = { accion_id; paciente_id; fecha_cita; creado_en }`.
- Consultas: citas y bloqueos activos de la semana (como hoy en `calendario/page.tsx:86-141`, con `paciente_id` → `pacienteId`); anuladas solo si `verAnuladas`: `acciones_historial.select('id, accion_id, psicologo_id, paciente_id, centro_id, fecha_cita, hora_cita, tipo_cita').eq('accion','Cancelar cita').gte('fecha_cita', lunes).lte('fecha_cita', domingo)`; histórico de "Agendar cita" de los `paciente_id` de la semana; `horarios_psicologos` (`dia_semana, hora_inicio, hora_fin, centro_id`) de `psicologoIds`; citas activas futuras y bloqueos activos de `psicologoIds` para `calcularLibres` (desde `lunes` hasta `domingo` basta: los libres solo se calculan en la semana visible). Iniciales de pacientes como hoy.

- [x] **Step 1: Implementar** moviendo el código de carga de `calendario/page.tsx` a este módulo.
- [x] **Step 2: Comprobar** — tsc limpio (la página aún no lo usa).
- [x] **Step 3: Commit** — `git add lib/calendario-datos.ts && git commit -m "Calendario: carga de la semana en un módulo reutilizable"`

---

### Task 3: Componente `CalendarioAgenda` y rejilla con libres, chips, bloqueos por hora

**Files:**
- Create: `app/dashboard/_components/CalendarioAgenda.tsx`
- Move + Modify: `app/dashboard/calendario/AgendaSemanal.tsx` → `app/dashboard/_components/AgendaSemanal.tsx`
- Modify: `app/dashboard/calendario/page.tsx`, `app/globals.css`

**Interfaces:**
- `CalendarioAgenda` props: las de la especificación (`rol`, `filtros`, `psicologosVisibles`, `centros`, `onClickLibre?`, `onClickCita?`, `recargaKey?`, `cambioLocal?: AccionLocal | null`). Estado interno: `lunes`, `verAnuladas`, `eventosBase`, `cargando`, `error`, `diaMovil`. Al cargar: `cargarSemanaCalendario(supabase, …)` → `citas = marcarPrimeras(...)`, `bloqueosHora = bloqueosPorHora(...)`, `libres = calcularLibres(psicologosAgenda, dias, ahoraMadrid(), filtros.centroId || null, nombreCentro)` donde para `rol === 'call_center'` se excluyen de `psicologosAgenda` los `!activo`. `recargaKey` cambia → recarga ahora, a los 4 s y a los 10 s (`setTimeout`, limpiados al desmontar). `cambioLocal` cambia → `aplicarAccionLocal` sobre citas y recálculo de libres.
- `AgendaSemanal` props: `dias`, `eventos` (citas, anuladas, bloqueos por hora y libres ya filtrados), `contador: boolean`, `hoy`, `nombreCentro`, `onClickLibre?`, `onClickCita?`. Sin `tramos` ni `indiceCentro`. Fila "Día" eliminada. Libres: alto de una fila (30 px) con texto `Libre · {nombre}`; en modo `contador` no se pintan y en su lugar cada media hora con `n > 0` muestra el chip `textoChip(n)` que abre (estado local `abierto: { fecha, hora } | null`) una lista con `{nombre} · {centro}` por libre, cada línea pulsable → `onClickLibre`. Citas y anuladas: `distribuirColumnas` conjunto; anuladas con `textDecoration: 'line-through'` y borde `dashed`. Bloqueos por hora: alto de dos filas, color bloqueo, texto `{nombre} · {motivo}`. Colores por `COLORES_ESTADO[estadoVisual(e)]`. Clic en cita/anulada → `onClickCita(e)` solo si viene el callback (cursor pointer).
- `calendario/page.tsx`: conserva filtros (y los psicólogos del desplegable: `call_center` solo activos; `agente` todos con sufijo "(inactivo)"), quita leyenda por centro y la carga; renderiza `<CalendarioAgenda rol filtros psicologosVisibles centros onClickLibre onClickCita />`. `onClickLibre` → `router.push(`/dashboard/psicologos?accion=agendar&centro=${centroId}&psicologo=${psicologoId}&fecha=${fecha}&hora=${hora}`)` (si el libre tiene `centros`, se usa el primero y el psicólogo elige en el formulario); `onClickCita` → `router.push(`/dashboard/psicologos?accion=cambiar&cita=${e.id}`)` (anuladas no son pulsables).
- `globals.css`: estilos `.cal-chip`, `.cal-popover`; quitar `.cal-desktop`, `.cal-mobile`.

- [x] **Step 1: Mover `AgendaSemanal`** y ajustar imports.
- [x] **Step 2: `CalendarioAgenda`.**
- [x] **Step 3: Rejilla** (libres, chips, anuladas, bloqueos por hora, clics).
- [x] **Step 4: Página Calendario** y CSS.
- [x] **Step 5: Comprobar** — tsc limpio; `npm test`; `npm run dev`: con "Todos" chips; con un centro, bloques azules; clic lleva a Citas con la URL correcta (la Tarea 4 la interpreta); móvil un día. **Quedó así:** tsc, eslint y tests en verde; la comprobación en pantalla no se hizo (login contra Supabase de producción): queda en las pruebas de aceptación de la Tarea 5.
- [x] **Step 6: Commit** — `git add -A app lib && git commit -m "Calendario propio: huecos libres, colores por estado, bloqueos por hora y clic"`

---

### Task 4: Página Citas — sustituir el iframe, clics, URL, refresco y pastillas de centro

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (iframe ~2107–2135 y estilos `.calendar-panel` ~1254; "¿En qué centro…?" ~1110–1160 y `elegirCentro`/`cambiarDeCentro` ~1087–1098; `resetForm` ~535; los tres `setSuccess(true)` ~665, ~803, ~1069), `lib/centro-activo.ts`

**Interfaces:**
- `lib/centro-activo.ts`: `CentroActivo.centroId` admite `'todos'`; `getCentroActivo` lo devuelve tal cual.
- `page.tsx`:
  - Estado `recargaKey: number`, `cambioLocal: AccionLocal | null`. En cada éxito: agendar → `{ tipo: 'agendar', cita: evento construido con fecha, hora, psicólogo, centro, iniciales del paciente, primera: false, id: `local:${Date.now()}` }` (serie: una por fecha enviada); cambiar → `{ tipo: 'cambiar', citaId: eventoActual.id, fecha, hora, centroId }`; anular → `{ tipo: 'anular', citaId: eventoActual.id }`; y `recargaKey + 1`.
  - Pastillas del psicólogo multicentro (sustituyen a la pantalla "¿En qué centro…?"): `Todos` + nombre de cada centro (apagados con ` (no recibe citas nuevas)`); guardan en `setCentroActivo(userId, { psicologoId, centroId: id | 'todos' })`. `psiCentroId` = `null` cuando es `'todos'`; en ese caso el formulario muestra el desplegable de centro limitado a `misCentros` (reutilizar el `<select>` de agente/call center con `centros.filter(c => misCentros.includes(c.id))`). `necesitaElegirCentro` desaparece (con un solo centro se fija como hoy).
  - `<CalendarioAgenda rol filtros={{ centroId: effCentroId ?? '', psicologoId: effPsicologoId ?? '', tipoCita: '' }} psicologosVisibles={esPsicologo ? [miFicha] : filteredPsicologos (o `psicologos` si no hay centro)} centros onClickLibre onClickCita recargaKey cambioLocal />` en el lugar del iframe, para los tres roles, siempre visible (también sin psicólogo elegido).
  - `onClickLibre`: `setCentroId(centroId)` (agente/call center) o pastilla del centro (psicólogo), `setPsicologoId`, `setAccion('Agendar cita')`, `setFecha`, `setHora`; `scrollIntoView` del formulario. Si el libre trae varios `centros` y el rol es psicólogo con "Todos", se deja el centro sin fijar para que lo elija.
  - `onClickCita`: `setAccion('Cambiar cita')`, centro y psicólogo de la cita, `setEventoSeleccionadoId(e.id)` una vez cargados `citasActivas` (efecto que espera a que la lista contenga el id; si tras cargar no está → `setError('No encontramos esa cita: puede que ya se haya anulado.')`).
  - URL: `useSearchParams()` dentro de un componente hijo envuelto en `<Suspense>` (requisito del App Router); al montar, `accion=agendar` → mismo efecto que `onClickLibre`; `accion=cambiar&cita=` → mismo que `onClickCita`. Después `router.replace('/dashboard/psicologos')` para limpiar la URL.
  - Quitar iframes, `.calendar-panel` y `.cal-desktop/.cal-mobile`.

- [x] **Step 1: `centro-activo.ts` y pastillas.**
- [x] **Step 2: Sustituir el iframe por `CalendarioAgenda`** y clics.
- [x] **Step 3: URL y refresco.**
- [x] **Step 4: Comprobar** — tsc limpio; `npm test`; en `npm run dev`: pruebas de aceptación 2, 3 y 5 de la especificación; `?accion=cambiar&cita=inexistente` muestra el error y el formulario sigue usable. **Quedó así:** tsc, eslint, tests y `npm run build` en verde; sin prueba en pantalla (login contra producción): las pruebas 2, 3 y 5 y la URL con cita inexistente quedan en la Tarea 5.
- [x] **Step 5: Commit** — `git commit -am "Citas: calendario propio en lugar de Google, clic que rellena, refresco y centros con Todos"`

---

### Task 5: Cierre — manual, tablero, merge

- [ ] **Step 1: Pruebas de aceptación** 1–7 de la especificación, marcadas aquí. **Diferidas (decisión de Sonia, 30-10-2026): las pruebas de aceptación de todos los bloques se hacen juntas al final, con el sistema aún sin uso por el cliente; por eso el merge va antes que las pruebas.** (Sonia; rama `b2-calendario-propio`, 6 commits sobre `main`; revisión independiente hecha el 30-10-2026, 3 importantes corregidos, menores diferidos anotados en el tablero). Probar además: "Cambiar cita" con el paciente ya elegido y clic en su cita; call center con un psicólogo con un centro apagado; ancho del calendario en Citas en portátil:
  - [ ] 1 chips y bloques, clic → Citas
  - [ ] 2 pastillas del psicólogo
  - [ ] 3 refresco al agendar / anular + Ver anuladas
  - [ ] 4 primera cita naranja
  - [ ] 5 bloqueo hora a hora
  - [ ] 6 call center e inactivo
  - [ ] 7 móvil
- [x] **Step 2: Manual** — fichas Calendario y Citas en `docs/manual-somos/index.html` (colores, chips, Ver anuladas, pastillas, desaparece Google), `node docs/manual-somos/check-manual.mjs` → OK (30-10-2026, 216 literales). **Quedó así:** artifact sin republicar hasta el merge a `main` (el manual describe producción).
- [x] **Step 3: Tablero** — 14, 15, 16, 18, 17, 19, 20, 53, 29 → `verificar` (30-10-2026; pasarán a `hecha` tras las pruebas de aceptación y el merge); en 19 la nota del enlace a Google Calendar; B2 → `verificar`.
- [x] **Step 4: Merge a `main`** y commit de cierre — hecho el 30-10-2026 de día (el sistema no está en uso; Sonia pidió integrar ya y probar todo al final): fast-forward sobre `09ced10`, tsc y 162 tests en verde en `main`, subido a GitHub, rama borrada, manual republicado.
