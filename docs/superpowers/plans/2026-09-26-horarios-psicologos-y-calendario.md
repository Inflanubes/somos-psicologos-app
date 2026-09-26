# Horarios de psicólogos, disponibilidad en Citas y calendario — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los agentes definan el horario semanal y las medias horas de cada psicólogo por centro, que el formulario de Citas solo ofrezca huecos reales (con aviso en vez de bloqueo para agentes) y que call center y agentes vean una agenda semanal con todas las citas y bloqueos.

**Architecture:** Los datos nuevos viven en Supabase (`horarios_psicologos` y `psicologos.citas_media_hora`, migración 012) y solo los lee la app; Make no cambia. Las reglas de disponibilidad están en módulos puros (`lib/horarios.ts`, `lib/disponibilidad.ts`, `lib/calendario.ts`) probados con Vitest; la carga de datos y la UI los consumen sin duplicar lógica. El formulario de Citas y la pantalla de Usuarios se amplían siguiendo sus patrones actuales; el calendario es una página cliente nueva.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Supabase JS v2 (`@supabase/ssr`), estilos inline + clases de `app/globals.css`, Vitest (nuevo, solo para módulos puros).

**Spec:** `docs/superpowers/specs/2026-09-26-horarios-psicologos-y-calendario-design.md`

## Global Constraints

- Todo el texto de la interfaz en español, tono cálido y profesional.
- Toda cita dura **60 minutos**. Franja de citas: de **08:00 a 21:00** en punto, más las y media hasta **21:30** cuando aplique.
- `psicologos.citas_media_hora` es `boolean NOT NULL DEFAULT false` y, como `puede_bloquear`, se aplica a **todas las fichas con el mismo email**.
- Prioridad de estados de un hueco: `ocupado` > `fuera_horario` > `media_hora`.
- Ficha sin tramos = **sin restricción de horario** (solo se ocultan las horas ocupadas).
- Modo del selector según rol: `agente` (o sin fila en `perfiles`) → **aviso**; `psicologo` y `call_center` → **restringido**.
- Los bloqueos son rangos de **días completos**, ambos incluidos; `fecha_bloqueo_fin` nula = sin fin.
- Estilo: seguir el de las páginas existentes (azul `#2f5aae`, tarjetas blancas radio 12, inputs radio 8, fuente Montserrat heredada). Sin modo oscuro.
- Las migraciones viven **fuera del repo git** en `Z:\Claude\Somos Psicológos\Supabase\migrations\` (desde `somos-app`: `../Supabase/migrations/`). No se commitean; se ejecutan en el SQL Editor de Supabase (proyecto `ymwwlggmcfphjvnhdwnn`).
- La raíz git es `somos-app`. Commits sin push (el push lo hace Sonia). No tocar Make ni el trigger de aviso a Elias.
- `npm run build` debe terminar sin errores de TypeScript al final de cada tarea.

## Review Focus

Entradas que la spec implica y que se cubren con tests en la tarea que posee el código:

1. **Horas con segundos** (`'11:30:00'` de Supabase) frente a `'11:30'` del selector: una cita a las 11:30:00 debe ocupar el hueco 11:30. → Tarea 3.
2. **Bloqueo sin fecha de fin** (`fecha_bloqueo_fin` nula): bloquea todos los días desde el inicio. → Tarea 3.
3. **Domingo**: `diaSemanaISO` debe devolver 7 (JS devuelve 0). → Tarea 3.
4. **Valor antiguo fuera de la rejilla** (cita a las 17:15) con `opciones` informadas: el selector lo sigue mostrando seleccionado. → Tarea 6.
5. **Semana que cruza año** (lunes 2026-12-28): `diasDeSemana` y la etiqueta del rango deben ser correctas. → Tarea 10.

---

## Estado de partida y orden

- Fase 1 = tareas 1 a 9 (horarios, medias horas, reglas en Citas). Fase 2 = tareas 10 a 12 (calendario).
- La tarea 1 produce el SQL. **Sonia lo ejecuta en el SQL Editor** antes de probar las tareas 4 en adelante contra datos reales. Hasta entonces, la API y el formulario deben tolerar que la tabla no exista (se indica en cada tarea).
- Comprobación previa: `git status --short` vacío en `somos-app` y `npm run build` en verde antes de empezar.

---

### Task 1: Migración 012 y tipos

**Files:**
- Create: `../Supabase/migrations/012_horarios_psicologos.sql` (fuera del repo)
- Modify: `types/database.ts`

**Interfaces:**
- Produces: tabla `horarios_psicologos(id, psicologo_id, dia_semana 1..7, hora_inicio time, hora_fin time, creado_en)`; columna `psicologos.citas_media_hora boolean`; tipos `HorarioPsicologo`, `HorarioPsicologoInsert`, `Psicologo.citas_media_hora`, entrada `horarios_psicologos` en `Database['public']['Tables']`.

- [ ] **Step 1: Escribir la migración**

Crear `../Supabase/migrations/012_horarios_psicologos.sql` con este contenido:

```sql
-- ============================================================================
-- 012 — Horarios de psicólogos por centro, citas a las medias horas y relleno
--       de tipo_cita en citas antiguas
-- ----------------------------------------------------------------------------
-- Contexto (26-09-2026): los agentes definen desde Usuarios el horario semanal
-- de cada psicólogo en cada centro (una ficha de `psicologos` por centro) y si
-- admite citas a y media. El formulario de Citas solo ofrece huecos dentro del
-- horario y no ocupados; el calendario del call center lee las mismas tablas.
-- Make no usa estas columnas.
--
-- Idempotente: se puede ejecutar más de una vez.
-- Ejecutar en el SQL Editor de Supabase (proyecto ymwwlggmcfphjvnhdwnn).
-- ============================================================================

BEGIN;

-- ── 1. Medias horas por psicólogo (permiso de la persona: se aplica a todas
--       sus fichas desde la API de Usuarios, como puede_bloquear) ─────────────
ALTER TABLE public.psicologos
  ADD COLUMN IF NOT EXISTS citas_media_hora boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.psicologos.citas_media_hora IS
  'true = puede recibir citas a y media (10:30, 11:30...). false = solo en punto. Boton 30 min en Usuarios.';

-- ── 2. Horario semanal por ficha (psicólogo × centro) ───────────────────────
CREATE TABLE IF NOT EXISTS public.horarios_psicologos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id  uuid NOT NULL REFERENCES public.psicologos(id) ON DELETE CASCADE,
  dia_semana    smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),  -- 1 = lunes … 7 = domingo
  hora_inicio   time NOT NULL,
  hora_fin      time NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT horarios_psicologos_fin_mayor_que_inicio CHECK (hora_fin > hora_inicio)
);

COMMENT ON TABLE public.horarios_psicologos IS
  'Tramos semanales de trabajo de cada ficha de psicologo (una ficha por centro). Varios tramos por dia permitidos. Sin filas = sin restriccion de horario.';
COMMENT ON COLUMN public.horarios_psicologos.dia_semana IS '1 = lunes ... 7 = domingo (ISO).';

CREATE INDEX IF NOT EXISTS horarios_psicologos_psicologo_idx
  ON public.horarios_psicologos (psicologo_id, dia_semana, hora_inicio);

-- Lectura con sesión (la app la lee desde el navegador); las escrituras van por
-- la API de Usuarios con la service role, que salta RLS.
ALTER TABLE public.horarios_psicologos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS horarios_psicologos_lectura ON public.horarios_psicologos;
CREATE POLICY horarios_psicologos_lectura
  ON public.horarios_psicologos FOR SELECT TO authenticated USING (true);

-- ── 3. Relleno de tipo_cita en citas antiguas ───────────────────────────────
-- Make no guardaba tipo_cita al agendar (ver docs/make-cambios-2026-09-25.md,
-- apartado F). La app sí lo registra en formulario_citas_psicologos. Se copia
-- cuando hay exactamente un envío del mismo psicólogo (por nombre), con la misma
-- hora, hecho en los 5 minutos anteriores a la creación de la fila.
UPDATE public.acciones_psicologos a
SET tipo_cita = m.tipo_cita
FROM (
  SELECT a2.id, MIN(f.tipo_cita) AS tipo_cita
  FROM public.acciones_psicologos a2
  JOIN public.psicologos p ON p.id = a2.psicologo_id
  JOIN public.formulario_citas_psicologos f
    ON f.psicologo = p.nombre
   AND f.accion = 'Agendar cita'
   AND f.hora_cita::text = a2.hora_cita::text
   AND f.tipo_cita IN ('adulto', 'pareja', 'menor')
   AND f.created_at BETWEEN a2.creado_en - interval '5 minutes' AND a2.creado_en
  WHERE a2.accion::text = 'Agendar cita'
    AND a2.tipo_cita IS NULL
  GROUP BY a2.id
  HAVING COUNT(DISTINCT f.tipo_cita) = 1
) m
WHERE a.id = m.id;

COMMIT;

-- Comprobación rápida después de ejecutar:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'psicologos' AND column_name = 'citas_media_hora';
-- SELECT COUNT(*) FROM public.horarios_psicologos;
-- SELECT tipo_cita, COUNT(*) FROM public.acciones_psicologos WHERE accion::text = 'Agendar cita' GROUP BY 1;
```

- [ ] **Step 2: Añadir los tipos**

En `types/database.ts`, dentro de `export type Psicologo = {` añadir tras `puede_bloquear: boolean | null`:

```ts
  /** true = admite citas a y media. Botón "30'" en Usuarios. Migración 012. */
  citas_media_hora: boolean | null
```

Dentro de `export type PsicologoInsert = {` añadir tras `puede_bloquear?: boolean | null`:

```ts
  citas_media_hora?: boolean | null
```

Justo antes de `export type Database = {` añadir:

```ts
/**
 * Tramo semanal de trabajo de una ficha de psicólogo (migración 012).
 * dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM:SS' tal como las devuelve Postgres.
 */
export type HorarioPsicologo = {
  id: string
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  creado_en: string
}

export type HorarioPsicologoInsert = {
  psicologo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}
```

Dentro de `Tables: {`, después del bloque `asociados_menores: { ... }`, añadir:

```ts
      horarios_psicologos: {
        Row: HorarioPsicologo
        Insert: HorarioPsicologoInsert
        Update: Partial<HorarioPsicologoInsert>
        Relationships: []
      }
```

- [ ] **Step 3: Comprobar que compila**

Run: `npm run build`
Expected: termina sin errores de TypeScript (la app aún no usa los tipos nuevos).

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "Tipos de horarios_psicologos y citas_media_hora (migración 012)"
```

Nota: el SQL queda en `../Supabase/migrations/012_horarios_psicologos.sql`, fuera del repo. Avisar a Sonia de que debe ejecutarlo en el SQL Editor antes de probar las tareas 4 en adelante.

---
### Task 2: Vitest y módulo puro `lib/horarios.ts` (tramos, validación, resumen)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (script `test`, dependencia de desarrollo `vitest`)
- Create: `lib/horarios.ts`
- Test: `lib/horarios.test.ts`

**Interfaces:**
- Produces:
  - `type Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string }` (horas `'HH:MM'` o `'HH:MM:SS'`)
  - `DIAS_SEMANA: readonly string[]` (`'Lunes'`…`'Domingo'`, índice = día − 1), `DIAS_CORTOS` (`'L','M','X','J','V','S','D'`)
  - `aMinutos(hora: string): number` (NaN si no es hora), `aHora(minutos: number): string` (`'HH:MM'`), `normalizarHora(hora: string): string`
  - `validarTramos(tramos: Tramo[]): string | null` (mensaje en español o null)
  - `resumenHorario(tramos: Tramo[]): string` (`'L, X 09:00–14:00 · V 16:00–20:00'`, `''` sin tramos)

- [ ] **Step 1: Instalar Vitest y crear la configuración**

Run: `npm install -D vitest`

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// Solo módulos puros de lib/ (sin React ni Supabase). El resto se prueba con
// `npm run build` y en la app.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
})
```

En `package.json`, dentro de `"scripts"`, añadir tras `"lint": "eslint"`:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Escribir los tests (fallan)**

Crear `lib/horarios.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aMinutos, aHora, normalizarHora, validarTramos, resumenHorario, type Tramo } from './horarios'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })

describe('aMinutos / aHora / normalizarHora', () => {
  it('acepta HH:MM y HH:MM:SS', () => {
    expect(aMinutos('09:30')).toBe(570)
    expect(aMinutos('09:30:00')).toBe(570)
  })
  it('devuelve NaN con texto que no es una hora', () => {
    expect(aMinutos('abc')).toBeNaN()
    expect(aMinutos('')).toBeNaN()
  })
  it('aHora rellena con ceros', () => {
    expect(aHora(570)).toBe('09:30')
    expect(aHora(1290)).toBe('21:30')
  })
  it('normalizarHora quita los segundos', () => {
    expect(normalizarHora('11:30:00')).toBe('11:30')
    expect(normalizarHora('11:30')).toBe('11:30')
  })
})

describe('validarTramos', () => {
  it('acepta tramos correctos en varios días', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '16:00', '20:00'), t(3, '09:00', '14:00')])).toBeNull()
  })
  it('acepta una lista vacía', () => {
    expect(validarTramos([])).toBeNull()
  })
  it('rechaza fin igual o anterior al inicio', () => {
    expect(validarTramos([t(2, '14:00', '14:00')])).toMatch(/posterior/)
    expect(validarTramos([t(2, '14:00', '09:00')])).toMatch(/Martes/)
  })
  it('rechaza solapamiento en el mismo día', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '13:00', '18:00')])).toMatch(/solapan/)
  })
  it('permite tramos contiguos', () => {
    expect(validarTramos([t(1, '09:00', '14:00'), t(1, '14:00', '16:00')])).toBeNull()
  })
  it('rechaza un día fuera de 1..7', () => {
    expect(validarTramos([t(0, '09:00', '14:00')])).toMatch(/Día/)
    expect(validarTramos([t(8, '09:00', '14:00')])).toMatch(/Día/)
  })
  it('rechaza horas no válidas', () => {
    expect(validarTramos([t(4, 'x', '14:00')])).toMatch(/Hora no válida/)
  })
})

