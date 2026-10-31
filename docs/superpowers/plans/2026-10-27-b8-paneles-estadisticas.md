# B8 — Paneles y estadísticas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resumen de pacientes y Actividad de citas con los indicadores de Jaime, un selector de periodo con fechas libres compartido por los tres paneles, pastillas de centro que filtran, selectores de gráfica, y el rol `inspeccion`.

**Architecture:** Toda la aritmética (periodos, huecos, horas bloqueadas, agrupaciones, tasas) va en dos módulos puros de `lib/` con tests Vitest; las páginas servidor solo leen Supabase y llaman a esas funciones; dos componentes de gráfica genéricos (quesito y barras) sustituyen a los cuatro actuales; un componente cliente `FiltroPeriodo` escribe el periodo y el centro en la URL. El rol nuevo se concentra en `lib/roles.ts` para que las comprobaciones `=== 'agente'` desaparezcan de las pantallas.

**Tech Stack:** Next.js App Router, TypeScript, Supabase JS v2, chart.js + react-chartjs-2, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-b8-paneles-estadisticas-design.md`

## Global Constraints

- Rama `b8-paneles-estadisticas` desde `main`, **después de B1 y B4 en main** (necesita `horarios_psicologos.centro_id` y `pacientes.pareja_de`).
- Cada tarea termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde. Commits en español.
- Fechas como texto `YYYY-MM-DD` en `Europe/Madrid`; nunca `new Date('YYYY-MM-DD')` sin `T00:00:00Z`.
- Las citas se cuentan por `fecha_cita` en Resumen y por `creado_en` (día de Madrid) en Actividad. Un hueco = una hora de tramo. Bloqueos = días completos.
- Textos exactos de la sección "Textos de interfaz" del spec. Nada de "Baja laboral": B6 lo renombra a "Baja médica" (si B6 no está en main al empezar, usar la clave `baja_medica` igualmente y dejar nota).
- Migración `Supabase/migrations/022_rol_inspeccion.sql` (fuera del repo: copiar a `_backups/` antes de tocar la carpeta; anotar en el tablero).
- Todos los psicólogos **activos** en las barras, sin top N, con scroll.

## Review Focus

1. Periodo "Desde siempre" con `desde = ''`: `diasDelRango` no puede iterar desde el año 0 → se acota al primer dato (test en T2 y T3: rango abierto usa `primerDia`/`ultimoDia` que pasa la página).
2. Cita anulada con `fecha_cita` en el periodo pero agendada fuera de él: cuenta como anulada en Resumen (test en T3 `citasDelPeriodo`).
3. Tramo que cruza un día bloqueado parcialmente no existe (bloqueos son días completos), pero un bloqueo que empieza antes del periodo y termina dentro solo suma los días dentro (test en T3 `horasBloqueo`).
4. Psicólogo con horario en dos centros y filtro por centro: huecos solo de los tramos de ese centro; citas solo de ese centro (test en T3 `ocupacionPor`).
5. Usuario con rol `inspeccion` que escribe `/dashboard` en la barra: `RoleGate` lo manda a `/dashboard/calendario` y el servidor no le devuelve los datos globales (T1: `page.tsx` redirige antes de consultar).

---

### Task 1: Rol `inspeccion` (migración 022, `lib/roles.ts`, menú, puerta, APIs, Usuarios)

**Files:**
- Create: `Supabase/migrations/022_rol_inspeccion.sql`, `lib/roles.ts`, `lib/roles.test.ts`
- Modify: `types/database.ts` (`Rol`), `app/dashboard/_components/RoleGate.tsx`, `app/dashboard/_components/SidebarNav.tsx:62-74`, `lib/require-agente.ts`, `app/dashboard/psicologos/page.tsx:385`, `app/dashboard/page.tsx:80-92`, `app/dashboard/usuarios/page.tsx:16-19`, `app/api/usuarios/route.ts:199-230`, `app/api/usuarios/[id]/route.ts:139`, `docs/roles-y-permisos.md`
- Revisar con `grep -rn "'agente'" app lib --include=*.ts --include=*.tsx`: cada comparación `rol === 'agente'` / `!== 'agente'` pasa a `esGestor(rol)` salvo las que deciden el **origen** de atribución (se guarda el rol real).

**Interfaces:**
- Produces: `type Rol = 'agente' | 'psicologo' | 'call_center' | 'inspeccion'`; en `lib/roles.ts`: `ROLES: readonly Rol[]`, `esGestor(rol: Rol | null | undefined): boolean` (true para `agente`, `inspeccion` y `null`/`undefined` = sin perfil), `HOME_POR_ROL: Record<Rol, string>` (`inspeccion: '/dashboard/calendario'`), `rutaPermitida(rol: Rol, path: string): boolean`, `ETIQUETA_ROL: Record<Rol, string>` (`inspeccion: 'Inspección'`).

- [x] **Step 1: Tests de `lib/roles.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { esGestor, rutaPermitida, HOME_POR_ROL } from './roles'