describe('resumenHorario', () => {
  it('agrupa los días con los mismos tramos', () => {
    expect(
      resumenHorario([t(1, '09:00:00', '14:00:00'), t(3, '09:00:00', '14:00:00'), t(5, '16:00:00', '20:00:00')]),
    ).toBe('L, X 09:00–14:00 · V 16:00–20:00')
  })
  it('une varios tramos de un día con "y" y los ordena', () => {
    expect(resumenHorario([t(1, '16:00', '20:00'), t(1, '09:00', '14:00')])).toBe('L 09:00–14:00 y 16:00–20:00')
  })
  it('devuelve cadena vacía sin tramos', () => {
    expect(resumenHorario([])).toBe('')
  })
})
```

- [ ] **Step 3: Ejecutar los tests para ver que fallan**

Run: `npm test -- lib/horarios.test.ts`
Expected: FAIL, "Failed to resolve import './horarios'" (el módulo no existe).

- [ ] **Step 4: Implementar `lib/horarios.ts`**

```ts
/**
 * Horarios semanales de los psicólogos (migración 012). Módulo puro: sin React
 * ni Supabase, para poder probarlo con Vitest y usarlo en cliente y servidor.
 */

/** Tramo de trabajo. dia_semana: 1 = lunes … 7 = domingo. Horas 'HH:MM' o 'HH:MM:SS'. */
export type Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string }

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/** 'HH:MM' | 'HH:MM:SS' → minutos desde medianoche. NaN si no es una hora. */
export function aMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim())
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutos desde medianoche → 'HH:MM'. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 'HH:MM:SS' → 'HH:MM' (deja 'HH:MM' igual). */
export function normalizarHora(hora: string): string {
  return aHora(aMinutos(hora))
}

function tramosDelDia(tramos: Tramo[], dia: number): Array<readonly [number, number]> {
  return tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)] as const)
    .sort((a, b) => a[0] - b[0])
}

/**
 * Valida una lista de tramos. Devuelve el mensaje de error (en español) o null.
 * Reglas: día 1..7, horas válidas, fin posterior al inicio, sin solapamientos
 * dentro del mismo día (los tramos contiguos se permiten).
 */
export function validarTramos(tramos: Tramo[]): string | null {
  for (const t of tramos) {
    if (!Number.isInteger(t.dia_semana) || t.dia_semana < 1 || t.dia_semana > 7) {
      return 'Día de la semana no válido.'
    }
    const nombre = DIAS_SEMANA[t.dia_semana - 1]
    const ini = aMinutos(t.hora_inicio)
    const fin = aMinutos(t.hora_fin)
    if (Number.isNaN(ini) || Number.isNaN(fin)) return `Hora no válida en ${nombre}.`
    if (fin <= ini) return `En ${nombre} la hora de fin debe ser posterior a la de inicio.`
  }
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i][0] < delDia[i - 1][1]) return `Los tramos de ${DIAS_SEMANA[d - 1]} se solapan.`
    }
  }
  return null
}

/**
 * Resumen compacto para la tabla de Usuarios: 'L, X 09:00–14:00 · V 16:00–20:00'.
 * Los días con exactamente los mismos tramos se agrupan. '' si no hay tramos.
 */
export function resumenHorario(tramos: Tramo[]): string {
  const grupos: { dias: number[]; texto: string }[] = []
  for (let d = 1; d <= 7; d++) {
    const delDia = tramosDelDia(tramos, d)
    if (delDia.length === 0) continue
    const texto = delDia.map(([i, f]) => `${aHora(i)}–${aHora(f)}`).join(' y ')
    const grupo = grupos.find((g) => g.texto === texto)
    if (grupo) grupo.dias.push(d)
    else grupos.push({ dias: [d], texto })
  }
  return grupos.map((g) => `${g.dias.map((d) => DIAS_CORTOS[d - 1]).join(', ')} ${g.texto}`).join(' · ')
}
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm test -- lib/horarios.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Comprobar build y commit**

Run: `npm run build`
Expected: sin errores.

```bash
git add vitest.config.ts package.json package-lock.json lib/horarios.ts lib/horarios.test.ts
git commit -m "Módulo de horarios (tramos, validación, resumen) con Vitest"
```

---
### Task 3: Módulo puro `lib/disponibilidad.ts` (huecos y avisos)

**Files:**
- Create: `lib/disponibilidad.ts`
- Test: `lib/disponibilidad.test.ts`

**Interfaces:**
- Consumes: `aMinutos`, `aHora`, `DIAS_SEMANA`, `Tramo` de `lib/horarios.ts` (Tarea 2).
- Produces:
  - `type CitaOcupada = { fecha: string; hora: string; accionId?: string }`
  - `type Bloqueo = { inicio: string; fin: string | null; motivo?: string | null }`
  - `type EstadoHueco = 'libre' | 'ocupado' | 'fuera_horario' | 'media_hora'`, `type Hueco = { hora: string; estado: EstadoHueco }`
  - `type ParamsHuecos = { tramos; citas; bloqueos; fecha; mediaHora; incluirMedias; excluirAccionId? }`
  - `diaSemanaISO(fecha): number`, `nombreDia(fecha): string` (`'lunes'`…), `diaBloqueado(bloqueos, fecha): Bloqueo | null`, `trabajaEseDia(tramos, fecha): boolean`, `generarHuecos(p): Hueco[]`, `etiquetaMotivo(motivo): string`
  - `motivoAviso(p: ParamsHuecos & { hora; nombrePsicologo; nombreCentro }): string | null` (frase sin "Aviso:" ni punto final)

- [ ] **Step 1: Escribir los tests (fallan)**

Crear `lib/disponibilidad.test.ts`. Fechas de referencia: `2026-09-28` es lunes, `2026-09-29` martes, `2026-09-27` domingo.

```ts
import { describe, it, expect } from 'vitest'
import {
  diaSemanaISO, nombreDia, diaBloqueado, trabajaEseDia, generarHuecos, motivoAviso, etiquetaMotivo,
  type ParamsHuecos, type Hueco,
} from './disponibilidad'
import type { Tramo } from './horarios'

const LUNES = '2026-09-28'
const MARTES = '2026-09-29'
const DOMINGO = '2026-09-27'

const t = (dia_semana: number, hora_inicio: string, hora_fin: string): Tramo => ({ dia_semana, hora_inicio, hora_fin })
const base: ParamsHuecos = { tramos: [], citas: [], bloqueos: [], fecha: LUNES, mediaHora: false, incluirMedias: false }
const estado = (huecos: Hueco[], hora: string) => huecos.find((h) => h.hora === hora)?.estado

describe('diaSemanaISO / nombreDia', () => {
  it('lunes = 1 y domingo = 7 (no 0)', () => {
    expect(diaSemanaISO(LUNES)).toBe(1)
    expect(diaSemanaISO(DOMINGO)).toBe(7)
  })
  it('nombreDia devuelve el nombre en minúsculas', () => {
    expect(nombreDia(MARTES)).toBe('martes')
    expect(nombreDia(DOMINGO)).toBe('domingo')
  })
})

describe('trabajaEseDia', () => {
  it('sin tramos siempre trabaja (sin restricción)', () => {
    expect(trabajaEseDia([], MARTES)).toBe(true)
  })
  it('con tramos solo los días que los tienen', () => {
    const tramos = [t(1, '09:00', '14:00'), t(3, '09:00', '14:00')]
    expect(trabajaEseDia(tramos, LUNES)).toBe(true)
    expect(trabajaEseDia(tramos, MARTES)).toBe(false)
  })
})

describe('diaBloqueado', () => {
  it('incluye los dos extremos del rango', () => {
    const b = [{ inicio: '2026-09-28', fin: '2026-09-30', motivo: 'Vacaciones' }]
    expect(diaBloqueado(b, '2026-09-28')?.motivo).toBe('Vacaciones')
    expect(diaBloqueado(b, '2026-09-30')).not.toBeNull()
    expect(diaBloqueado(b, '2026-10-01')).toBeNull()
    expect(diaBloqueado(b, '2026-09-27')).toBeNull()
  })
  it('un bloqueo sin fin bloquea todo lo posterior al inicio', () => {
    const b = [{ inicio: '2026-09-28', fin: null }]
    expect(diaBloqueado(b, '2027-03-01')).not.toBeNull()
    expect(diaBloqueado(b, '2026-09-27')).toBeNull()
  })
})

describe('generarHuecos: franja y medias horas', () => {
  it('solo en punto: 14 huecos de 08:00 a 21:00, todos libres sin tramos ni citas', () => {
    const h = generarHuecos(base)
    expect(h).toHaveLength(14)
    expect(h[0]).toEqual({ hora: '08:00', estado: 'libre' })
    expect(h[13]).toEqual({ hora: '21:00', estado: 'libre' })
  })
  it('con medias horas activas: 28 huecos hasta 21:30, todos libres', () => {
    const h = generarHuecos({ ...base, mediaHora: true })
    expect(h).toHaveLength(28)
    expect(h[27]).toEqual({ hora: '21:30', estado: 'libre' })
  })
  it('incluirMedias sin mediaHora: las y media salen como media_hora', () => {
    const h = generarHuecos({ ...base, incluirMedias: true })
    expect(h).toHaveLength(28)
    expect(estado(h, '10:00')).toBe('libre')
    expect(estado(h, '10:30')).toBe('media_hora')
  })
})

describe('generarHuecos: horario', () => {
  it('fuera de horario antes, después y cuando la hora entera no cabe en el tramo', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00', '14:00')], mediaHora: true })
    expect(estado(h, '08:00')).toBe('fuera_horario')
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '13:00')).toBe('libre')
    expect(estado(h, '13:30')).toBe('fuera_horario') // 13:30–14:30 no cabe
    expect(estado(h, '14:00')).toBe('fuera_horario')
  })
  it('tramos partidos: mañana y tarde', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00', '14:00'), t(1, '16:00', '20:00')] })
    expect(estado(h, '15:00')).toBe('fuera_horario')
    expect(estado(h, '16:00')).toBe('libre')
    expect(estado(h, '19:00')).toBe('libre')
    expect(estado(h, '20:00')).toBe('fuera_horario')
  })
  it('día sin tramos pero con horario en otros días: todo fuera de horario', () => {
    const h = generarHuecos({ ...base, fecha: MARTES, tramos: [t(1, '09:00', '14:00')] })
    expect(h.every((x) => x.estado === 'fuera_horario')).toBe(true)
  })
  it('acepta horas con segundos en los tramos', () => {
    const h = generarHuecos({ ...base, tramos: [t(1, '09:00:00', '14:00:00')] })
    expect(estado(h, '09:00')).toBe('libre')
  })
})

describe('generarHuecos: ocupación', () => {
  it('una cita a las 10:00 solo ocupa las 10:00 cuando no hay medias', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: LUNES, hora: '10:00:00' }] })
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('libre')
  })
  it('una cita a las 10:00 con medias ocupa 09:30, 10:00 y 10:30', () => {
    const h = generarHuecos({ ...base, mediaHora: true, citas: [{ fecha: LUNES, hora: '10:00' }] })
    expect(estado(h, '09:00')).toBe('libre')
    expect(estado(h, '09:30')).toBe('ocupado')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '10:30')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('libre')
  })
  it('una cita a las 10:30:00 (con segundos) ocupa 10:00, 10:30 y 11:00', () => {
    const h = generarHuecos({ ...base, mediaHora: true, citas: [{ fecha: LUNES, hora: '10:30:00' }] })
    expect(estado(h, '09:30')).toBe('libre')
    expect(estado(h, '10:00')).toBe('ocupado')
    expect(estado(h, '10:30')).toBe('ocupado')
    expect(estado(h, '11:00')).toBe('ocupado')
    expect(estado(h, '11:30')).toBe('libre')
  })
  it('las citas de otro día no ocupan', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: MARTES, hora: '10:00' }] })
    expect(estado(h, '10:00')).toBe('libre')
  })
  it('la cita que se está cambiando no ocupa', () => {
    const h = generarHuecos({ ...base, citas: [{ fecha: LUNES, hora: '10:00', accionId: 'a1' }], excluirAccionId: 'a1' })
    expect(estado(h, '10:00')).toBe('libre')
  })
  it('un bloqueo del día ocupa todas las horas', () => {
    const h = generarHuecos({ ...base, bloqueos: [{ inicio: LUNES, fin: LUNES }] })
    expect(h.every((x) => x.estado === 'ocupado')).toBe(true)
  })
  it('prioridad: ocupado > fuera_horario > media_hora', () => {
    const h = generarHuecos({
      ...base, incluirMedias: true,
      tramos: [t(1, '09:00', '14:00')],
      citas: [{ fecha: LUNES, hora: '16:00' }],
    })
    expect(estado(h, '16:00')).toBe('ocupado')        // ocupada aunque fuera de horario
    expect(estado(h, '15:30')).toBe('ocupado')        // solapa con la cita de las 16:00
    expect(estado(h, '17:30')).toBe('fuera_horario')  // media hora fuera de horario
    expect(estado(h, '10:30')).toBe('media_hora')     // media hora dentro de horario, sin permiso
  })
})

describe('etiquetaMotivo', () => {
  it('Otros y nulo se muestran como Bloqueo', () => {
    expect(etiquetaMotivo('Otros')).toBe('Bloqueo')
    expect(etiquetaMotivo(null)).toBe('Bloqueo')
    expect(etiquetaMotivo('Vacaciones')).toBe('Vacaciones')
  })
})

describe('motivoAviso', () => {
  const ctx = { ...base, incluirMedias: true, nombrePsicologo: 'Marta', nombreCentro: 'San Blas' }
  it('sin fecha no hay aviso', () => {
    expect(motivoAviso({ ...ctx, fecha: '', hora: '' })).toBeNull()
  })
  it('día bloqueado', () => {
    expect(motivoAviso({ ...ctx, hora: '', bloqueos: [{ inicio: LUNES, fin: LUNES, motivo: 'Vacaciones' }] }))
      .toBe('la agenda de Marta está bloqueada ese día (Vacaciones)')
  })
  it('día no laborable', () => {
    expect(motivoAviso({ ...ctx, fecha: MARTES, hora: '10:00', tramos: [t(1, '09:00', '14:00')] }))
      .toBe('Marta no trabaja los martes en San Blas')
  })
  it('hora ocupada', () => {
    expect(motivoAviso({ ...ctx, hora: '10:00', citas: [{ fecha: LUNES, hora: '10:00:00' }] }))
      .toBe('Marta ya tiene una cita a las 10:00')
  })
  it('hora fuera de horario', () => {
    expect(motivoAviso({ ...ctx, hora: '16:00', tramos: [t(1, '09:00', '14:00')] }))
      .toBe('las 16:00 quedan fuera del horario de Marta en San Blas')
  })
  it('media hora no activa', () => {
    expect(motivoAviso({ ...ctx, hora: '10:30' })).toBe('Marta no tiene activadas las citas a y media')
  })
  it('hora libre o fuera de la rejilla (17:15) no avisa', () => {
    expect(motivoAviso({ ...ctx, hora: '10:00' })).toBeNull()
    expect(motivoAviso({ ...ctx, hora: '17:15' })).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npm test -- lib/disponibilidad.test.ts`
Expected: FAIL, "Failed to resolve import './disponibilidad'".

- [ ] **Step 3: Implementar `lib/disponibilidad.ts`**

```ts
/**
 * Reglas de disponibilidad de un psicólogo para agendar citas. Módulo puro
 * (sin React ni Supabase): recibe tramos, citas y bloqueos ya cargados y
 * devuelve los huecos con su estado. Toda cita dura 60 minutos.
 */
import { aMinutos, aHora, DIAS_SEMANA, type Tramo } from './horarios'

export type { Tramo }

/** Cita activa que ocupa una hora. `hora` 'HH:MM' o 'HH:MM:SS'. */
export type CitaOcupada = { fecha: string; hora: string; accionId?: string }
/** Bloqueo de días completos, ambos incluidos. `fin` nulo = sin fin. */
export type Bloqueo = { inicio: string; fin: string | null; motivo?: string | null }

export type EstadoHueco = 'libre' | 'ocupado' | 'fuera_horario' | 'media_hora'
export type Hueco = { hora: string; estado: EstadoHueco }

export type ParamsHuecos = {
  /** Horario de la ficha. Vacío = sin restricción de horario. */
  tramos: Tramo[]
  /** Citas activas de la persona (todas sus fichas). */
  citas: CitaOcupada[]
  /** Bloqueos activos de la persona. */
  bloqueos: Bloqueo[]
  /** 'YYYY-MM-DD' */
  fecha: string
  /** psicologos.citas_media_hora */
  mediaHora: boolean
  /** Modo aviso (agente): lista las y media aunque no estén activas. */
  incluirMedias: boolean
  /** Al cambiar una cita, su propia fila no ocupa. */
  excluirAccionId?: string
}

export const DURACION_CITA_MIN = 60
export const PRIMER_INICIO_MIN = 8 * 60 // 08:00
export const ULTIMO_INICIO_MIN = 21 * 60 + 30 // 21:30 (con paso 60 el último es 21:00)

/** 1 = lunes … 7 = domingo. */
export function diaSemanaISO(fecha: string): number {
  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** 'lunes', 'martes'… */
export function nombreDia(fecha: string): string {
  return DIAS_SEMANA[diaSemanaISO(fecha) - 1].toLowerCase()
}

export function diaBloqueado(bloqueos: Bloqueo[], fecha: string): Bloqueo | null {
  return bloqueos.find((b) => b.inicio <= fecha && (b.fin == null || fecha <= b.fin)) ?? null
}

/** true si trabaja ese día. Sin tramos = sin restricción = true. */
export function trabajaEseDia(tramos: Tramo[], fecha: string): boolean {
  if (tramos.length === 0) return true
  const dia = diaSemanaISO(fecha)
  return tramos.some((t) => t.dia_semana === dia)
}

/** 'Otros' y nulo se muestran como "Bloqueo"; los motivos con nombre, tal cual. */
export function etiquetaMotivo(motivo: string | null | undefined): string {
  return !motivo || motivo === 'Otros' ? 'Bloqueo' : motivo
}

export function generarHuecos(p: ParamsHuecos): Hueco[] {
  const paso = p.mediaHora || p.incluirMedias ? 30 : 60
  const dia = diaSemanaISO(p.fecha)
  const tramosDia = p.tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)] as const)
  const bloqueado = diaBloqueado(p.bloqueos, p.fecha) !== null
  const iniciosOcupados = p.citas
    .filter((c) => c.fecha === p.fecha && !(p.excluirAccionId && c.accionId === p.excluirAccionId))
    .map((c) => aMinutos(c.hora))
    .filter((m) => !Number.isNaN(m))

  const huecos: Hueco[] = []
  for (let m = PRIMER_INICIO_MIN; m <= ULTIMO_INICIO_MIN; m += paso) {
    const fin = m + DURACION_CITA_MIN
    let estado: EstadoHueco = 'libre'
    if (bloqueado || iniciosOcupados.some((c) => c < fin && c + DURACION_CITA_MIN > m)) {
      estado = 'ocupado'
    } else if (p.tramos.length > 0 && !tramosDia.some(([ini, f]) => ini <= m && fin <= f)) {
      estado = 'fuera_horario'
    } else if (m % 60 !== 0 && !p.mediaHora) {
      estado = 'media_hora'
    }
    huecos.push({ hora: aHora(m), estado })
  }
  return huecos
}

export type ParamsAviso = ParamsHuecos & { hora: string; nombrePsicologo: string; nombreCentro: string }

/**
 * Motivo del aviso para agentes (modo aviso), sin "Aviso:" ni punto final.
 * null cuando la fecha y la hora elegidas son válidas.
 */
export function motivoAviso(p: ParamsAviso): string | null {
  if (!p.fecha) return null
  const bloqueo = diaBloqueado(p.bloqueos, p.fecha)
  if (bloqueo) return `la agenda de ${p.nombrePsicologo} está bloqueada ese día (${etiquetaMotivo(bloqueo.motivo)})`
  if (!trabajaEseDia(p.tramos, p.fecha)) return `${p.nombrePsicologo} no trabaja los ${nombreDia(p.fecha)} en ${p.nombreCentro}`
  if (!p.hora) return null
  const hueco = generarHuecos(p).find((h) => h.hora === p.hora)
  if (!hueco || hueco.estado === 'libre') return null
  if (hueco.estado === 'ocupado') return `${p.nombrePsicologo} ya tiene una cita a las ${p.hora}`
  if (hueco.estado === 'fuera_horario') return `las ${p.hora} quedan fuera del horario de ${p.nombrePsicologo} en ${p.nombreCentro}`
  return `${p.nombrePsicologo} no tiene activadas las citas a y media`
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, los dos ficheros de tests en verde.

- [ ] **Step 5: Build y commit**

Run: `npm run build`
Expected: sin errores.

```bash
git add lib/disponibilidad.ts lib/disponibilidad.test.ts
git commit -m "Módulo puro de disponibilidad: huecos libres, ocupados, fuera de horario y avisos"
```

---
### Task 4: API de usuarios — leer horarios y medias horas, guardarlos

**Files:**
- Modify: `app/api/usuarios/route.ts` (GET, líneas 6-38)
- Modify: `app/api/usuarios/[id]/route.ts` (tipo `EditarBody` y rama `tipo === 'psicologo'` del PATCH)

**Interfaces:**
- Consumes: `validarTramos`, `Tramo` de `lib/horarios.ts`; tipos de la Tarea 1.
- Produces:
  - `GET /api/usuarios` devuelve en cada psicólogo `citas_media_hora: boolean | null` y `horarios: Tramo[]` (ordenados por día y hora), y a nivel raíz `aviso_horarios: string | null` (texto si la migración 012 no está ejecutada).
  - `PATCH /api/usuarios/[id]` acepta `{ tipo: 'psicologo', citas_media_hora?: boolean, horarios?: Tramo[] }`. `citas_media_hora` se aplica a todas las fichas con el mismo email. `horarios` sustituye las filas de esa ficha; 400 con el mensaje de `validarTramos` si no son válidos.

- [ ] **Step 1: GET — devolver horarios y medias horas tolerando que falte la migración**

En `app/api/usuarios/route.ts` sustituir el cuerpo de `GET` (desde `const admin = createSupabaseAdmin()` hasta el `return NextResponse.json({...})` final) por:

```ts
  const admin = createSupabaseAdmin()
  // Dos cadenas literales (no plantilla): supabase-js infiere el tipo de fila a partir del texto del select.
  const [psiesConMedias, ags, centros, horarios] = await Promise.all([
    admin
      .from('psicologos')
      .select('id, nombre, email, telefono, centro_id, calendar_id, activo, puede_bloquear, citas_media_hora')
      .order('nombre'),
    admin.from('agentes').select('id, nombre, email, telefono, centro_id, activo, auth_user_id').order('nombre'),
    admin.from('centros').select('id, nombre').order('nombre'),
    admin
      .from('horarios_psicologos')
      .select('psicologo_id, dia_semana, hora_inicio, hora_fin')
      .order('dia_semana')
      .order('hora_inicio'),
  ])

  // Migración 012 aún no ejecutada: la columna citas_media_hora o la tabla
  // horarios_psicologos no existen. La pantalla sigue funcionando y muestra un aviso.
  let avisoHorarios: string | null = null
  type PsiRow = {
    id: string; nombre: string; email: string | null; telefono: string | null; centro_id: string | null
    calendar_id: string | null; activo: boolean; puede_bloquear: boolean | null; citas_media_hora?: boolean | null
  }
  let psies: PsiRow[] = []
  if (psiesConMedias.error && /citas_media_hora/.test(psiesConMedias.error.message)) {
    const sinMedias = await admin
      .from('psicologos')
      .select('id, nombre, email, telefono, centro_id, calendar_id, activo, puede_bloquear')
      .order('nombre')
    if (sinMedias.error) return NextResponse.json({ error: sinMedias.error.message }, { status: 500 })
    psies = (sinMedias.data ?? []).map((p) => ({ ...p, citas_media_hora: null }))
    avisoHorarios = 'Falta ejecutar la migración 012 (horarios y medias horas): ' + psiesConMedias.error.message
  } else if (psiesConMedias.error) {
    return NextResponse.json({ error: psiesConMedias.error.message }, { status: 500 })
  } else {
    psies = psiesConMedias.data ?? []
  }
  if (ags.error) return NextResponse.json({ error: ags.error.message }, { status: 500 })
  if (centros.error) return NextResponse.json({ error: centros.error.message }, { status: 500 })

  const horariosPorPsicologo = new Map<string, { dia_semana: number; hora_inicio: string; hora_fin: string }[]>()
  if (horarios.error) {
    avisoHorarios = avisoHorarios ?? 'No se pudieron leer los horarios (¿falta ejecutar la migración 012?): ' + horarios.error.message
  } else {
    for (const h of horarios.data ?? []) {
      const lista = horariosPorPsicologo.get(h.psicologo_id) ?? []
      lista.push({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin })
      horariosPorPsicologo.set(h.psicologo_id, lista)
    }
  }

  // Agentes y call center comparten la tabla `agentes`; el rol lo da `perfiles`.
  const staff = ags.data ?? []
  const authIds = staff.map((a) => a.auth_user_id).filter((id): id is string => !!id)
  const rolPorAuthId = new Map<string, string>()
  if (authIds.length) {
    const perfiles = await admin.from('perfiles').select('id, rol').in('id', authIds)
    if (perfiles.error) return NextResponse.json({ error: perfiles.error.message }, { status: 500 })
    for (const p of perfiles.data ?? []) rolPorAuthId.set(p.id, p.rol)
  }
  const esCallCenter = (a: { auth_user_id: string | null }) =>
    !!a.auth_user_id && rolPorAuthId.get(a.auth_user_id) === 'call_center'

  return NextResponse.json({
    psicologos: psies.map((p) => ({ ...p, horarios: horariosPorPsicologo.get(p.id) ?? [] })),
    agentes: staff.filter((a) => !esCallCenter(a)),
    call_center: staff.filter(esCallCenter),
    centros: centros.data ?? [],
    aviso_horarios: avisoHorarios,
  })
```

- [ ] **Step 2: PATCH — medias horas y horario de la ficha**

En `app/api/usuarios/[id]/route.ts`:

Añadir el import tras `import { generateTempPassword } from '@/lib/temp-password'`:

```ts
import { validarTramos, type Tramo } from '@/lib/horarios'
```

En `type EditarBody` añadir tras `puede_bloquear?: boolean   // permiso para bloquear/desbloquear la agenda`:

```ts
  citas_media_hora?: boolean // permite citas a y media (se aplica a todas las fichas de la persona)
  horarios?: Tramo[]         // horario semanal de ESTA ficha (centro); sustituye todas sus filas
```

Dentro de `if (body.tipo === 'psicologo') {`, justo antes de `// Sincronizar nombre en perfiles (atribución coherente)`, añadir:

```ts
    // Medias horas: permiso de la persona → todas sus fichas (mismo email), como puede_bloquear.
    if (body.citas_media_hora !== undefined) {
      const row = await admin.from('psicologos').select('email').eq('id', id).maybeSingle()
      const email = row.data?.email ?? null
      const updMedias = email
        ? await admin.from('psicologos').update({ citas_media_hora: body.citas_media_hora }).eq('email', email)
        : await admin.from('psicologos').update({ citas_media_hora: body.citas_media_hora }).eq('id', id)
      if (updMedias.error) return NextResponse.json({ error: updMedias.error.message }, { status: 500 })
    }

    // Horario semanal de esta ficha (cada centro tiene el suyo): se sustituyen
    // todas sus filas. Si el insert falla, se reponen las anteriores.
    if (body.horarios !== undefined) {
      if (!Array.isArray(body.horarios)) {
        return NextResponse.json({ error: 'Horario no válido' }, { status: 400 })
      }
      const nuevos: Tramo[] = body.horarios.map((h) => ({
        dia_semana: Number(h.dia_semana),
        hora_inicio: String(h.hora_inicio),
        hora_fin: String(h.hora_fin),
      }))
      const errorValidacion = validarTramos(nuevos)
      if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

      const previos = await admin
        .from('horarios_psicologos')
        .select('dia_semana, hora_inicio, hora_fin')
        .eq('psicologo_id', id)
      if (previos.error) return NextResponse.json({ error: previos.error.message }, { status: 500 })

      const del = await admin.from('horarios_psicologos').delete().eq('psicologo_id', id)
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })

      if (nuevos.length > 0) {
        const ins = await admin
          .from('horarios_psicologos')
          .insert(nuevos.map((h) => ({ ...h, psicologo_id: id })))
        if (ins.error) {
          const anteriores = previos.data ?? []
          if (anteriores.length > 0) {
            await admin.from('horarios_psicologos').insert(anteriores.map((h) => ({ ...h, psicologo_id: id })))
          }
          return NextResponse.json({ error: 'No se pudo guardar el horario: ' + ins.error.message }, { status: 500 })
        }
      }
    }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Prueba manual (si la migración 012 ya está ejecutada)**

Con `npm run dev` y sesión de agente, abrir `/api/usuarios` en el navegador: cada psicólogo trae `horarios: []` y `citas_media_hora: false`, y `aviso_horarios` es `null`. Sin la migración, la respuesta sigue siendo 200 y `aviso_horarios` explica que falta ejecutarla.

- [ ] **Step 5: Commit**

```bash
git add app/api/usuarios/route.ts "app/api/usuarios/[id]/route.ts"
git commit -m "API usuarios: horarios por ficha y citas a media hora"
```

---
### Task 5: Usuarios — columna Horarios, editor de horario y botón 30'

**Files:**
- Create: `app/dashboard/usuarios/HorarioEditor.tsx`
- Modify: `app/dashboard/usuarios/page.tsx`

**Interfaces:**
- Consumes: `GET /api/usuarios` (`horarios`, `citas_media_hora`, `aviso_horarios`) y `PATCH /api/usuarios/[id]` (`horarios`, `citas_media_hora`) de la Tarea 4; `resumenHorario`, `validarTramos`, `DIAS_SEMANA`, `Tramo` de `lib/horarios.ts`.
- Produces: componente `HorarioEditor({ titulo, subtitulo, tramosIniciales, busy, onGuardar, onCancelar })`.

- [ ] **Step 1: Crear el editor de horario**

Crear `app/dashboard/usuarios/HorarioEditor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { DIAS_SEMANA, validarTramos, type Tramo } from '@/lib/horarios'

// Horas seleccionables en el editor: de 08:00 a 22:00 en pasos de 30 minutos.
const HORAS: string[] = []
for (let h = 8; h <= 22; h++) {
  HORAS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 22) HORAS.push(`${String(h).padStart(2, '0')}:30`)
}

const select: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
  border: '1px solid rgba(47,90,174,0.25)', background: '#fff', cursor: 'pointer',
}
const btnPeq: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid rgba(47,90,174,0.3)', background: '#fff', color: '#2f5aae', cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

type Props = {
  titulo: string
  subtitulo: string
  tramosIniciales: Tramo[]
  busy: boolean
  onGuardar: (tramos: Tramo[]) => Promise<void>
  onCancelar: () => void
}

/**
 * Panel modal para editar el horario semanal de UNA ficha (psicólogo × centro).
 * Siete días, cada uno con cero o más tramos (inicio–fin). Valida antes de guardar.
 */
export default function HorarioEditor({ titulo, subtitulo, tramosIniciales, busy, onGuardar, onCancelar }: Props) {
  const [tramos, setTramos] = useState<Tramo[]>(() =>
    tramosIniciales.map((t) => ({ ...t, hora_inicio: t.hora_inicio.slice(0, 5), hora_fin: t.hora_fin.slice(0, 5) })),
  )
  const [error, setError] = useState<string | null>(null)

  function añadir(dia: number) {
    setTramos((prev) => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '14:00' }])
  }
  function quitar(indice: number) {
    setTramos((prev) => prev.filter((_, i) => i !== indice))
  }
  function cambiar(indice: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setTramos((prev) => prev.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)))
  }
  async function guardar() {
    const mensaje = validarTramos(tramos)
    if (mensaje) { setError(mensaje); return }
    setError(null)
    await onGuardar(tramos)
  }

  return (
    <div
      onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(39,38,38,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Horario de ${titulo}`}
        style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#272626' }}>Horario de {titulo}</div>
        <div style={{ fontSize: 12.5, color: '#667799', marginBottom: 16 }}>{subtitulo}</div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        {DIAS_SEMANA.map((nombre, i) => {
          const dia = i + 1
          const delDia = tramos.map((t, indice) => ({ t, indice })).filter(({ t }) => t.dia_semana === dia)
          return (
            <div key={dia} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'start', padding: '10px 0', borderTop: '1px solid rgba(47,90,174,0.1)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4a5870', paddingTop: 7 }}>{nombre}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {delDia.length === 0 && <div style={{ fontSize: 12.5, color: '#8899bb', paddingTop: 7 }}>No trabaja</div>}
                {delDia.map(({ t, indice }) => (
                  <div key={indice} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={t.hora_inicio} onChange={(e) => cambiar(indice, 'hora_inicio', e.target.value)} style={select} aria-label="Hora de inicio">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span style={{ color: '#8899bb' }}>–</span>
                    <select value={t.hora_fin} onChange={(e) => cambiar(indice, 'hora_fin', e.target.value)} style={select} aria-label="Hora de fin">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <button type="button" onClick={() => quitar(indice)} style={{ ...btnPeq, color: '#b91c1c', borderColor: 'rgba(185,28,28,0.3)' }}>Quitar</button>
                  </div>
                ))}
                <div>
                  <button type="button" onClick={() => añadir(dia)} style={btnPeq}>+ Añadir tramo</button>
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onCancelar} disabled={busy} style={{ ...btnPeq, padding: '9px 16px' }}>Cancelar</button>
          <button
            type="button"
            onClick={guardar}
            disabled={busy}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {busy ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ampliar la página de Usuarios**

En `app/dashboard/usuarios/page.tsx`:

(a) Imports: tras `import { Fragment, useEffect, useRef, useState } from 'react'` añadir:

```tsx
import HorarioEditor from './HorarioEditor'
import { resumenHorario, type Tramo } from '@/lib/horarios'
```

(b) Tipo local `Psicologo`: sustituir `puede_bloquear: boolean | null` por:

```ts
  puede_bloquear: boolean | null
  citas_media_hora: boolean | null
  horarios: Tramo[]
```

(c) Estado: tras `const [resultado, setResultado] = useState<...>(null)` añadir:

```tsx
  // Ficha cuyo horario se está editando (abre el modal) y aviso de la API si
  // falta la migración 012.
  const [editandoHorario, setEditandoHorario] = useState<Psicologo | null>(null)
  const [avisoHorarios, setAvisoHorarios] = useState<string | null>(null)
```

(d) En `cargar()`, tras `setCentros(data.centros ?? [])` añadir:

```tsx
      setAvisoHorarios(data.aviso_horarios ?? null)
```

(e) `patchUsuario` debe devolver si fue bien. Sustituir su firma y cuerpo por:

```tsx
  // PATCH compartido para editar/desactivar: siempre limpia busy y muestra errores.
  // Devuelve true si se guardó.
  async function patchUsuario(id: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo guardar el cambio')
        return false
      }
      await cargar()
      return true
    } catch {
      setError('Error de conexión al guardar')
      return false
    } finally {
      setBusy(false)
    }
  }
```

(f) Tras `toggleBloqueo` añadir:

```tsx
  // Permite / quita las citas a y media. Se aplica a todas sus fichas (misma persona).
  async function toggleMediaHora(id: string, actual: boolean) {
    await patchUsuario(id, { tipo: 'psicologo', citas_media_hora: !actual })
  }

  // Guarda el horario de la ficha abierta en el editor y lo cierra si fue bien.
  async function guardarHorario(tramos: Tramo[]) {
    if (!editandoHorario) return
    const ok = await patchUsuario(editandoHorario.id, { tipo: 'psicologo', horarios: tramos })
    if (ok) setEditandoHorario(null)
  }