describe('esGestor', () => {
  it('agente, inspección y sin perfil son gestores', () => {
    expect(esGestor('agente')).toBe(true)
    expect(esGestor('inspeccion')).toBe(true)
    expect(esGestor(null)).toBe(true)
    expect(esGestor('psicologo')).toBe(false)
    expect(esGestor('call_center')).toBe(false)
  })
})

describe('rutaPermitida', () => {
  it('inspección entra en todo menos en los dos paneles', () => {
    expect(rutaPermitida('inspeccion', '/dashboard/calendario')).toBe(true)
    expect(rutaPermitida('inspeccion', '/dashboard/usuarios')).toBe(true)
    expect(rutaPermitida('inspeccion', '/dashboard')).toBe(false)
    expect(rutaPermitida('inspeccion', '/dashboard/psicologos/stats')).toBe(false)
    expect(HOME_POR_ROL.inspeccion).toBe('/dashboard/calendario')
  })
  it('conserva las reglas actuales de psicólogo y call center', () => {
    expect(rutaPermitida('psicologo', '/dashboard/mensajes-psicologo')).toBe(true)
    expect(rutaPermitida('psicologo', '/dashboard/calendario')).toBe(false)
    expect(rutaPermitida('call_center', '/dashboard')).toBe(true)
    expect(rutaPermitida('call_center', '/dashboard/usuarios')).toBe(false)
    expect(rutaPermitida('agente', '/dashboard/psicologos/stats')).toBe(true)
  })
})
```

- [x] **Step 2: Ejecutar `npm test -- roles` → falla (módulo no existe)**
- [x] **Step 3: Escribir `lib/roles.ts`** con la lógica de `isAllowed` y `HOME` movida desde `RoleGate.tsx`, más el caso `inspeccion`. Ampliar `Rol` en `types/database.ts`.
- [x] **Step 4: `npm test -- roles` → pasa**
- [x] **Step 5: Migración `022_rol_inspeccion.sql`** (copia previa de la carpeta en `_backups/migrations-2026-10-<día>/`): comentario de contexto, `ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check; ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('agente','psicologo','call_center','inspeccion'));` y `SELECT` final que lista los roles distintos. Si el nombre real de la constraint es otro, la migración lo busca en `pg_constraint` por `conrelid = 'public.perfiles'::regclass AND contype = 'c'` y lo documenta.
- [x] **Step 6: Cablear el rol.** `RoleGate` usa `rutaPermitida` y `HOME_POR_ROL`. `SidebarNav`: `roles` de cada entrada incluye `'inspeccion'` en todas las del agente salvo Panel General y Estadísticas; etiquetas `Resumen de pacientes` y `Actividad de citas`. `requireAgente`: `if (perfil && !esGestor(perfil.rol))` (mensaje sin cambios). `psicologos/page.tsx:385`: `esGestor(perfil?.rol)` para `modoDisponibilidad`. `app/dashboard/page.tsx`: si `perfil?.rol === 'inspeccion'` → `redirect('/dashboard/calendario')` antes de consultar. Usuarios: `PESTANAS` añade `{ tipo: 'inspeccion', etiqueta: 'Inspección', singular: 'Inspección' }`; `TipoUsuario` y las API aceptan `'inspeccion'` como un agente más (misma rama que `agente | call_center`); la lista de la pestaña filtra por rol del perfil como hace hoy `call_center` (`route.ts:53-63`).
- [x] **Step 7: `npx tsc --noEmit -p tsconfig.json` limpio; `npm test` verde; `docs/roles-y-permisos.md`** con columna Inspección (todo como Agente salvo los dos paneles; entrada en Calendario).
- [x] **Step 8: Commit** `git commit -m "B8: rol inspección (migración 022, lib/roles, menú y puerta)"`

### Task 2: Periodo compartido (`lib/periodo.ts`, `FiltroPeriodo`, panel del call center)

**Files:**
- Create: `lib/periodo.ts`, `lib/periodo.test.ts`, `app/dashboard/_components/FiltroPeriodo.tsx`
- Modify: `app/dashboard/_components/PanelCallCenter.tsx:12-42,133-155` (quita `Periodo`, `PERIODOS`, `inicioPeriodo`, `fechaMadrid`, `sumarDias`), `app/dashboard/page.tsx:72-92` (searchParams)

**Interfaces:**
- Produces (`lib/periodo.ts`): `type Rango = { desde: string; hasta: string }`; `type AtajoKey = 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'ultimos_90' | 'siempre'`; `ATAJOS: { key: AtajoKey; label: string }[]` (etiquetas del spec); `fechaMadrid(d: Date | string): string`; `sumarDias(fecha: string, n: number): string`; `rangoDeAtajo(key: AtajoKey, hoy: string): Rango` (`siempre` → `{ desde: '', hasta: '' }`; `semana` = lunes..domingo de la semana de `hoy`; `mes` = día 1..último; `mes_anterior`; `ultimos_90` = `hoy-89..hoy`; `hoy`); `rangoDeParams(params: { desde?: string; hasta?: string; periodo?: string }, hoy: string): Rango` (prioridad: `desde`/`hasta` válidos → ellos; `periodo` atajo válido → `rangoDeAtajo`; nada → `mes`; `desde > hasta` → intercambiados); `atajoDeRango(rango: Rango, hoy: string): AtajoKey | null`; `enRango(fecha: string | null | undefined, rango: Rango): boolean` (null → false; límite vacío = abierto); `diasDelRango(rango: Rango, limites: { primero: string; ultimo: string }): string[]` (sustituye los lados abiertos por `limites`); `etiquetaRango(rango: Rango): string` (`'1 oct – 31 oct 2026'`, `'Desde siempre'`).
- Produces (`FiltroPeriodo.tsx`): `export default function FiltroPeriodo(props: { rango: Rango; hoy: string; centros?: { id: string; nombre: string }[]; centroId?: string | null; extraParams?: Record<string, string> })` — escribe `desde`, `hasta` (y borra `periodo`) o `periodo=<atajo>` (y borra `desde`/`hasta`), y `centro` (`all` = sin filtro); conserva los demás parámetros de la URL.

- [x] **Step 1: Tests `lib/periodo.test.ts`** (hoy = `'2026-10-27'`, martes):

```ts
it('atajos', () => {
  expect(rangoDeAtajo('hoy', HOY)).toEqual({ desde: '2026-10-27', hasta: '2026-10-27' })
  expect(rangoDeAtajo('semana', HOY)).toEqual({ desde: '2026-10-26', hasta: '2026-11-01' })
  expect(rangoDeAtajo('mes', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  expect(rangoDeAtajo('mes_anterior', HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
  expect(rangoDeAtajo('ultimos_90', HOY)).toEqual({ desde: '2026-07-30', hasta: '2026-10-27' })
  expect(rangoDeAtajo('siempre', HOY)).toEqual({ desde: '', hasta: '' })
})
it('params: fechas mandan, luego atajo, luego mes; invertidas se corrigen', () => {
  expect(rangoDeParams({ desde: '2026-10-05', hasta: '2026-10-01', periodo: 'hoy' }, HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-05' })
  expect(rangoDeParams({ periodo: 'semana' }, HOY)).toEqual(rangoDeAtajo('semana', HOY))
  expect(rangoDeParams({ desde: 'ayer' }, HOY)).toEqual(rangoDeAtajo('mes', HOY))
  expect(atajoDeRango({ desde: '2026-10-01', hasta: '2026-10-31' }, HOY)).toBe('mes')
  expect(atajoDeRango({ desde: '2026-10-02', hasta: '2026-10-31' }, HOY)).toBeNull()
})
it('enRango y diasDelRango', () => {
  expect(enRango('2026-10-31', { desde: '2026-10-01', hasta: '2026-10-31' })).toBe(true)
  expect(enRango('2026-11-01', { desde: '2026-10-01', hasta: '2026-10-31' })).toBe(false)
  expect(enRango(null, { desde: '', hasta: '' })).toBe(false)
  expect(enRango('1999-01-01', { desde: '', hasta: '' })).toBe(true)
  expect(diasDelRango({ desde: '2026-10-30', hasta: '2026-11-01' }, { primero: '2026-01-01', ultimo: '2026-12-31' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  expect(diasDelRango({ desde: '', hasta: '' }, { primero: '2026-10-26', ultimo: '2026-10-27' })).toHaveLength(2)
})
```

- [x] **Step 2: `npm test -- periodo` → falla**
- [x] **Step 3: Escribir `lib/periodo.ts`** (mover `fechaMadrid` y `sumarDias` desde `PanelCallCenter.tsx`; semana = lunes a domingo).
- [x] **Step 4: `npm test -- periodo` → pasa**
- [x] **Step 5: `FiltroPeriodo.tsx`**: patrón de `StatsDashboard` (`useRouter`, `usePathname`, `useSearchParams`, `useTransition`); inputs `Desde` / `Hasta`, botones de atajo (activo = `atajoDeRango(rango, hoy)`), pastillas `Todos los centros` + centros; estilo de pastilla actual (`page.tsx:175-190`) con estado activo en `#3a8c8c` sobre blanco.
- [x] **Step 6: Panel del call center**: `PanelCallCenter({ userId, nombre, rango, hoy })`; filtra acciones por `enRango(fechaMadrid(a.creado_en), rango)` y pacientes por `enRango(fecha_incorporacion)`; consulta `gte('creado_en', desde - 1 día)` solo si `desde`; `FiltroPeriodo` sin centros en lugar de los tres enlaces. `app/dashboard/page.tsx`: `searchParams: Promise<{ desde?; hasta?; periodo?; centro? }>` → `rangoDeParams(params, fechaMadrid(new Date()))`.
- [x] **Step 7: tsc + test; comprobación manual**: entrar como call center, `?periodo=semana` marca "Esta semana", fechas libres filtran la tabla.
  **Quedó así:** tsc y tests hechos; la comprobación en pantalla no se pudo hacer (localhost pide login) → va con las pruebas de aceptación 5 y 7.
- [x] **Step 8: Commit** `git commit -m "B8: selector de periodo compartido (lib/periodo, FiltroPeriodo, panel call center)"`

### Task 3: Cálculo de indicadores (`lib/kpis.ts`)

**Files:**
- Create: `lib/kpis.ts`, `lib/kpis.test.ts`

**Interfaces:**
- Consumes: `Rango`, `enRango`, `diasDelRango` (T2); `Tramo`, `aMinutos` (`lib/horarios.ts`).
- Produces:
  - `type CitaKpi = { id: string; paciente_id: string | null; psicologo_id: string | null; centro_id: string | null; fecha_cita: string | null; tipo_cita: 'adulto' | 'pareja' | 'menor' | null; anulada: boolean }`
  - `type PacienteKpi = { id: string; fecha_incorporacion: string | null; es_menor: boolean; centro_id: string | null; origen: string | null; psicologo_adultos_id: string | null; psicologo_pareja_id: string | null; psicologo_infantil_id: string | null; pareja_de: string | null; estado: string }`
  - `type BloqueoKpi = { psicologo_id: string | null; fecha_bloqueo_inicio: string | null; fecha_bloqueo_fin: string | null; motivo_bloqueo: string | null; creado_en: string | null }`
  - `type TramoKpi = Tramo & { psicologo_id: string; centro_id: string }`
  - `citasDelPeriodo(citas: CitaKpi[], rango: Rango): { activas: CitaKpi[]; anuladas: CitaKpi[] }`
  - `tasa(parte: number, total: number): number | null` (null si total 0; redondeo a entero)
  - `horasTramos(tramos: TramoKpi[], dia: string): number` (horas de los tramos cuyo `dia_semana` coincide con el día ISO de `dia`; tramo 9:00–14:30 = 5.5)
  - `horasBloqueo(b: BloqueoKpi, tramos: TramoKpi[], rango: Rango, limites): number` (días `max(inicio, desde)..min(fin, hasta)`)
  - `horasAbiertas(tramos: TramoKpi[], dias: string[], bloqueos: BloqueoKpi[]): number` (suma de `horasTramos` por día, saltando los días con bloqueo de ese psicólogo)
  - `kpisResumen(d: { citas; pacientes; bloqueos; tramos; psicologosActivos: string[]; rango; limites }): { pacientesCitados; citasAgendadas; pacientesNuevos; tasaAnulacion; menoresNuevos; psicologosActivos; parejasNuevas; ocupacion: number | null; huecos: number }`
  - `parejasNuevas(nuevos: PacienteKpi[]): number` (fichas con `psicologo_pareja_id`; dos fichas enlazadas por `pareja_de` en cualquier sentido = 1)
  - `serieBarras(valores: Map<string, number | null>, nombres: Map<string, string>, ids: string[]): { etiqueta: string; valor: number | null }[]` (todos los `ids`, 0 para los que no tienen valor, orden descendente, null al final)
  - `contarPor<T>(items: T[], clave: (t: T) => string | null, sinDato: string): Map<string, number>`
  - `ocupacionPor(citasActivas, tramos, dias, bloqueos, por: 'psicologo' | 'centro'): Map<string, number | null>`
  - `anulacionPor(citas: CitaKpi[], por: 'psicologo' | 'centro'): Map<string, number | null>`
  - `horasBloqueoPor(bloqueos, tramos, rango, limites, por: 'psicologo' | 'motivo'): Map<string, number>`
  - `ETIQUETA_ORIGEN: Record<string, string>` (`dante: 'Dante'`, `agente: 'Agentes'`, `call_center: 'Call center'`, `psicologo: 'Psicólogos'`, `inspeccion: 'Agentes'`), `ETIQUETA_TIPO` (`adulto: 'Adultos'`, `pareja: 'Pareja'`, `menor: 'Infantil'`).

- [x] **Step 1: Tests `lib/kpis.test.ts`** con un juego de datos fijo (octubre 2026; psicólogo A con tramos L–V 9–14 en centro C1; psicólogo B sin horario; 4 citas activas de A (2 pacientes), 1 anulada de A, 1 cita de B; bloqueo de A del 5 al 9; paciente nuevo menor el 10-10 origen `dante`; dos fichas de pareja enlazadas el 12-10):

```ts
it('citasDelPeriodo separa por fecha_cita', () => { expect(activas).toHaveLength(5); expect(anuladas).toHaveLength(1) })
it('horasTramos: lunes 5 h, sábado 0', ...)
it('horasBloqueo cuenta solo días del rango con tramo: 5–9 oct = 25 h; con rango 7–31 = 15 h', ...)
it('horasAbiertas de A en octubre (22 laborables − 5 bloqueados) = 85 h', ...)
it('kpisResumen', () => {
  expect(k.pacientesCitados).toBe(3)          // 2 de A + 1 de B
  expect(k.citasAgendadas).toBe(5)
  expect(k.tasaAnulacion).toBe(17)             // 1 / 6
  expect(k.pacientesNuevos).toBe(3); expect(k.menoresNuevos).toBe(1); expect(k.parejasNuevas).toBe(1)
  expect(k.psicologosActivos).toBe(2)
  expect(k.huecos).toBe(85); expect(k.ocupacion).toBe(6)   // 5 / 85
})
it('ocupacionPor psicólogo: B sin horario → null; por centro C1 → 5/85', ...)
it('anulacionPor psicólogo: A = 20, B = 0', ...)
it('serieBarras incluye activos sin datos con 0 y ordena', ...)
it('horasBloqueoPor motivo: Vacaciones 25', ...)
```

- [x] **Step 2: `npm test -- kpis` → falla**
- [x] **Step 3: Escribir `lib/kpis.ts`** (día ISO de `YYYY-MM-DD` con `new Date(f + 'T00:00:00Z').getUTCDay()` → 1..7).
- [x] **Step 4: `npm test -- kpis` → pasa; commit** `git commit -m "B8: cálculo de indicadores (lib/kpis)"`

### Task 4: Gráficas genéricas

**Files:**
- Create: `app/dashboard/_components/GraficaQuesito.tsx`, `app/dashboard/_components/GraficaBarras.tsx`, `app/dashboard/_components/SelectorGrafica.tsx`
- Delete al final de T6: `EstadosChart.tsx`, `PsicologosChart.tsx`, `stats/_components/MotivosChart.tsx`, `stats/_components/BloqueosBarChart.tsx`

**Interfaces:**
- `GraficaQuesito({ datos: { etiqueta: string; valor: number; color?: string }[]; unidad?: '' | 'h' })` — tooltip `' 12 citas'` / `' 12 h'`; "Sin datos disponibles" si todo es 0; colores fijos por etiqueta conocida (motivos: los de `MOTIVO_COLORS`; tipos: adultos `#3a8c8c`, pareja `#6366f1`, infantil `#f59e0b`; el resto de una paleta de 8).
- `GraficaBarras({ datos: { etiqueta: string; valor: number | null }[]; unidad: '' | 'h' | '%'; color?: string })` — horizontal, **sin** `slice`, alto `max(280, filas * 34)` dentro de un contenedor `overflowY: auto; maxHeight: 420`; `null` se pinta como 0 con tooltip `'Sin horario cargado'`.
- `SelectorGrafica({ opciones: { key: string; label: string }[]; valor: string; onChange })` — `<select>` con el estilo de los filtros de `StatsDashboard`.

- [x] **Step 1: Escribir los tres componentes** (partir de `MotivosChart` y `BloqueosBarChart`).
- [x] **Step 2: Sustituir `MotivosChart` y `BloqueosBarChart` en `StatsDashboard` por los genéricos (mismo aspecto) y comprobar en el navegador que Estadísticas se ve igual.**
  **Quedó así:** sustituidos; sin comprobación en pantalla (login).
- [x] **Step 3: tsc; commit** `git commit -m "B8: gráficas genéricas de quesito y barras"`

### Task 5: Resumen de pacientes

**Files:**
- Modify: `app/dashboard/page.tsx` (reescritura de consultas y KPIs; mantiene iconos, `KpiCard`, tabla)
- Create: `app/dashboard/_components/ResumenDashboard.tsx` (cliente: filtros, KPIs, dos tarjetas con selector, tabla)

**Interfaces:**
- Consumes: T2 (`rangoDeParams`, `FiltroPeriodo`), T3 (`kpisResumen`, `contarPor`, `ocupacionPor`, `anulacionPor`, `serieBarras`), T4.
- Produces: props de `ResumenDashboard`: `{ rango; hoy; centros; centroId; kpis; quesitos: Record<QuesitoKey, Dato[]>; barras: Record<BarraKey, DatoBarra[]>; pacientesRecientes: PacienteRow[]; avisoHorario: boolean }` con `QuesitoKey = 'tipo' | 'nuevos_centro' | 'nuevos_canal' | 'estado'`, `BarraKey = 'nuevos_psi' | 'nuevos_centro' | 'citas_psi' | 'citas_centro' | 'ocupacion_psi' | 'ocupacion_centro' | 'anulacion_psi' | 'anulacion_centro'`.

- [x] **Step 1: Consultas en `page.tsx`**: `acciones_psicologos` con `.in('accion', ['Agendar cita','Cancelar cita'])`, `.gte/.lte('fecha_cita')` si hay límites, `.eq('centro_id')` si hay centro; `anulada = accion === 'Cancelar cita' || activo === false`; `pacientes` (todas las columnas de `PacienteKpi`; con centro → `.eq('centro_id')`); `psicologos` activos; `horarios_psicologos` (`psicologo_id, centro_id, dia_semana, hora_inicio, hora_fin`; con centro → filtrado); bloqueos `Bloquear agenda` con `fecha_bloqueo_fin >= desde` y `fecha_bloqueo_inicio <= hasta`. `limites` = `{ primero: min(fecha_cita, fecha_incorporacion), ultimo: max(..., hoy) }`.
- [x] **Step 2: Calcular** KPIs, quesitos y barras con T3; `avisoHorario = tramos.length === 0`; título `Resumen de pacientes`, subtítulo `etiquetaRango(rango)`.
- [x] **Step 3: `ResumenDashboard.tsx`**: `FiltroPeriodo` con centros; rejilla `r-grid-kpi` con los 8 cuadros en el orden del spec (sub: `Ocupación` → `'{citas} citas / {huecos} huecos'` o `Sin horario cargado: la ocupación no se puede calcular.`); dos `Card` con `SelectorGrafica` en la cabecera (estado local `useState`, por defecto `tipo` y `citas_psi`); nota bajo las barras de ocupación `Las citas fuera de horario cuentan; por eso puede pasar del 100 %.`; tabla de recientes como hoy.
- [x] **Step 4: Comprobación manual** con las aceptaciones 1, 3, 4 y 5 del spec; `npx tsc`; borrar `EstadosChart.tsx` y `PsicologosChart.tsx`.
  **Quedó así:** tsc limpio y gráficas viejas borradas; aceptaciones 1, 3, 4 y 5 pendientes de Sonia (login).
- [x] **Step 5: Commit** `git commit -m "B8: Resumen de pacientes con periodo, centros e indicadores de Jaime"`

### Task 6: Actividad de citas

**Files:**
- Modify: `app/dashboard/psicologos/stats/page.tsx`, `app/dashboard/psicologos/stats/_components/StatsDashboard.tsx` (título, filtros, KPIs en horas, selector de barras, tabla, enlaces)

**Interfaces:**
- Consumes: T2, T3 (`horasBloqueo`, `horasBloqueoPor`, `serieBarras`), T4.
- Produces: `Kpis` pasa a `{ psicologosActivos; psicologosTotal; horasBloqueo; horasVacaciones; horasAsuntos; horasBaja; citasTotal; citasCambiadas; citasCanceladas }`; `PerPsicologoRow` con `horas_bloqueo, horas_vacaciones, horas_asuntos, horas_baja` en vez de los contadores; `barras: Record<BarraActividadKey, DatoBarra[]>` con `BarraActividadKey = 'bloqueos' | 'vacaciones' | 'asuntos' | 'baja' | 'agendadas' | 'anuladas'`; `PeriodKey`/`periodOptions` eliminados; props `rango`, `hoy`.

- [x] **Step 1: `page.tsx`**: `rangoDeParams`; bloqueos por `creado_en` (día de Madrid) en el rango → horas con `horasBloqueo(b, tramosDelPsicologo, { desde: '', hasta: '' }, limites)` (el periodo filtra **cuándo se hizo** el bloqueo; las horas son las del bloqueo entero); citas del historial por `creado_en` como hoy; *psicólogos activos* = ids distintos en citas activas de `acciones_psicologos` con `fecha_cita` en el rango (consulta aparte).
- [x] **Step 2: `StatsDashboard.tsx`**: título `Actividad de citas`; `FiltroPeriodo` con centros + desplegable de psicólogo (conserva `psi` en la URL); KPIs con `12 h`; etiquetas `Bloqueos en agenda`, `Baja médica`; tarjeta de barras con `SelectorGrafica` (por defecto `bloqueos`); quesito de motivos en horas; tabla con horas (una decimal si no es entero).
- [x] **Step 3: Comprobación manual** aceptación 2 y 5; borrar `MotivosChart.tsx` y `BloqueosBarChart.tsx`; `npx tsc`; `npm test`.
  **Quedó así:** tsc, tests y build limpios; aceptaciones 2 y 5 pendientes de Sonia (login).
- [x] **Step 4: Commit** `git commit -m "B8: Actividad de citas en horas, periodo libre y selector de barras"`

### Task 7: Manual, tablero, merge

**Files:**
- Modify: `docs/manual-somos/index.html` (menú lateral y fichas "Panel General" → "Resumen de pacientes" y "Estadísticas" → "Actividad de citas" con los indicadores y la nota de horarios; sección "Quién entra" con la ficha "Inspección"; Usuarios: pestaña Inspección; Novedades), `docs/backlog-2026-10-21.md` (21, 22, 23, 24, 25, 56 → hecha; nota "migración 022 aplicada el …")

- [x] **Step 1: Manual** (entrada en Novedades: `Resumen de pacientes y Actividad de citas con fechas libres, filtro por centro y los indicadores nuevos; ocupación y horas bloqueadas se calculan a partir del horario de cada psicólogo. Nuevo perfil Inspección.`). Republicar el artifact del manual (memoria "Manual Somos para dueños").
- [x] **Step 2: Tablero** y casillas de este plan marcadas.
- [ ] **Step 3: Merge a `main`** tras `npm run build` limpio; recordar: migración 022 en Supabase solo de madrugada y con autorización de Sonia.
  **Quedó así (31-10-2026):** rama lista (build limpio, revisión final corregida), sin merge: lo decide Sonia. Manual republicado. Migración 022 sin aplicar.