```

(g) Aviso de migración: justo después del bloque `{error && (...)}` añadir:

```tsx
      {avisoHorarios && (
        <div style={{ background: '#fff7e6', border: '1.5px solid #f5d08a', color: '#8a5a00', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {avisoHorarios}
        </div>
      )}
```

(h) Tabla de psicólogos:
- Cabeceras: `['Nombre', 'Centro', 'Email', 'Calendario', 'Estado']` → `['Nombre', 'Centro', 'Horarios', 'Email', 'Calendario', 'Estado']`.
- `minWidth: 720` → `minWidth: 860`; los dos `colSpan={5}` de esa tabla → `colSpan={6}`.
- Tras la celda de Centro (`<td ...>{centroMap[p.centro_id ?? ''] ?? '—'}</td>`) añadir:

```tsx
                      <td style={{ ...td, paddingBottom: 6, fontSize: 12.5, minWidth: 180 }}>
                        {p.horarios.length > 0
                          ? resumenHorario(p.horarios)
                          : <span style={{ color: '#8899bb' }}>Sin horario</span>}
                      </td>
```

- En la celda Estado, tras el `<div>` de "Puede bloquear agenda" añadir:

```tsx
                        <div style={{ fontSize: 11.5, color: p.citas_media_hora ? '#1e7d4f' : '#8899bb', marginTop: 2 }}>
                          {p.citas_media_hora ? '✓ Citas a y media' : 'Solo en punto'}
                        </div>
```

- En la fila de acciones, después del botón `Calendario` añadir:

```tsx
                          <ActionButton onClick={() => setEditandoHorario(p)} disabled={busy} title="Días y horas en que trabaja en este centro">Horario</ActionButton>
                          <ActionButton onClick={() => toggleMediaHora(p.id, !!p.citas_media_hora)} disabled={busy} variant={p.citas_media_hora ? 'default' : 'success'} title="Permitir o quitar citas a las medias horas para este psicólogo (todos sus centros)">{p.citas_media_hora ? "Quitar 30'" : "30'"}</ActionButton>
```

(i) Modal: justo antes del `</div>` final del `return` (el que cierra `<div className="page-pad" ...>`) añadir:

```tsx
      {editandoHorario && (
        <HorarioEditor
          titulo={editandoHorario.nombre}
          subtitulo={`Centro: ${centroMap[editandoHorario.centro_id ?? ''] ?? '—'}. Cada centro tiene su propio horario.`}
          tramosIniciales={editandoHorario.horarios}
          busy={busy}
          onGuardar={guardarHorario}
          onCancelar={() => setEditandoHorario(null)}
        />
      )}
```

- [ ] **Step 3: Build y prueba manual**

Run: `npm run build`
Expected: sin errores.

Con `npm run dev`, sesión de agente y la migración 012 ejecutada, en `/dashboard/usuarios`:
1. La columna Horarios muestra "Sin horario" en todas las fichas.
2. Pulsar **Horario** en "Sonia · Salamanca": añadir lunes 09:00–14:00 y miércoles 09:00–14:00 y 16:00–20:00; Guardar. La fila muestra `L 09:00–14:00 · X 09:00–14:00 y 16:00–20:00`.
3. Volver a abrir y poner un tramo con fin anterior al inicio → error en rojo dentro del modal, no se guarda.
4. Pulsar **30'** → la celda Estado pasa a "✓ Citas a y media" en esa ficha y en cualquier otra ficha de la misma persona (BEA tiene dos).
5. En Supabase: `SELECT * FROM horarios_psicologos;` muestra las tres filas.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/usuarios/HorarioEditor.tsx app/dashboard/usuarios/page.tsx
git commit -m "Usuarios: horario semanal por ficha y botón 30' de medias horas"
```

---

### Task 6: `TimeSelect` con opciones de disponibilidad

**Files:**
- Modify: `app/dashboard/_components/TimeSelect.tsx`

**Interfaces:**
- Consumes: `Hueco`, `EstadoHueco` de `lib/disponibilidad.ts`.
- Produces: props nuevas `opciones?: Hueco[]`, `soloLibres?: boolean`, `placeholder?: string`. Sin `opciones` se comporta como hoy (lo siguen usando los bloqueos).

- [ ] **Step 1: Reescribir el componente**

Sustituir el contenido completo de `app/dashboard/_components/TimeSelect.tsx` por:

```tsx
'use client'

import type { EstadoHueco, Hueco } from '@/lib/disponibilidad'

// Citas solo a en punto o y media (08:00–21:30). Es la lista por defecto cuando
// no se pasan `opciones` (bloqueos y usos antiguos).
const OPCIONES_HORA: string[] = []
for (let h = 8; h <= 21; h++) {
  const hh = String(h).padStart(2, '0')
  OPCIONES_HORA.push(`${hh}:00`, `${hh}:30`)
}

// Sufijo que ve el agente en modo aviso para saber por qué un hueco no es libre.
const SUFIJO: Record<EstadoHueco, string> = {
  libre: '',
  ocupado: ' · ocupada',
  fuera_horario: ' · fuera de horario',
  media_hora: ' · media hora no activa',
}

export default function TimeSelect({
  value,
  onChange,
  required,
  disabled,
  style,
  opciones,
  soloLibres,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  /** Huecos calculados por lib/disponibilidad. Sin ellos, lista fija 08:00–21:30. */
  opciones?: Hueco[]
  /** true (psicólogo / call center): solo se listan los huecos libres. */
  soloLibres?: boolean
  placeholder?: string
}) {
  let lista: Hueco[] = opciones
    ? soloLibres
      ? opciones.filter((h) => h.estado === 'libre')
      : opciones
    : OPCIONES_HORA.map((hora) => ({ hora, estado: 'libre' as const }))

  // A legacy value outside the grid (e.g. an old 17:15 appointment) must still
  // render as selected instead of silently falling back to the placeholder.
  if (value && !lista.some((h) => h.hora === value)) {
    lista = [...lista, { hora: value, estado: 'libre' as const }].sort((a, b) => a.hora.localeCompare(b.hora))
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      style={{ ...style, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <option value="">{placeholder ?? '— Selecciona hora —'}</option>
      {lista.map((h) => (
        <option key={h.hora} value={h.hora}>
          {h.hora}
          {SUFIJO[h.estado]}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores; los usos actuales (`<TimeSelect value={hora} onChange={setHora} style={inputStyle} />`) siguen compilando sin cambios.

- [ ] **Step 3: Comprobación manual del valor antiguo (Review Focus 4)**

En `npm run dev`, en Citas, con cualquier acción de bloqueo elegir "Hora inicio" 17:00: sigue apareciendo la lista de siempre. (El caso 17:15 con `opciones` se verá en la Tarea 8 al cambiar una cita antigua: la nueva hora se elige entre huecos; la hora vieja sigue visible en el desplegable "Cita a cambiar".)

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/_components/TimeSelect.tsx
git commit -m "TimeSelect: opciones de disponibilidad con estado por hueco"
```

---
### Task 7: Carga de datos de disponibilidad y hook `useDisponibilidad`

**Files:**
- Create: `lib/disponibilidad-datos.ts`
- Create: `app/dashboard/psicologos/useDisponibilidad.ts`

**Interfaces:**
- Consumes: `supabase` (cliente navegador), `todayISODate` de `lib/eventos-activos.ts`, tipos de `lib/disponibilidad.ts` y `lib/horarios.ts`.
- Produces:
  - `type PsicologoDisponibilidad = { id: string; nombre: string; calendar_id: string | null; citas_media_hora: boolean | null }`
  - `type DatosDisponibilidad = { tramos: Tramo[]; citas: CitaOcupada[]; bloqueos: Bloqueo[]; mediaHora: boolean }`
  - `cargarDatosDisponibilidad(p: PsicologoDisponibilidad): Promise<DatosDisponibilidad>`
  - `useDisponibilidad(psicologo: PsicologoDisponibilidad | null): { datos: DatosDisponibilidad | null; cargando: boolean; error: string | null; recargar: () => void }`

- [ ] **Step 1: Crear el cargador**

Crear `lib/disponibilidad-datos.ts`:

```ts
import { supabase } from '@/lib/supabase'
import { todayISODate } from '@/lib/eventos-activos'
import type { Tramo } from '@/lib/horarios'
import type { Bloqueo, CitaOcupada } from '@/lib/disponibilidad'

export type PsicologoDisponibilidad = {
  id: string
  nombre: string
  calendar_id: string | null
  citas_media_hora: boolean | null
}

export type DatosDisponibilidad = {
  tramos: Tramo[]
  citas: CitaOcupada[]
  bloqueos: Bloqueo[]
  mediaHora: boolean
}

/**
 * Carga lo que hace falta para calcular los huecos de una ficha de psicólogo:
 * - sus tramos de horario (solo de ESTA ficha: cada centro tiene su horario);
 * - las citas activas futuras y los bloqueos activos de TODAS las fichas de la
 *   misma persona (mismo calendar_id), porque comparten calendario y una cita
 *   en un centro la ocupa también en los demás.
 * Lanza el error de Supabase si alguna consulta falla (el hook lo traduce a
 * "sin restricción" + mensaje).
 */
export async function cargarDatosDisponibilidad(p: PsicologoDisponibilidad): Promise<DatosDisponibilidad> {
  const hoy = todayISODate()

  let fichas = [p.id]
  if (p.calendar_id) {
    const { data, error } = await supabase.from('psicologos').select('id').eq('calendar_id', p.calendar_id)
    if (error) throw error
    fichas = Array.from(new Set([p.id, ...(data ?? []).map((r) => r.id)]))
  }

  const [tramosRes, citasRes, bloqueosRes] = await Promise.all([
    supabase
      .from('horarios_psicologos')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('psicologo_id', p.id)
      .order('dia_semana')
      .order('hora_inicio'),
    supabase
      .from('acciones_psicologos')
      .select('id, fecha_cita, hora_cita')
      .in('psicologo_id', fichas)
      .eq('accion', 'Agendar cita')
      .eq('activo', true)
      .gte('fecha_cita', hoy),
    supabase
      .from('acciones_psicologos')
      .select('fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
      .in('psicologo_id', fichas)
      .eq('accion', 'Bloquear agenda')
      .eq('activo', true)
      .or(`fecha_bloqueo_fin.gte.${hoy},fecha_bloqueo_fin.is.null`),
  ])
  if (tramosRes.error) throw tramosRes.error
  if (citasRes.error) throw citasRes.error
  if (bloqueosRes.error) throw bloqueosRes.error

  return {
    tramos: (tramosRes.data ?? []) as Tramo[],
    citas: (citasRes.data ?? [])
      .filter((c) => c.fecha_cita && c.hora_cita)
      .map((c) => ({ fecha: c.fecha_cita as string, hora: c.hora_cita as string, accionId: c.id })),
    bloqueos: (bloqueosRes.data ?? [])
      .filter((b) => b.fecha_bloqueo_inicio)
      .map((b) => ({ inicio: b.fecha_bloqueo_inicio as string, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo })),
    mediaHora: !!p.citas_media_hora,
  }
}
```

- [ ] **Step 2: Crear el hook**

Crear `app/dashboard/psicologos/useDisponibilidad.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'
import {
  cargarDatosDisponibilidad,
  type DatosDisponibilidad,
  type PsicologoDisponibilidad,
} from '@/lib/disponibilidad-datos'

/**
 * Carga tramos, citas y bloqueos de la ficha indicada (null = nada que cargar).
 * Si la carga falla se devuelve "sin restricción" (listas vacías) y el mensaje,
 * para que el formulario siga funcionando aunque falte la migración 012.
 */
export function useDisponibilidad(psicologo: PsicologoDisponibilidad | null) {
  const [datos, setDatos] = useState<DatosDisponibilidad | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const id = psicologo?.id ?? null

  useEffect(() => {
    if (!psicologo) {
      setDatos(null)
      setError(null)
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    cargarDatosDisponibilidad(psicologo)
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((e: unknown) => {
        if (cancelado) return
        setDatos({ tramos: [], citas: [], bloqueos: [], mediaHora: !!psicologo.citas_media_hora })
        setError(e instanceof Error ? e.message : 'No se pudo cargar la disponibilidad')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
    // Solo cambia de ficha o al pedir recarga; el objeto psicólogo se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version])

  return { datos, cargando, error, recargar: () => setVersion((v) => v + 1) }
}
```

- [ ] **Step 3: Build y commit**

Run: `npm run build`
Expected: sin errores (aún nadie usa el hook; si ESLint avisa de export sin uso, ignorar: se usa en la Tarea 8).

```bash
git add lib/disponibilidad-datos.ts app/dashboard/psicologos/useDisponibilidad.ts
git commit -m "Carga de disponibilidad (tramos, citas y bloqueos) y hook useDisponibilidad"
```

---

### Task 8: Citas — huecos reales para psicólogo y call center, aviso para agentes

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx`

**Interfaces:**
- Consumes: `useDisponibilidad` (Tarea 7), `generarHuecos`, `diaBloqueado`, `trabajaEseDia`, `motivoAviso`, `nombreDia`, `etiquetaMotivo` (Tarea 3), `TimeSelect` con `opciones` (Tarea 6), `todayISODate` (`lib/eventos-activos.ts`).

- [ ] **Step 1: Imports**

Línea 3: `import { useState, useEffect } from 'react'` → `import { useState, useEffect, useMemo } from 'react'`.

Línea 8: `import { fetchCitasActivas, fetchBloqueosActivos, type EventoActivo } from '@/lib/eventos-activos'` → añadir `todayISODate`:

```ts
import { fetchCitasActivas, fetchBloqueosActivos, todayISODate, type EventoActivo } from '@/lib/eventos-activos'
```

Tras la línea 10 (`import { getCentroActivo, ... } from '@/lib/centro-activo'`) añadir:

```ts
import { generarHuecos, diaBloqueado, trabajaEseDia, motivoAviso, nombreDia, etiquetaMotivo } from '@/lib/disponibilidad'
import { useDisponibilidad } from './useDisponibilidad'
```

- [ ] **Step 2: Estado derivado de disponibilidad**

Justo después de la línea `const eventoActual = [...citasActivas, ...bloqueosActivos].find((e) => e.id === eventoSeleccionadoId)` añadir:

```tsx
  // ── Disponibilidad (horario + huecos ocupados) ─────────────────────────────
  // Agente (o sin perfil): modo aviso, todo seleccionable con aviso antes de enviar.
  // Psicólogo y call center: modo restringido, solo huecos libres.
  const modoDisponibilidad: 'aviso' | 'restringido' = !perfil || perfil.rol === 'agente' ? 'aviso' : 'restringido'
  const psicologoDisp = pideTipoCita ? (psicologos.find((p) => p.id === effPsicologoId) ?? null) : null
  const { datos: disp, cargando: cargandoDisp, error: errorDisp, recargar: recargarDisp } = useDisponibilidad(psicologoDisp)
  const excluirAccionId = isCambiarCita ? eventoActual?.id : undefined
  const huecos = useMemo(() => {
    if (!disp || !fecha) return null
    return generarHuecos({ ...disp, fecha, incluirMedias: modoDisponibilidad === 'aviso', excluirAccionId })
  }, [disp, fecha, modoDisponibilidad, excluirAccionId])
  const bloqueoDia = disp && fecha ? diaBloqueado(disp.bloqueos, fecha) : null
  const diaNoLaborable = !!(disp && fecha && !trabajaEseDia(disp.tramos, fecha))
  const nombreCentroDisp = centros.find((c) => c.id === effCentroId)?.nombre ?? ''
  const restringido = modoDisponibilidad === 'restringido'
  const sinHorasHoy = restringido && (!!bloqueoDia || diaNoLaborable)
  const hayHuecoLibre = (huecos ?? []).some((h) => h.estado === 'libre')
  const avisoDisp =
    !restringido && disp && fecha && psicologoDisp
      ? motivoAviso({ ...disp, fecha, hora, incluirMedias: true, excluirAccionId, nombrePsicologo: psicologoDisp.nombre, nombreCentro: nombreCentroDisp })
      : null

  // Modo restringido: si al cambiar la fecha la hora elegida deja de estar libre, se vacía.
  useEffect(() => {
    if (!restringido || !huecos || !hora) return
    if (!huecos.some((h) => h.hora === hora && h.estado === 'libre')) setHora('')
  }, [restringido, huecos, hora])
```

- [ ] **Step 3: Validación en el envío**

En `handleSubmit`, justo después del bloque

```tsx
    if (pideTipoCita && !tipoCita) {
      setError('Selecciona el tipo de cita (adulto, pareja o menor).')
      return
    }
```

añadir:

```tsx
    if (pideTipoCita && (!fecha || !hora)) {
      setError('Indica la fecha y la hora de la cita.')
      return
    }
    if (pideTipoCita && restringido && cargandoDisp) {
      setError('Espera un momento: se está cargando la disponibilidad.')
      return
    }
    if (pideTipoCita && restringido && (sinHorasHoy || !(huecos ?? []).some((h) => h.hora === hora && h.estado === 'libre'))) {
      setError('La hora elegida ya no está disponible. Elige otra.')
      return
    }
```

Y en la rama CITAS / BLOQUEOS, tras `setSuccess(true)` (el que sigue al `insert` en `formulario_citas_psicologos`) añadir `recargarDisp()` antes de `resetForm()`:

```tsx
      setSuccess(true)
      recargarDisp()
      resetForm()
```

- [ ] **Step 4: Campos de fecha y hora**

Sustituir el bloque

```tsx
                  <div className="r-grid-2" style={{ gap: 16 }}>
                    <FormField label={isCambiarCita ? 'Nueva fecha' : 'Fecha de cita'}>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label={isCambiarCita ? 'Nueva hora' : 'Hora de cita'}>
                      <TimeSelect value={hora} onChange={setHora} style={inputStyle} />
                    </FormField>
                  </div>
```

por:

```tsx
                  <div className="r-grid-2" style={{ gap: 16 }}>
                    <FormField label={isCambiarCita ? 'Nueva fecha' : 'Fecha de cita'} required>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        min={restringido ? todayISODate() : undefined}
                        style={inputStyle}
                        required
                      />
                    </FormField>
                    <FormField label={isCambiarCita ? 'Nueva hora' : 'Hora de cita'} required>
                      <TimeSelect
                        value={hora}
                        onChange={setHora}
                        style={inputStyle}
                        required
                        disabled={cargandoDisp || sinHorasHoy || (restringido && !fecha)}
                        opciones={huecos ?? undefined}
                        soloLibres={restringido}
                        placeholder={
                          cargandoDisp ? 'Cargando disponibilidad…'
                          : restringido && !fecha ? '— Primero elige la fecha —'
                          : undefined
                        }
                      />
                      {restringido && bloqueoDia && (
                        <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 6 }}>
                          Agenda bloqueada ese día ({etiquetaMotivo(bloqueoDia.motivo)}).
                        </div>
                      )}
                      {restringido && !bloqueoDia && diaNoLaborable && psicologoDisp && (
                        <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 6 }}>
                          {psicologoDisp.nombre} no trabaja los {nombreDia(fecha)} en {nombreCentroDisp}.
                        </div>
                      )}
                      {restringido && !sinHorasHoy && huecos && !hayHuecoLibre && (
                        <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 6 }}>
                          No quedan huecos libres ese día.
                        </div>
                      )}
                      {errorDisp && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                          No se pudo cargar la disponibilidad: se muestran todas las horas.
                        </div>
                      )}
                    </FormField>
                  </div>
```

- [ ] **Step 5: Aviso ámbar antes del botón de enviar (modo aviso)**

Dentro de `{/* Submit */}` `<div style={{ marginTop: 28 }}>`, justo antes de `{(() => {`, añadir:

```tsx
            {avisoDisp && (
              <div
                style={{
                  background: '#fff7e6',
                  border: '1.5px solid #f5d08a',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 14,
                  color: '#8a5a00',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>Aviso:</strong> {avisoDisp}. Puedes agendar igualmente.
              </div>
            )}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: sin errores ni avisos de hooks.

- [ ] **Step 7: Prueba manual con los tres roles (migración 012 ejecutada)**

Preparación en Usuarios: "Sonia · Salamanca" con horario lunes y miércoles 09:00–14:00, sin 30'. Tener una cita activa suya a las 10:00 de un lunes próximo (agendarla como agente si no existe).

Como **agente** en Citas, Salamanca → Sonia → Agendar cita:
1. Fecha = ese lunes: el desplegable de hora lista 08:00…21:30 con sufijos: `08:00 · fuera de horario`, `09:30 · media hora no activa`, `10:00 · ocupada`, `11:00` sin sufijo.
2. Elegir 10:00 → aviso ámbar "Sonia ya tiene una cita a las 10:00. Puedes agendar igualmente." El botón sigue activo.
3. Fecha = martes → aviso "Sonia no trabaja los martes en Salamanca".
4. Fecha y hora válidas (lunes 11:00) → sin aviso.

Como **call center** (mismo centro y psicóloga):
1. Sin fecha, el desplegable de hora está desactivado con "— Primero elige la fecha —".
2. Fecha = martes → hora desactivada y texto "Sonia no trabaja los martes en Salamanca."
3. Fecha = lunes → solo 09:00, 11:00, 12:00, 13:00 (10:00 ocupada; 13:00 cabe porque el tramo acaba a las 14:00).
4. Activar 30' en Usuarios y recargar Citas: aparecen además 11:30 y 12:30. No aparece 09:30 (09:30–10:30 solapa con la cita de las 10:00) ni 13:30 (13:30–14:30 no cabe en el tramo).
5. Cambiar cita de esa cita de las 10:00: al elegir el mismo lunes, las 10:00 aparecen como libres (la propia cita no ocupa).

Como **psicóloga** (Sonia): mismo comportamiento que call center, fijada a su agenda.

Bloqueo: crear "Vacaciones" un día y comprobar que como call center la hora se desactiva con "Agenda bloqueada ese día (Vacaciones)." y como agente sale el aviso.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/psicologos/page.tsx
git commit -m "Citas: solo huecos libres para psicólogo y call center; aviso para agentes"
```

---

### Task 9: Documentar la fase 1

**Files:**
- Modify: `docs/roles-y-permisos.md`

- [ ] **Step 1: Añadir la sección de horarios**

En `docs/roles-y-permisos.md`, actualizar la línea `Última revisión: ...` a `Última revisión: 26-09-2026 (horarios de psicólogos, medias horas y disponibilidad en Citas).` y añadir, antes de `## Cómo se aplica en el código`, esta sección:

```markdown
## Horarios de psicólogos y disponibilidad en Citas

Desde la migración `Supabase/migrations/012_horarios_psicologos.sql` cada **ficha** de psicólogo
(persona × centro) tiene su horario semanal en la tabla `horarios_psicologos` (día de la semana y
uno o varios tramos), y la persona tiene el permiso `psicologos.citas_media_hora` (citas a y media).

- Los **agentes** lo gestionan en Usuarios: columna **Horarios** (resumen tipo `L, X 09:00–14:00 · V 16:00–20:00`),
  botón **Horario** (editor de siete días) y botón **30'** (medias horas; se aplica a todas las fichas
  de la persona, como el permiso de bloqueo). Nadie más puede editarlo.
- Una ficha **sin horario** no restringe nada: solo se ocultan las horas ya ocupadas.
- Toda cita dura **60 minutos**. Se ofrecen las horas de 08:00 a 21:00 en punto y, si la persona tiene 30',
  también las y media hasta 21:30.
- En Citas (Agendar y Cambiar cita):
  - **Psicólogo y call center** solo ven los huecos libres: dentro del horario del psicólogo en ese centro,
    sin cita activa que se solape (contando todas las fichas de la persona, porque comparten calendario) y sin
    bloqueo de agenda ese día. Si el día no es laborable o está bloqueado, el selector de hora se desactiva y
    se explica el motivo.
  - **Agente** puede elegir cualquier fecha y hora; si se sale del horario, elige una hora ocupada o una media
    hora no activa, ve un aviso ámbar encima del botón de enviar y puede continuar.
- Lógica: `lib/horarios.ts` (tramos, validación, resumen), `lib/disponibilidad.ts` (huecos y avisos; con tests
  en `npm test`), `lib/disponibilidad-datos.ts` (carga desde Supabase) y `app/dashboard/psicologos/useDisponibilidad.ts`.
- Make no interviene: el horario solo lo lee la app.
```

- [ ] **Step 2: Commit**

```bash
git add docs/roles-y-permisos.md
git commit -m "Docs: horarios de psicólogos, medias horas y disponibilidad en Citas"
```

---
## Fase 2 — Calendario

### Task 10: Módulo puro `lib/calendario.ts` (semanas, filtros, colores)

**Files:**
- Create: `lib/calendario.ts`
- Test: `lib/calendario.test.ts`

**Interfaces:**
- Consumes: `aMinutos`, `Tramo` de `lib/horarios.ts`; `diaSemanaISO` de `lib/disponibilidad.ts`.
- Produces:
  - `type EventoCalendario = { id; tipo: 'cita' | 'bloqueo'; psicologoId; psicologoNombre; centroId: string | null; fecha: string | null; hora: string | null; tipoCita: string | null; iniciales: string | null; inicio: string | null; fin: string | null; motivo: string | null }`
  - `type FiltrosCalendario = { centroId: string; tipoCita: string; psicologoId: string }` (`''` = todos; `tipoCita` admite `'sin_tipo'`)
  - `TIPOS_CITA_FILTRO: { value: string; label: string }[]`
  - `sumarDias(fecha, n)`, `lunesDeSemana(fecha)`, `diasDeSemana(lunes): string[]`, `etiquetaRangoSemana(lunes)`, `etiquetaDia(fecha)`
  - `FILAS_HORA: string[]` (`'08:00'`…`'21:30'`, 28 filas), `filaDeHora(hora): number` (−1 fuera de franja)
  - `filtrarEventos(eventos, filtros)`, `bloqueoCubreDia(evento, fecha)`, `tramoCubreCelda(tramos, fecha, filaHora)`
  - `PALETA_CENTROS`, `colorCentro(indice): { fondo; borde; texto }`, `etiquetaTipoCita(tipo)`

- [ ] **Step 1: Escribir los tests (fallan)**

Crear `lib/calendario.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  sumarDias, lunesDeSemana, diasDeSemana, etiquetaRangoSemana, etiquetaDia,
  FILAS_HORA, filaDeHora, filtrarEventos, bloqueoCubreDia, tramoCubreCelda, colorCentro, etiquetaTipoCita,
  type EventoCalendario,
} from './calendario'

const cita = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'c1', tipo: 'cita', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: '2026-09-28', hora: '10:00', tipoCita: 'adulto', iniciales: 'AB (Ana)',
  inicio: null, fin: null, motivo: null, ...extra,
})
const bloqueo = (extra: Partial<EventoCalendario>): EventoCalendario => ({
  id: 'b1', tipo: 'bloqueo', psicologoId: 'p1', psicologoNombre: 'Marta', centroId: 'sb',
  fecha: null, hora: null, tipoCita: null, iniciales: null,
  inicio: '2026-09-28', fin: '2026-09-30', motivo: 'Vacaciones', ...extra,
})

describe('fechas de semana', () => {
  it('sumarDias cruza el fin de mes', () => {
    expect(sumarDias('2026-09-28', 3)).toBe('2026-10-01')
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
  })
  it('lunesDeSemana devuelve el lunes anterior o el mismo día si ya es lunes', () => {
    expect(lunesDeSemana('2026-09-28')).toBe('2026-09-28') // lunes
    expect(lunesDeSemana('2026-09-27')).toBe('2026-09-21') // domingo
    expect(lunesDeSemana('2026-09-30')).toBe('2026-09-28') // miércoles
  })
  it('diasDeSemana cruza el año', () => {
    const dias = diasDeSemana('2026-12-28')
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2026-12-28')
    expect(dias[6]).toBe('2027-01-03')
  })
  it('etiquetaRangoSemana muestra ambos extremos y el año del final', () => {
    expect(etiquetaRangoSemana('2026-12-28')).toMatch(/^28 dic\.? – 3 ene\.? 2027$/)
  })
  it('etiquetaDia muestra día de la semana corto y número', () => {
    expect(etiquetaDia('2026-09-28')).toMatch(/^lun\.? 28$/)
  })
})

describe('filas de la rejilla', () => {
  it('hay 28 filas de 08:00 a 21:30', () => {
    expect(FILAS_HORA).toHaveLength(28)
    expect(FILAS_HORA[0]).toBe('08:00')
    expect(FILAS_HORA[27]).toBe('21:30')
  })
  it('filaDeHora acepta HH:MM y HH:MM:SS y devuelve -1 fuera de franja', () => {
    expect(filaDeHora('08:00')).toBe(0)
    expect(filaDeHora('10:30:00')).toBe(5)
    expect(filaDeHora('21:30')).toBe(27)
    expect(filaDeHora('07:00')).toBe(-1)
    expect(filaDeHora('22:00')).toBe(-1)
  })
})

describe('filtrarEventos', () => {
  const eventos = [
    cita({ id: 'c1', centroId: 'sb', tipoCita: 'adulto', psicologoId: 'p1' }),
    cita({ id: 'c2', centroId: 'sal', tipoCita: 'pareja', psicologoId: 'p2' }),
    cita({ id: 'c3', centroId: 'sb', tipoCita: null, psicologoId: 'p1' }),
    bloqueo({ id: 'b1', centroId: 'sb', psicologoId: 'p1' }),
  ]
  it('sin filtros devuelve todo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: '', psicologoId: '' })).toHaveLength(4)
  })
  it('filtra por centro (citas y bloqueos)', () => {
    expect(filtrarEventos(eventos, { centroId: 'sal', tipoCita: '', psicologoId: '' }).map((e) => e.id)).toEqual(['c2'])
  })
  it('filtra por tipo de cita sin quitar los bloqueos', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: 'adulto', psicologoId: '' }).map((e) => e.id)).toEqual(['c1', 'b1'])
  })
  it('"sin_tipo" devuelve las citas sin tipo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: 'sin_tipo', psicologoId: '' }).map((e) => e.id)).toEqual(['c3', 'b1'])
  })
  it('filtra por psicólogo', () => {
    expect(filtrarEventos(eventos, { centroId: '', tipoCita: '', psicologoId: 'p2' }).map((e) => e.id)).toEqual(['c2'])
  })
})

describe('bloqueoCubreDia / tramoCubreCelda', () => {
  it('un bloqueo cubre sus días, extremos incluidos, y sin fin cubre lo posterior', () => {
    expect(bloqueoCubreDia(bloqueo({}), '2026-09-28')).toBe(true)
    expect(bloqueoCubreDia(bloqueo({}), '2026-09-30')).toBe(true)
    expect(bloqueoCubreDia(bloqueo({}), '2026-10-01')).toBe(false)
    expect(bloqueoCubreDia(bloqueo({ fin: null }), '2027-01-01')).toBe(true)
    expect(bloqueoCubreDia(cita({}), '2026-09-28')).toBe(false)
  })
  it('un tramo cubre las medias horas que caben enteras en él', () => {
    const tramos = [{ dia_semana: 1, hora_inicio: '09:00:00', hora_fin: '14:00:00' }]
    expect(tramoCubreCelda(tramos, '2026-09-28', '09:00')).toBe(true)
    expect(tramoCubreCelda(tramos, '2026-09-28', '13:30')).toBe(true)
    expect(tramoCubreCelda(tramos, '2026-09-28', '14:00')).toBe(false)
    expect(tramoCubreCelda(tramos, '2026-09-29', '10:00')).toBe(false) // martes
  })
})

describe('colores y etiquetas', () => {
  it('colorCentro da la vuelta a la paleta', () => {
    expect(colorCentro(0)).toEqual(colorCentro(8))
    expect(colorCentro(3).fondo).not.toBe(colorCentro(4).fondo)
  })
  it('etiquetaTipoCita', () => {
    expect(etiquetaTipoCita('adulto')).toBe('Adulto')
    expect(etiquetaTipoCita('pareja')).toBe('Pareja')
    expect(etiquetaTipoCita('menor')).toBe('Menor')
    expect(etiquetaTipoCita(null)).toBe('Sin tipo')
  })
})
```

- [ ] **Step 2: Ejecutar para ver que fallan**

Run: `npm test -- lib/calendario.test.ts`
Expected: FAIL, "Failed to resolve import './calendario'".

- [ ] **Step 3: Implementar `lib/calendario.ts`**

```ts
/**
 * Utilidades puras de la pestaña Calendario (agenda semanal): fechas de la
 * semana, filas de media hora, filtros y colores por centro.
 */
import { aMinutos, type Tramo } from './horarios'
import { diaSemanaISO } from './disponibilidad'

export type TipoEvento = 'cita' | 'bloqueo'

export type EventoCalendario = {
  id: string
  tipo: TipoEvento
  psicologoId: string
  psicologoNombre: string
  centroId: string | null
  /** Cita: día y hora de inicio ('HH:MM'). */
  fecha: string | null
  hora: string | null
  tipoCita: string | null
  iniciales: string | null
  /** Bloqueo: rango de días completos, ambos incluidos (fin nulo = sin fin). */
  inicio: string | null
  fin: string | null
  motivo: string | null
}

/** '' = todos. tipoCita admite 'sin_tipo' para las citas sin tipo. */
export type FiltrosCalendario = { centroId: string; tipoCita: string; psicologoId: string }

export const TIPOS_CITA_FILTRO: { value: string; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'adulto', label: 'Adulto' },
  { value: 'pareja', label: 'Pareja' },
  { value: 'menor', label: 'Menor' },
  { value: 'sin_tipo', label: 'Sin tipo' },
]

/** Suma días a 'YYYY-MM-DD' (aritmética en UTC, sin efectos de zona). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana (ISO) que contiene la fecha. */
export function lunesDeSemana(fecha: string): string {
  return sumarDias(fecha, -(diaSemanaISO(fecha) - 1))
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

function fmt(fecha: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-ES', { ...opciones, timeZone: 'UTC' }).format(new Date(`${fecha}T00:00:00Z`))
}

/** '28 sept – 4 oct 2026' */
export function etiquetaRangoSemana(lunes: string): string {
  return `${fmt(lunes, { day: 'numeric', month: 'short' })} – ${fmt(sumarDias(lunes, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** 'lun 28' */
export function etiquetaDia(fecha: string): string {
  return fmt(fecha, { weekday: 'short', day: 'numeric' })
}

/** Filas de la rejilla: de 08:00 a 21:30 cada 30 minutos (28 filas). */
export const FILAS_HORA: string[] = []
for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) {
  FILAS_HORA.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}

/** Índice de fila de una hora ('HH:MM' o 'HH:MM:SS'); -1 si queda fuera de la franja. */
export function filaDeHora(hora: string): number {
  const m = aMinutos(hora)
  if (Number.isNaN(m) || m < 8 * 60 || m > 21 * 60 + 30) return -1
  return Math.floor((m - 8 * 60) / 30)
}

export function filtrarEventos(eventos: EventoCalendario[], f: FiltrosCalendario): EventoCalendario[] {
  return eventos.filter((e) => {
    if (f.centroId && e.centroId !== f.centroId) return false
    if (f.psicologoId && e.psicologoId !== f.psicologoId) return false
    if (f.tipoCita && e.tipo === 'cita') {
      if (f.tipoCita === 'sin_tipo' ? e.tipoCita !== null : e.tipoCita !== f.tipoCita) return false
    }
    return true
  })
}

export function bloqueoCubreDia(e: EventoCalendario, fecha: string): boolean {
  return e.tipo === 'bloqueo' && !!e.inicio && e.inicio <= fecha && (e.fin == null || fecha <= e.fin)
}

/** true si la media hora [filaHora, filaHora + 30) cae dentro de un tramo del día. */
export function tramoCubreCelda(tramos: Tramo[], fecha: string, filaHora: string): boolean {
  const dia = diaSemanaISO(fecha)
  const m = aMinutos(filaHora)
  return tramos.some((t) => t.dia_semana === dia && aMinutos(t.hora_inicio) <= m && m + 30 <= aMinutos(t.hora_fin))
}

/** Un color suave por centro (fondo, borde izquierdo y texto). */
export const PALETA_CENTROS = [
  { fondo: '#e3edff', borde: '#2f5aae', texto: '#1f3f80' },
  { fondo: '#e6f6ec', borde: '#1e7d4f', texto: '#155f3b' },
  { fondo: '#fff1dc', borde: '#ed8f0c', texto: '#8a5200' },
  { fondo: '#f3e8ff', borde: '#7c3aed', texto: '#4c1d95' },
  { fondo: '#ffe4e6', borde: '#e11d48', texto: '#9f1239' },
  { fondo: '#e0f7fa', borde: '#0e7490', texto: '#155e75' },
  { fondo: '#fef9c3', borde: '#a16207', texto: '#713f12' },
  { fondo: '#e5e7eb', borde: '#4b5563', texto: '#1f2937' },
] as const

export function colorCentro(indice: number): { fondo: string; borde: string; texto: string } {
  return PALETA_CENTROS[((indice % PALETA_CENTROS.length) + PALETA_CENTROS.length) % PALETA_CENTROS.length]
}

export function etiquetaTipoCita(tipo: string | null): string {
  if (tipo === 'adulto') return 'Adulto'
  if (tipo === 'pareja') return 'Pareja'
  if (tipo === 'menor') return 'Menor'
  return 'Sin tipo'
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS los tres ficheros. Si el test de `etiquetaRangoSemana` o `etiquetaDia` falla solo por el formato del mes/día corto de ICU (por ejemplo `"dic."`), ajustar la expresión regular del test, no el código.

- [ ] **Step 5: Build y commit**

Run: `npm run build`
Expected: sin errores.

```bash
git add lib/calendario.ts lib/calendario.test.ts
git commit -m "Módulo puro del calendario semanal: fechas, filas, filtros y colores"
```

---
### Task 11: Página Calendario (agenda semanal con filtros)

**Files:**
- Create: `app/dashboard/calendario/AgendaSemanal.tsx`
- Create: `app/dashboard/calendario/page.tsx`
- Create: `app/dashboard/calendario/loading.tsx`
- Modify: `app/globals.css` (al final)

**Interfaces:**
- Consumes: todo `lib/calendario.ts` (Tarea 10), `todayISODate` de `lib/eventos-activos.ts`, `Tramo` de `lib/horarios.ts`, `supabase`, tipos `Centro`, `Psicologo`.
- Produces: componente `AgendaSemanal({ dias, eventos, tramos, indiceCentro, nombreCentro, hoy })` y la ruta `/dashboard/calendario` (aún sin entrada de menú ni permiso de rol: Tarea 12).

- [ ] **Step 1: Estilos responsive del calendario**

Al final de `app/globals.css` añadir:

```css
/* --- Calendario semanal (pestaña Calendario) --- */
.cal-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.cal-filtros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 820px) {
  .cal-filtros {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Componente de la rejilla**

Crear `app/dashboard/calendario/AgendaSemanal.tsx`:

```tsx
'use client'

import { Fragment } from 'react'
import type { Tramo } from '@/lib/horarios'
import { etiquetaMotivo } from '@/lib/disponibilidad'
import {
  FILAS_HORA, filaDeHora, bloqueoCubreDia, tramoCubreCelda, colorCentro, etiquetaDia, etiquetaTipoCita,
  type EventoCalendario,
} from '@/lib/calendario'

const BRAND_BLUE = '#2f5aae'

const cabecera: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '10px 6px', textAlign: 'center',
  fontSize: 12, fontWeight: 700, color: '#4a5870', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(47,90,174,0.15)',
}
const celdaHora: React.CSSProperties = {
  fontSize: 11, color: '#8899bb', padding: '4px 6px 0 0', textAlign: 'right', whiteSpace: 'nowrap',
}
const celda: React.CSSProperties = {
  minHeight: 30, padding: 2, borderLeft: '1px solid rgba(47,90,174,0.08)',
}

type Props = {
  /** Días visibles ('YYYY-MM-DD'): 7 en escritorio, 1 en móvil. */
  dias: string[]
  eventos: EventoCalendario[]
  /** Horario de la ficha filtrada, para sombrear sus horas de trabajo. Vacío = sin sombreado. */
  tramos: Tramo[]
  indiceCentro: Map<string, number>
  nombreCentro: Map<string, string>
  hoy: string
}

function Bloque({ e, indiceCentro, nombreCentro }: { e: EventoCalendario; indiceCentro: Map<string, number>; nombreCentro: Map<string, string> }) {
  const c = colorCentro(e.centroId ? (indiceCentro.get(e.centroId) ?? 7) : 7)
  const centro = e.centroId ? (nombreCentro.get(e.centroId) ?? '') : ''
  const esCita = e.tipo === 'cita'
  const titulo = esCita
    ? `${e.psicologoNombre} · ${centro} · ${e.hora} · ${etiquetaTipoCita(e.tipoCita)}${e.iniciales ? ` · ${e.iniciales}` : ''}`
    : `${e.psicologoNombre} · ${centro} · ${etiquetaMotivo(e.motivo)}`
  return (
    <div
      title={titulo}
      style={{
        background: c.fondo, borderLeft: `3px solid ${c.borde}`, color: c.texto, borderRadius: 6,
        padding: '3px 6px', fontSize: 11.5, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden',
        transition: 'transform 0.12s', cursor: 'default',
      }}
    >
      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {esCita ? `${e.hora} ${e.psicologoNombre}` : e.psicologoNombre}
      </div>
      <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {esCita ? `${e.iniciales ?? '—'} · ${etiquetaTipoCita(e.tipoCita)}` : etiquetaMotivo(e.motivo)}
      </div>
    </div>
  )
}

export default function AgendaSemanal({ dias, eventos, tramos, indiceCentro, nombreCentro, hoy }: Props) {
  const unDia = dias.length === 1
  return (
    <div className="cal-scroll">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dias.length}, minmax(${unDia ? '0' : '150px'}, 1fr))`,
          minWidth: unDia ? 0 : 56 + 150 * 7,
        }}
      >
        {/* Cabecera de días */}
        <div style={cabecera} />
        {dias.map((d) => (
          <div key={d} style={{ ...cabecera, color: d === hoy ? BRAND_BLUE : '#4a5870', background: d === hoy ? '#eef2fb' : '#fff' }}>
            {etiquetaDia(d)}
          </div>
        ))}

        {/* Bloqueos de día completo */}
        <div style={{ ...celdaHora, paddingTop: 6 }}>Día</div>
        {dias.map((d) => (
          <div key={`b-${d}`} style={{ ...celda, borderBottom: '1px solid rgba(47,90,174,0.15)', background: '#fafbfd' }}>
            {eventos.filter((e) => bloqueoCubreDia(e, d)).map((e) => (
              <Bloque key={e.id} e={e} indiceCentro={indiceCentro} nombreCentro={nombreCentro} />
            ))}
          </div>
        ))}

        {/* Filas de media hora */}
        {FILAS_HORA.map((h, fila) => {
          const enPunto = h.endsWith(':00')
          return (
            <Fragment key={h}>
              <div style={{ ...celdaHora, borderTop: enPunto ? '1px solid rgba(47,90,174,0.12)' : '1px solid transparent' }}>
                {enPunto ? h : ''}
              </div>
              {dias.map((d) => {
                const citas = eventos.filter((e) => e.tipo === 'cita' && e.fecha === d && filaDeHora(e.hora ?? '') === fila)
                const trabaja = tramos.length > 0 && tramoCubreCelda(tramos, d, h)
                return (
                  <div
                    key={d}
                    style={{
                      ...celda,
                      borderTop: enPunto ? '1px solid rgba(47,90,174,0.12)' : '1px dashed rgba(47,90,174,0.06)',
                      background: trabaja ? '#eef2fb' : d === hoy ? '#fbfcff' : '#fff',
                    }}
                  >
                    {citas.map((e) => (
                      <Bloque key={e.id} e={e} indiceCentro={indiceCentro} nombreCentro={nombreCentro} />
                    ))}
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Esqueleto de carga de la ruta**

Crear `app/dashboard/calendario/loading.tsx`:

```tsx
export default function CalendarioLoading() {
  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 260, height: 16, borderRadius: 4 }} />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(58,140,140,0.1)' }}>
        <div className="cal-filtros" style={{ marginBottom: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 38, borderRadius: 8 }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
            ))}
          </div>
        ))}
      </div>
      <style>{`
        .skeleton {
          background: linear-gradient(90deg, #ede9e2 25%, #e4dfd7 50%, #ede9e2 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 4: Página**

Crear `app/dashboard/calendario/page.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayISODate } from '@/lib/eventos-activos'
import type { Centro, Psicologo } from '@/types/database'
import type { Tramo } from '@/lib/horarios'
import {
  lunesDeSemana, sumarDias, diasDeSemana, etiquetaRangoSemana, etiquetaDia, filtrarEventos, colorCentro,
  TIPOS_CITA_FILTRO, type EventoCalendario, type FiltrosCalendario,
} from '@/lib/calendario'
import AgendaSemanal from './AgendaSemanal'

const BRAND_BLUE = '#2f5aae'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', padding: 20, marginBottom: 20,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit',
  border: '1.5px solid #dde1ea', background: '#fff', color: '#272626', cursor: 'pointer',
}
const btnNav: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid rgba(47,90,174,0.3)', background: '#fff', color: BRAND_BLUE, cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

/**
 * Agenda semanal de todos los psicólogos (citas activas y bloqueos) leída de
 * `acciones_psicologos`. Entra mostrando todo; se filtra por centro, tipo de
 * cita y psicólogo. Solo muestra lo gestionado desde la app (no lo que un
 * psicólogo apunte a mano en Google Calendar).
 */
export default function CalendarioPage() {
  const [centros, setCentros] = useState<Centro[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [lunes, setLunes] = useState(() => lunesDeSemana(todayISODate()))
  const [filtros, setFiltros] = useState<FiltrosCalendario>({ centroId: '', tipoCita: '', psicologoId: '' })
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [cargandoBase, setCargandoBase] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [esMovil, setEsMovil] = useState(false)
  const [diaMovil, setDiaMovil] = useState(0)

  // Móvil: se muestra un solo día con flechas.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)')
    const aplicar = () => setEsMovil(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  // Centros y TODAS las fichas de psicólogo (también inactivas, para nombrar citas antiguas).
  useEffect(() => {
    Promise.all([
      supabase.from('centros').select('*').order('nombre'),
      supabase.from('psicologos').select('*').order('nombre'),
    ]).then(([c, p]) => {
      if (c.error || p.error) setError(c.error?.message ?? p.error?.message ?? 'Error al cargar')
      setCentros((c.data ?? []) as Centro[])
      setPsicologos((p.data ?? []) as Psicologo[])
      setCargandoBase(false)
    })
  }, [])

  // Citas y bloqueos de la semana visible.
  useEffect(() => {
    if (cargandoBase) return
    let cancelado = false
    setCargando(true)
    setError(null)
    const domingo = sumarDias(lunes, 6)
    const psi = new Map(psicologos.map((p) => [p.id, p]))

    async function cargarSemana(): Promise<EventoCalendario[]> {
      const [citas, bloqueos] = await Promise.all([
        supabase
          .from('acciones_psicologos')
          .select('id, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita')
          .eq('accion', 'Agendar cita')
          .eq('activo', true)
          .gte('fecha_cita', lunes)
          .lte('fecha_cita', domingo),
        supabase
          .from('acciones_psicologos')
          .select('id, psicologo_id, fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo')
          .eq('accion', 'Bloquear agenda')
          .eq('activo', true)
          .lte('fecha_bloqueo_inicio', domingo)
          .or(`fecha_bloqueo_fin.gte.${lunes},fecha_bloqueo_fin.is.null`),
      ])
      if (citas.error) throw citas.error
      if (bloqueos.error) throw bloqueos.error

      const idsPacientes = Array.from(
        new Set((citas.data ?? []).map((c) => c.paciente_id).filter((x): x is string => !!x)),
      )
      const iniciales = new Map<string, string | null>()
      if (idsPacientes.length > 0) {
        const pac = await supabase.from('pacientes').select('id, iniciales').in('id', idsPacientes)
        if (pac.error) throw pac.error
        for (const p of pac.data ?? []) iniciales.set(p.id, p.iniciales)
      }

      const lista: EventoCalendario[] = []
      for (const c of citas.data ?? []) {
        if (!c.fecha_cita || !c.hora_cita) continue
        const p = c.psicologo_id ? psi.get(c.psicologo_id) : undefined
        lista.push({
          id: c.id, tipo: 'cita', psicologoId: c.psicologo_id ?? '', psicologoNombre: p?.nombre ?? 'Psicólogo',
          centroId: p?.centro_id ?? null, fecha: c.fecha_cita, hora: c.hora_cita.slice(0, 5), tipoCita: c.tipo_cita,
          iniciales: c.paciente_id ? (iniciales.get(c.paciente_id) ?? null) : null, inicio: null, fin: null, motivo: null,
        })
      }
      for (const b of bloqueos.data ?? []) {
        if (!b.fecha_bloqueo_inicio) continue
        const p = b.psicologo_id ? psi.get(b.psicologo_id) : undefined
        lista.push({
          id: b.id, tipo: 'bloqueo', psicologoId: b.psicologo_id ?? '', psicologoNombre: p?.nombre ?? 'Psicólogo',
          centroId: p?.centro_id ?? null, fecha: null, hora: null, tipoCita: null, iniciales: null,
          inicio: b.fecha_bloqueo_inicio, fin: b.fecha_bloqueo_fin, motivo: b.motivo_bloqueo,
        })
      }
      return lista
    }

    cargarSemana()
      .then((lista) => { if (!cancelado) setEventos(lista) })
      .catch((e: unknown) => {
        if (cancelado) return
        setEventos([])
        setError(e instanceof Error ? e.message : 'No se pudo cargar la semana')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [lunes, cargandoBase, psicologos])

  // Horario de la ficha filtrada (sombreado de sus horas de trabajo).
  useEffect(() => {
    if (!filtros.psicologoId) { setTramos([]); return }
    let cancelado = false
    supabase
      .from('horarios_psicologos')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('psicologo_id', filtros.psicologoId)
      .then(({ data }) => { if (!cancelado) setTramos((data ?? []) as Tramo[]) })
    return () => { cancelado = true }
  }, [filtros.psicologoId])

  const dias = useMemo(() => diasDeSemana(lunes), [lunes])
  const indiceCentro = useMemo(() => new Map(centros.map((c, i) => [c.id, i])), [centros])
  const nombreCentro = useMemo(() => new Map(centros.map((c) => [c.id, c.nombre])), [centros])
  const psicologosFiltro = psicologos.filter((p) => p.activo && (!filtros.centroId || p.centro_id === filtros.centroId))
  const visibles = useMemo(() => filtrarEventos(eventos, filtros), [eventos, filtros])
  const hoy = todayISODate()
  const diasVisibles = esMovil ? [dias[Math.min(Math.max(diaMovil, 0), 6)]] : dias

  function cambiarFiltro(campo: keyof FiltrosCalendario, valor: string) {
    setFiltros((prev) => {
      const siguiente = { ...prev, [campo]: valor }
      // Al cambiar de centro, el psicólogo elegido solo se conserva si sigue en la lista.
      if (campo === 'centroId' && prev.psicologoId) {
        const sigue = psicologos.some((p) => p.id === prev.psicologoId && (!valor || p.centro_id === valor))
        if (!sigue) siguiente.psicologoId = ''
      }
      return siguiente
    })
  }

  function irAHoy() {
    setLunes(lunesDeSemana(hoy))
    setDiaMovil(diasDeSemana(lunesDeSemana(hoy)).indexOf(hoy))
  }

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: '0 0 6px' }}>
          Calendario
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Citas y bloqueos de todos los psicólogos. Filtra por centro, tipo de cita o psicólogo para ver la disponibilidad.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filtros + leyenda */}
      <div style={card}>
        <div className="cal-filtros">
          <select value={filtros.centroId} onChange={(e) => cambiarFiltro('centroId', e.target.value)} style={selectStyle} aria-label="Centro">
            <option value="">Todos los centros</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filtros.tipoCita} onChange={(e) => cambiarFiltro('tipoCita', e.target.value)} style={selectStyle} aria-label="Tipo de cita">
            {TIPOS_CITA_FILTRO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filtros.psicologoId} onChange={(e) => cambiarFiltro('psicologoId', e.target.value)} style={selectStyle} aria-label="Psicólogo">
            <option value="">Todos los psicólogos</option>
            {psicologosFiltro.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{filtros.centroId ? '' : ` · ${nombreCentro.get(p.centro_id) ?? ''}`}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          {centros.map((c, i) => {
            const col = colorCentro(i)
            return (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a5870' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: col.fondo, borderLeft: `3px solid ${col.borde}` }} />
                {c.nombre}
              </span>
            )
          })}
        </div>
        {filtros.psicologoId && (
          <div style={{ fontSize: 12, color: '#667799', marginTop: 10 }}>
            {tramos.length > 0
              ? 'Las celdas sombreadas en azul son las horas de trabajo de este psicólogo en este centro.'
              : 'Este psicólogo no tiene horario definido en Usuarios.'}
          </div>
        )}
      </div>

      {/* Navegación de semana */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, -7))}>‹ Semana anterior</button>
          <button type="button" style={btnNav} onClick={irAHoy}>Hoy</button>
          <button type="button" style={btnNav} onClick={() => setLunes(sumarDias(lunes, 7))}>Semana siguiente ›</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#272626' }}>{etiquetaRangoSemana(lunes)}</div>
        {esMovil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button type="button" style={btnNav} onClick={() => setDiaMovil((d) => Math.max(0, d - 1))} disabled={diaMovil === 0}>‹ Día</button>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: BRAND_BLUE }}>{etiquetaDia(diasVisibles[0])}</span>
            <button type="button" style={btnNav} onClick={() => setDiaMovil((d) => Math.min(6, d + 1))} disabled={diaMovil === 6}>Día ›</button>
          </div>
        )}
      </div>

      {/* Agenda */}
      <div style={{ ...card, padding: 12 }}>
        {cargandoBase || cargando ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${diasVisibles.length}, 1fr)`, gap: 6, marginBottom: 8 }}>
                {Array.from({ length: diasVisibles.length + 1 }).map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 28, borderRadius: 6 }} />
                ))}
              </div>
            ))}
            <style>{`
              .skeleton { background: linear-gradient(90deg, #ede9e2 25%, #e4dfd7 50%, #ede9e2 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
              @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `}</style>
          </div>
        ) : (
          <>
            {visibles.length === 0 && (
              <div style={{ fontSize: 13, color: '#8899bb', padding: '8px 10px' }}>
                No hay citas ni bloqueos esta semana con los filtros elegidos.
              </div>
            )}
            <AgendaSemanal
              dias={diasVisibles}
              eventos={visibles}
              tramos={tramos}
              indiceCentro={indiceCentro}
              nombreCentro={nombreCentro}
              hoy={hoy}
            />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Build y prueba manual**

Run: `npm run build`
Expected: sin errores.

Con `npm run dev` y sesión de **agente** (el rol call center aún no tiene permiso: Tarea 12), abrir `/dashboard/calendario`:
1. Se ve la semana actual con todas las citas activas (las de prueba de la Tarea 8) como bloques con el color de su centro, texto `10:00 Sonia` y debajo `iniciales · tipo`.
2. El bloqueo "Vacaciones" de la Tarea 8 aparece en la fila "Día" de su columna.
3. Filtrar por centro Salamanca deja solo sus citas y la lista de psicólogos se reduce a los de Salamanca.
4. Filtrar por psicóloga Sonia sombrea en azul lunes y miércoles de 09:00 a 14:00.
5. "Semana siguiente" y "Hoy" cambian el rango y recargan.
6. Reducir la ventana por debajo de 680 px: se ve un solo día con las flechas "‹ Día" y "Día ›".
7. Tipo de cita: las citas antiguas sin tipo salen con "Sin tipo" y el filtro "Sin tipo" las aísla.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/dashboard/calendario/AgendaSemanal.tsx app/dashboard/calendario/page.tsx app/dashboard/calendario/loading.tsx
git commit -m "Calendario: agenda semanal de citas y bloqueos con filtros por centro, tipo y psicólogo"
```

---
### Task 12: Menú, permisos por rol y documentación del calendario

**Files:**
- Modify: `app/dashboard/_components/SidebarNav.tsx` (icono nuevo y `navItems`)
- Modify: `app/dashboard/_components/RoleGate.tsx` (`HOME` e `isAllowed`)
- Modify: `docs/roles-y-permisos.md`

**Interfaces:**
- Consumes: la ruta `/dashboard/calendario` de la Tarea 11.

- [ ] **Step 1: Entrada de menú en primera posición**

En `app/dashboard/_components/SidebarNav.tsx`, tras la función `ChatIcon()` añadir:

```tsx
function CalendarIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
```

Y en `const navItems: NavItem[] = [` insertar como **primer** elemento:

```tsx
  { href: '/dashboard/calendario', label: 'Calendario', Icon: CalendarIcon, roles: ['agente', 'call_center'] },
```

- [ ] **Step 2: Página de entrada y permiso del call center**

En `app/dashboard/_components/RoleGate.tsx`:

```tsx
const HOME: Record<Rol, string> = {
  agente: '/dashboard',
  psicologo: '/dashboard/psicologos',
  // El call center entra por el calendario (disponibilidad de todos los psicólogos).
  call_center: '/dashboard/calendario',
}
```

y en `isAllowed`, sustituir la línea del call center por:

```tsx
  // Call center: calendario, panel personal y formulario de citas.
  if (rol === 'call_center')
    return path === '/dashboard/calendario' || path === '/dashboard' || path === '/dashboard/psicologos'
```

- [ ] **Step 3: Documentación**

En `docs/roles-y-permisos.md`:

(a) En la tabla "Qué ve y puede hacer cada rol", añadir como primera fila de datos:

```markdown
| Calendario (agenda semanal de todos) | `/dashboard/calendario` | Sí | No | Sí (página de entrada) |
```

(b) En la sección `### Call center`, sustituir `Al entrar aterriza en Citas.` por `Al entrar aterriza en **Calendario**.` y añadir al final de la sección:

```markdown
En **Calendario** ve la agenda semanal de todos los psicólogos: cada cita activa aparece como un bloque
de una hora con el color de su centro, el nombre del psicólogo, las **iniciales** del paciente (nunca el
nombre) y el tipo de cita; los bloqueos (vacaciones, asuntos propios, baja, bloqueo) ocupan la fila "Día".
Se filtra por centro, tipo de cita y psicólogo; al filtrar por un psicólogo se sombrean sus horas de
trabajo según el horario definido en Usuarios. Solo se ve lo gestionado desde la app: lo que un psicólogo
apunte a mano en Google Calendar no aparece. El filtro por tipo de cita depende de que Make guarde
`tipo_cita` al agendar (ver `docs/make-cambios-2026-09-25.md`, apartado F, fuera del repo).
```

(c) En `## Cómo se aplica en el código` añadir:

```markdown
- Calendario: `app/dashboard/calendario/page.tsx` (datos y filtros), `app/dashboard/calendario/AgendaSemanal.tsx`
  (rejilla) y `lib/calendario.ts` (fechas, filas, filtros, colores; con tests).
```

- [ ] **Step 4: Build, tests y prueba manual por rol**

Run: `npm test` → PASS.
Run: `npm run build` → sin errores.

Con `npm run dev`:
1. **Call center**: al entrar aterriza en `/dashboard/calendario`; el menú muestra Calendario (primero), Panel General y Citas. Puede navegar a Citas y volver.
2. **Agente**: ve Calendario como primera entrada del menú y sigue entrando por Panel General.
3. **Psicólogo**: no ve Calendario y, si escribe la URL a mano, es redirigido a Citas.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/_components/SidebarNav.tsx app/dashboard/_components/RoleGate.tsx docs/roles-y-permisos.md
git commit -m "Calendario en el menú y como página de entrada del call center"
```

---

## Cierre

- [ ] `npm test` y `npm run build` en verde en el último commit.
- [ ] Recordar a Sonia los tres pasos manuales: ejecutar la migración 012 en el SQL Editor, revisar el módulo 14 de Make (apartado F de `docs/make-cambios-2026-09-25.md`) y, el día del despliegue, pulsar **30'** en Usuarios para los psicólogos que hoy reciben citas a y media.
- [ ] No hacer `git push`: lo hace Sonia.
