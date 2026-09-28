# Modelo de pacientes y psicólogos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un paciente puede tener hasta tres psicólogos (adultos, pareja, infantil), cada psicólogo es una sola ficha con varios centros y tipos de consulta, cada cita guarda su centro, y el alta de paciente detecta duplicados con criterio y permite tutores que ya son pacientes.

**Architecture:** Supabase (Postgres) es la fuente de verdad; la app Next.js 14 (App Router, TypeScript, cliente Supabase en navegador y servidor) lee y escribe; Make ("Formulario Citas Psicólogos v2 Telegram") recibe un webhook por acción y escribe citas y Calendar; Dante (agente n8n por Telegram) usa las mismas tablas y el mismo webhook. La lógica de decisión nueva (duplicados, columna por tipo) va en módulos puros de `lib/` con tests Vitest; las pantallas solo los llaman.

**Tech Stack:** Next.js 14 + TypeScript, Supabase JS v2 (`@supabase/supabase-js`, `@supabase/ssr`), Vitest 5 (`npm test`), Make.com (blueprint exportado en `Make blueprints/Formulario Citas Psicologos.blueprint.json`), n8n (`n8n/workflows/somos-main-agent.json`).

**Spec:** `docs/superpowers/specs/2026-09-26-modelo-pacientes-psicologos-design.md` (y el estudio de riesgo `…-riesgos.md` en la misma carpeta).

## Global Constraints

- ~~NO empezar hasta que Sonia lo autorice explícitamente.~~ Autorizado y ejecutado el 28-09-2026 (migraciones 014 y 014b aplicadas; merge en main 22de08c). Pendientes marcados sin [x]: Make (Tarea 8), importar Dante (Tarea 9 paso 7), pruebas de aceptación (Tarea 10). Ver `docs/make-cambios-2026-09-28.md`.
- **La migración 014 conserva psicólogos reales (con calendario), agentes, perfiles, centros y horarios.** Solo borra pacientes, citas, historial y las fichas de psicólogo sin calendario. Nunca ampliar el borrado.
- Antes de la Tarea 1: escenario de Make **desactivado** y cola del webhook vacía; workflow de Dante **inactivo**; Elias avisado (§0 de la especificación).
- Valores de tipo de consulta en todo el sistema: exactamente `adulto`, `pareja`, `menor` (los de `TipoCita` en `types/database.ts`). Nunca "adultos", "infantil" ni mayúsculas en datos; solo en etiquetas de pantalla.
- Columnas de psicólogo en `pacientes`: `psicologo_adultos_id`, `psicologo_pareja_id`, `psicologo_infantil_id`. `pacientes.psicologo_id` desaparece.
- Textos de interfaz en español, tono cálido y profesional (CLAUDE.md). Colores/estilos: reutilizar los de cada pantalla.
- `pacientes.telefono` sigue siendo teléfono (app) o chat id de Telegram (Dante). No se crea columna nueva.
- Nombres de psicólogo sin sufijo de tipo al recrearlos ("Marta", no "MARTA - PAREJAS").
- Cada tarea termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde antes del commit.
- Git: rama de trabajo `modelo-pacientes-psicologos` creada desde `main`; commits pequeños con mensaje en español; al final PR/merge a `main` (producción despliega desde `main`).
- Zona horaria: las fechas se tratan como en el resto de la app (`Europe/Madrid`, `YYYY-MM-DD` sin `new Date('YYYY-MM-DD')`).

## Review Focus

1. **Alta de paciente de pareja con teléfono de un paciente de OTRO tipo que ya tiene psicólogo de pareja distinto**: debe aparecer el aviso "ya tiene psicólogo de pareja: Z, ¿cambiarlo?" y, si se acepta, sustituir; nunca crear ficha ni dejar la columna sin tocar. (Test en Tarea 3.)
2. **Nombre con tildes, mayúsculas o espacios dobles** ("  Ana  BELÉN ", "ana belen"): se consideran el mismo nombre. (Test en Tarea 3.)
3. **Menor con fecha de nacimiento igual pero nombre distinto**: NO es duplicado. (Test en Tarea 3.)
4. **Psicólogo con un solo tipo de consulta**: el formulario de Citas debe preseleccionar ese tipo y no ofrecer otros; con `tipos_consulta` vacío no debe romper (muestra los tres con aviso). (Test en Tarea 3, comprobación manual en Tarea 6.)
5. **Cita sin `centro_id`** (envío antiguo o de Dante sin actualizar): el calendario la muestra en "Todos" y no la oculta; el trigger de historial copia `NULL` sin fallar. (Comprobación en Tarea 1 y Tarea 8.)

---

## Mapa de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `Supabase/migrations/014_modelo_pacientes_psicologos.sql` | Borrado de datos de prueba, modelo nuevo, vista, trigger de historial con `centro_id` | Crear |
| `types/database.ts` | Tipos de filas y del cliente tipado | Modificar |
| `lib/pacientes-tipos.ts` | Lógica pura: columna por tipo, normalización de nombre, decisión de duplicado, filtro `or` de pacientes por psicólogo, tipos disponibles | Crear |
| `lib/pacientes-tipos.test.ts` | Tests Vitest de lo anterior | Crear |
| `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts` | Alta/edición de psicólogo: una fila + `psicologos_centros` + `tipos_consulta` | Modificar |
| `app/dashboard/usuarios/page.tsx` | Checkboxes de tipos, listado con centros y tipos | Modificar |
| `lib/centro-activo.ts` | Selección de centro (un solo id de psicólogo) | Modificar |
| `lib/disponibilidad-datos.ts` | Cargar datos de disponibilidad por `psicologo_id` único | Modificar |
| `app/dashboard/psicologos/page.tsx` | Formulario de Citas y alta de paciente | Modificar |
| `app/dashboard/pacientes/page.tsx` | Mis pacientes por las tres columnas | Modificar |
| `app/dashboard/pacientes/PacientesClient.tsx` | Columna "Psicólogos" con tipo | Modificar |
| `app/dashboard/page.tsx` | Contadores por psicólogo | Modificar |
| `app/dashboard/mensajes-psicologo/page.tsx` | Pacientes del psicólogo, centros de la ficha única | Modificar |
| `app/dashboard/calendario/page.tsx` | Centro de la cita desde `acciones_psicologos.centro_id` | Modificar |
| `app/dashboard/psicologos/stats/page.tsx` | Sin agrupación por persona; filtro de centro por `psicologos_centros` | Modificar |
| `docs/make-cambios-2026-09-26.md` | Checklist de Make y Dante para Sonia | Crear |

---

### Task 1: Migración 014 (modelo nuevo y borrado de datos de prueba)

**Files:**
- Create: `Supabase/migrations/014_modelo_pacientes_psicologos.sql` (carpeta `z:\Claude\Somos Psicológos\Supabase\migrations`, fuera del repo git de `somos-app`)

**Interfaces:**
- Produces: tabla `psicologos_centros(psicologo_id, centro_id)`; vista `psicologos_por_centro`; columnas `psicologos.tipos_consulta text[]`, `pacientes.psicologo_adultos_id|psicologo_pareja_id|psicologo_infantil_id`, `asociados_menores."T1_paciente_id"|"T2_paciente_id"`, `acciones_psicologos.centro_id`, `acciones_historial.centro_id`. Elimina `psicologos.centro_id`, `psicologos.centro`, `pacientes.psicologo_id`.

- [x] **Step 1: Escribir el archivo de migración**

```sql
-- ============================================================================
-- 014 — Modelo nuevo: paciente con 3 psicólogos por tipo, una ficha por
--       psicólogo (centros en tabla aparte), centro_id en citas.
-- BORRA pacientes, citas e historial de prueba y las fichas de psicólogo SIN
-- calendario. CONSERVA psicólogos reales (fusionando sus fichas por centro),
-- agentes, perfiles, centros y horarios (decisión de Sonia, 27-09-2026).
-- Requisitos: Make desactivado, Dante inactivo, Elias avisado.
-- Idempotente salvo el borrado (que solo tiene efecto la primera vez).
-- ============================================================================
BEGIN;

-- ── 1. Borrado de datos de PACIENTES Y CITAS de prueba ──────────────────────
--     Se conservan: psicólogos reales (con calendario), agentes, perfiles de
--     ambos, centros y horarios de los psicólogos reales.
TRUNCATE TABLE
  public.acciones_historial,
  public.acciones_psicologos,
  public.acciones_call_center,
  public.asociados_menores,
  public.historial_estados,
  public.formulario_citas_psicologos,
  public.pacientes
RESTART IDENTITY CASCADE;

-- 1b. Fichas de psicólogo DE PRUEBA = sin calendario real. Se borran con su
--     perfil y sus horarios. (Sus cuentas de Auth se borran a mano después.)
CREATE TEMP TABLE psi_prueba AS
  SELECT id FROM public.psicologos
  WHERE calendar_id IS NULL OR btrim(calendar_id) IN ('', 'test');
DELETE FROM public.perfiles            WHERE psicologo_id IN (SELECT id FROM psi_prueba);
DELETE FROM public.horarios_psicologos WHERE psicologo_id IN (SELECT id FROM psi_prueba);
DELETE FROM public.psicologos          WHERE id           IN (SELECT id FROM psi_prueba);

-- ── 2. psicologos: columnas nuevas (las de centro se quitan al final, tras fusionar)
ALTER TABLE public.psicologos
  ADD COLUMN IF NOT EXISTS tipos_consulta text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.psicologos DROP CONSTRAINT IF EXISTS psicologos_tipos_consulta_validos;
ALTER TABLE public.psicologos ADD CONSTRAINT psicologos_tipos_consulta_validos
  CHECK (tipos_consulta <@ ARRAY['adulto','pareja','menor']::text[]);
COMMENT ON COLUMN public.psicologos.tipos_consulta IS
  'Tipos de consulta que pasa: adulto, pareja, menor (mismos valores que tipo_cita).';

-- ── 3. psicologos_centros ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.psicologos_centros (
  psicologo_id uuid NOT NULL REFERENCES public.psicologos(id) ON DELETE CASCADE,
  centro_id    uuid NOT NULL REFERENCES public.centros(id),
  PRIMARY KEY (psicologo_id, centro_id)
);
CREATE INDEX IF NOT EXISTS psicologos_centros_centro_idx ON public.psicologos_centros (centro_id);

-- ── 3b. Fusión de fichas por centro → una ficha por persona ─────────────────
--     Persona = mismo email (o mismo nombre si no hay email). Sobrevive la ficha
--     a la que apunta un perfil; si ninguna, la más antigua. Los centros de todas
--     las fichas pasan a psicologos_centros; el perfil se reapunta; el horario
--     de las fichas que se van se descarta (el horario es por persona).
CREATE TEMP TABLE psi_persona AS
  SELECT id, nombre, centro_id, creado_en,
         COALESCE(NULLIF(lower(btrim(email)), ''), 'nombre:' || lower(btrim(nombre))) AS clave
  FROM public.psicologos;
CREATE TEMP TABLE psi_superviviente AS
  SELECT DISTINCT ON (clave) clave, id AS id_sup
  FROM psi_persona p
  ORDER BY clave,
           (EXISTS (SELECT 1 FROM public.perfiles pf WHERE pf.psicologo_id = p.id)) DESC,
           creado_en ASC, id;

-- Tabla de equivalencias para Elias (queda en la base para consultarla luego).
CREATE TABLE IF NOT EXISTS public.migracion_014_ids (
  id_antiguo uuid PRIMARY KEY,
  id_nuevo   uuid NOT NULL,
  nombre     text,
  centro_id  uuid
);
INSERT INTO public.migracion_014_ids (id_antiguo, id_nuevo, nombre, centro_id)
  SELECT p.id, s.id_sup, p.nombre, p.centro_id
  FROM psi_persona p JOIN psi_superviviente s USING (clave)
  WHERE p.id <> s.id_sup
ON CONFLICT (id_antiguo) DO NOTHING;

INSERT INTO public.psicologos_centros (psicologo_id, centro_id)
  SELECT DISTINCT s.id_sup, p.centro_id
  FROM psi_persona p JOIN psi_superviviente s USING (clave)
  WHERE p.centro_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.perfiles pf
  SET psicologo_id = s.id_sup
  FROM psi_persona p JOIN psi_superviviente s USING (clave)
  WHERE pf.psicologo_id = p.id AND p.id <> s.id_sup;

-- La ficha superviviente hereda de las otras lo que tenga vacío: teléfono,
-- calendario, email y permisos. Así no se pierde ningún dato al fusionar.
UPDATE public.psicologos s
  SET telefono         = COALESCE(NULLIF(s.telefono, ''),    d.telefono),
      calendar_id      = COALESCE(NULLIF(s.calendar_id, ''), d.calendar_id),
      email            = COALESCE(NULLIF(s.email, ''),       d.email),
      puede_bloquear   = COALESCE(s.puede_bloquear,   d.puede_bloquear),
      citas_media_hora = COALESCE(s.citas_media_hora, d.citas_media_hora),
      activo           = s.activo OR d.activo
  FROM (
    SELECT sv.id_sup,
           max(NULLIF(p.telefono, ''))    AS telefono,
           max(NULLIF(p.calendar_id, '')) AS calendar_id,
           max(NULLIF(p.email, ''))       AS email,
           bool_or(p.puede_bloquear)      AS puede_bloquear,
           bool_or(p.citas_media_hora)    AS citas_media_hora,
           bool_or(p.activo)              AS activo
    FROM psi_persona pp
    JOIN psi_superviviente sv USING (clave)
    JOIN public.psicologos p ON p.id = pp.id
    GROUP BY sv.id_sup
  ) d
  WHERE s.id = d.id_sup;

-- Horario: si la superviviente no tiene tramos, hereda los de la primera ficha
-- hermana que los tenga (el horario es por persona, no por centro).
INSERT INTO public.horarios_psicologos (psicologo_id, dia_semana, hora_inicio, hora_fin)
  SELECT sv.id_sup, h.dia_semana, h.hora_inicio, h.hora_fin
  FROM psi_superviviente sv
  JOIN LATERAL (
    SELECT pp.id
    FROM psi_persona pp
    WHERE pp.clave = sv.clave AND pp.id <> sv.id_sup
      AND EXISTS (SELECT 1 FROM public.horarios_psicologos hh WHERE hh.psicologo_id = pp.id)
    ORDER BY pp.creado_en, pp.id
    LIMIT 1
  ) donante ON true
  JOIN public.horarios_psicologos h ON h.psicologo_id = donante.id
  WHERE NOT EXISTS (SELECT 1 FROM public.horarios_psicologos h2 WHERE h2.psicologo_id = sv.id_sup);

DELETE FROM public.psicologos
  WHERE id IN (SELECT p.id FROM psi_persona p JOIN psi_superviviente s USING (clave) WHERE p.id <> s.id_sup);

-- Tipos de consulta desde el sufijo del nombre ("MARTA - PAREJAS") y nombre limpio.
-- Sin sufijo → tipos vacíos: la app ofrece los tres y Sonia los fija en Usuarios.
UPDATE public.psicologos SET tipos_consulta = CASE
  WHEN nombre ~* '\s-\s*ADULTOS?\s*$'  THEN ARRAY['adulto']
  WHEN nombre ~* '\s-\s*PAREJAS?\s*$'  THEN ARRAY['pareja']
  WHEN nombre ~* '\s-\s*INFANTIL\s*$'  THEN ARRAY['menor']
  ELSE tipos_consulta END;
UPDATE public.psicologos
  SET nombre = btrim(regexp_replace(nombre, '\s*-\s*(ADULTOS?|PAREJAS?|INFANTIL)\s*$', '', 'i'));
UPDATE public.perfiles pf SET nombre = p.nombre FROM public.psicologos p WHERE pf.psicologo_id = p.id;

-- Ahora sí: fuera las columnas de centro de la ficha.
ALTER TABLE public.psicologos
  DROP COLUMN IF EXISTS centro_id,
  DROP COLUMN IF EXISTS centro;

-- ── 4. Vista con el aspecto de la tabla antigua (para Dante y como respaldo) ─
CREATE OR REPLACE VIEW public.psicologos_por_centro AS
SELECT p.id, p.nombre, p.email, p.telefono, p.calendar_id, p.activo,
       p.puede_bloquear, p.citas_media_hora, p.tipos_consulta,
       pc.centro_id, c.nombre AS centro
FROM public.psicologos p
JOIN public.psicologos_centros pc ON pc.psicologo_id = p.id
JOIN public.centros c ON c.id = pc.centro_id;

-- ── 5. pacientes: tres psicólogos por tipo ──────────────────────────────────
ALTER TABLE public.pacientes
  DROP COLUMN IF EXISTS psicologo_id,
  ADD COLUMN IF NOT EXISTS psicologo_adultos_id  uuid REFERENCES public.psicologos(id),
  ADD COLUMN IF NOT EXISTS psicologo_pareja_id   uuid REFERENCES public.psicologos(id),
  ADD COLUMN IF NOT EXISTS psicologo_infantil_id uuid REFERENCES public.psicologos(id);
ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_algun_psicologo;
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_algun_psicologo
  CHECK (psicologo_adultos_id IS NOT NULL OR psicologo_pareja_id IS NOT NULL OR psicologo_infantil_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS pacientes_psi_adultos_idx  ON public.pacientes (psicologo_adultos_id);
CREATE INDEX IF NOT EXISTS pacientes_psi_pareja_idx   ON public.pacientes (psicologo_pareja_id);
CREATE INDEX IF NOT EXISTS pacientes_psi_infantil_idx ON public.pacientes (psicologo_infantil_id);
COMMENT ON COLUMN public.pacientes.centro_id IS 'Centro del alta. Informativo; no decide nada.';

-- ── 6. asociados_menores: tutor que ya es paciente ──────────────────────────
ALTER TABLE public.asociados_menores
  ADD COLUMN IF NOT EXISTS "T1_paciente_id" uuid REFERENCES public.pacientes(id),
  ADD COLUMN IF NOT EXISTS "T2_paciente_id" uuid REFERENCES public.pacientes(id);

-- ── 7. centro de cada cita ──────────────────────────────────────────────────
ALTER TABLE public.acciones_psicologos ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES public.centros(id);
ALTER TABLE public.acciones_historial  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES public.centros(id);
CREATE INDEX IF NOT EXISTS acciones_psicologos_centro_idx ON public.acciones_psicologos (centro_id, fecha_cita);

-- ── 8. Trigger de historial (misma función de la 011, ahora copia centro_id) ─
CREATE OR REPLACE FUNCTION public.registrar_historial_accion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := NEW.accion::text;
  ELSE
    IF NEW.accion::text = 'Cancelar cita' AND OLD.accion::text IS DISTINCT FROM 'Cancelar cita' THEN
      v_accion := 'Cancelar cita';
    ELSIF NEW.accion::text = 'Desbloquear agenda' AND OLD.accion::text IS DISTINCT FROM 'Desbloquear agenda' THEN
      v_accion := 'Desbloquear agenda';
    ELSIF NEW.accion::text = 'Agendar cita' AND OLD.accion::text = 'Agendar cita'
          AND (NEW.fecha_cita, NEW.hora_cita) IS DISTINCT FROM (OLD.fecha_cita, OLD.hora_cita) THEN
      v_accion := 'Cambiar cita';
    ELSIF NEW.accion::text = 'Bloquear agenda' AND OLD.accion::text = 'Bloquear agenda'
          AND (NEW.fecha_bloqueo_inicio, NEW.fecha_bloqueo_fin)
              IS DISTINCT FROM (OLD.fecha_bloqueo_inicio, OLD.fecha_bloqueo_fin) THEN
      v_accion := 'Modificar bloqueo personal';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.acciones_historial (
    accion_id, accion, psicologo_id, paciente_id, gcal_event_id, tipo_cita, centro_id,
    fecha_cita, hora_cita, fecha_cita_anterior, hora_cita_anterior,
    fecha_bloqueo_inicio, fecha_bloqueo_fin,
    fecha_bloqueo_inicio_anterior, fecha_bloqueo_fin_anterior,
    motivo_bloqueo, realizado_por_id, realizado_por, origen, creado_en
  ) VALUES (
    NEW.id, v_accion, NEW.psicologo_id, NEW.paciente_id, NEW.gcal_event_id, NEW.tipo_cita::text, NEW.centro_id,
    NEW.fecha_cita, NEW.hora_cita,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.fecha_cita END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.hora_cita END,
    NEW.fecha_bloqueo_inicio, NEW.fecha_bloqueo_fin,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.fecha_bloqueo_inicio END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.fecha_bloqueo_fin END,
    NEW.motivo_bloqueo::text,
    CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(NEW.ultima_accion_por_id, NEW.created_by_id) ELSE COALESCE(NEW.created_by_id, NEW.ultima_accion_por_id) END,
    CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(NEW.ultima_accion_por,    NEW.created_by)    ELSE COALESCE(NEW.created_by,    NEW.ultima_accion_por)    END,
    NEW.origen,
    now()
  );
  RETURN NEW;
END;
$$;
-- El trigger trg_acciones_psicologos_historial (011) sigue apuntando a esta función.
-- El aviso a Elias (notify_calendar_historial, 011) usa to_jsonb(fila) y ya incluye centro_id.

COMMIT;

-- Comprobaciones:
-- SELECT count(*) FROM pacientes;                                       -- 0
-- SELECT nombre, email, tipos_consulta FROM psicologos ORDER BY nombre;  -- una fila por persona real, sin sufijos
-- SELECT * FROM psicologos_por_centro ORDER BY nombre, centro;           -- una fila por persona × centro
-- SELECT * FROM migracion_014_ids;                                       -- fichas fusionadas (para Elias)
-- SELECT count(*) FROM agentes;                                          -- igual que antes
-- SELECT column_name FROM information_schema.columns WHERE table_name='pacientes' AND column_name LIKE 'psicologo_%';  -- 3 filas
```

- [x] **Step 2: Ejecutar en el SQL Editor de Supabase** (lo hace Sonia o el agente con acceso). Aceptar el aviso de operaciones destructivas.

- [x] **Step 3: Verificar** con las cuatro consultas del final del archivo. Además, desde el repo:

Run:
```bash
cd somos-app && URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"\r') && KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"\r') && curl -s "$URL/rest/v1/psicologos_por_centro?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: lista con una fila por psicólogo real × centro (sin error PGRST). Si devuelve error de permisos, ejecutar `ALTER VIEW public.psicologos_por_centro OWNER TO postgres; GRANT SELECT ON public.psicologos_por_centro TO anon, authenticated;`.

- [x] **Step 4: Comprobar la Review Focus 5** (cita sin centro): insertar y borrar una fila de prueba en el SQL Editor, usando el id de un psicólogo real:

```sql
INSERT INTO acciones_psicologos (psicologo_id, accion, activo) VALUES ('<id de un psicólogo real>', 'Bloquear agenda', true);
SELECT accion, centro_id FROM acciones_historial;   -- 1 fila, centro_id NULL, sin error
DELETE FROM acciones_psicologos; DELETE FROM acciones_historial;
```
Nota: el aviso a Elias se dispara con ese insert; avisarle de que es una prueba.

- [ ] **Step 4b: Cuentas de Auth de las fichas de prueba borradas** — en Supabase › Authentication, borrar a mano los usuarios cuyos emails ya no tienen perfil (`SELECT email FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM perfiles p WHERE p.id = u.id)`). Los agentes y psicólogos reales conservan su cuenta.

- [x] **Step 5: Commit del archivo** (la carpeta `Supabase/` no está en git; guardar el archivo y anotarlo en `docs/make-cambios-2026-09-26.md` de la Tarea 8 como "ejecutada el <fecha>").

---

### Task 2: Tipos TypeScript

**Files:**
- Modify: `types/database.ts` (líneas 36-48 `Psicologo`, 73-95 `Paciente`, 112-133 `AccionPsicologo`, `AccionHistorial`, 259-285 `AsociadoMenor`, bloque `Database.public.Tables`)

**Interfaces:**
- Produces: `Psicologo` (sin `centro_id`/`centro`, con `tipos_consulta: TipoCita[]`), `PsicologoCentro`, `PsicologoPorCentro`, `Paciente` (tres columnas), `AsociadoMenor` con `T1_paciente_id`/`T2_paciente_id`, `AccionPsicologo.centro_id`, `AccionHistorial.centro_id`, tabla `psicologos_centros` y vista `psicologos_por_centro` en `Database`.

- [x] **Step 1: Cambiar `Psicologo` y añadir tipos nuevos**

Sustituir el tipo `Psicologo` por:

```ts
export type Psicologo = {
  id: string
  nombre: string
  activo: boolean
  telefono: string | null
  calendar_id: string | null
  email: string | null
  puede_bloquear: boolean | null
  /** true = admite citas a y media. Botón "30'" en Usuarios. Migración 012. */
  citas_media_hora: boolean | null
  /** Tipos de consulta que pasa (migración 014). Mismos valores que TipoCita. */
  tipos_consulta: TipoCita[]
}

/** Fila de psicologos_centros (migración 014): un psicólogo trabaja en N centros. */
export type PsicologoCentro = { psicologo_id: string; centro_id: string }

/** Fila de la vista psicologos_por_centro: una por psicólogo × centro. */
export type PsicologoPorCentro = Psicologo & { centro_id: string; centro: string }
```

En `PsicologoInsert` quitar `centro_id` y `centro` si existen y añadir `tipos_consulta?: TipoCita[]`.

- [x] **Step 2: Cambiar `Paciente`**

Quitar `psicologo_id: string` y añadir, en su lugar:

```ts
  /** Psicólogos por tipo de consulta (migración 014). Al menos uno relleno. */
  psicologo_adultos_id: string | null
  psicologo_pareja_id: string | null
  psicologo_infantil_id: string | null
```

Hacer lo mismo en `PacienteInsert` (opcionales).

- [x] **Step 3: `AccionPsicologo`, `AccionHistorial`, `AsociadoMenor`**

Añadir `centro_id: string | null` a `AccionPsicologo` (tras `psicologo_id`) y a `AccionHistorial` (tras `paciente_id`), y en sus `Insert`. Añadir a `AsociadoMenor` y `AsociadoMenorInsert`:

```ts
  T1_paciente_id?: string | null
  T2_paciente_id?: string | null
```
(en `AsociadoMenor` sin `?`, tipo `string | null`).

- [x] **Step 4: Registrar tabla y vista en `Database`**

Junto a la entrada `psicologos` del bloque `Tables`:

```ts
      psicologos_centros: {
        Row: PsicologoCentro
        Insert: PsicologoCentro
        Update: Partial<PsicologoCentro>
        Relationships: []
      }
```

Y en `Views` (crear el bloque si no existe, al mismo nivel que `Tables`):

```ts
    Views: {
      psicologos_por_centro: {
        Row: PsicologoPorCentro
        Relationships: []
      }
    }
```

- [x] **Step 5: Type-check (fallará en los usos de `psicologo_id`/`centro_id`; es la lista de trabajo de las tareas 4-7)**

Run: `cd somos-app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: número > 0. Guardar la salida completa en `docs/superpowers/plans/tsc-tarea2.txt` para consultarla en las tareas siguientes (no commitear ese txt).

- [x] **Step 6: Commit**

```bash
git checkout -b modelo-pacientes-psicologos main
git add types/database.ts
git commit -m "Tipos: psicólogo con centros y tipos de consulta, paciente con tres psicólogos, centro_id en citas (migración 014)"
```

---

### Task 3: Lógica pura de tipos y duplicados (`lib/pacientes-tipos.ts`) con tests

**Files:**
- Create: `lib/pacientes-tipos.ts`
- Test: `lib/pacientes-tipos.test.ts`

**Interfaces:**
- Produces:
  - `type TipoConsulta = TipoCita` (`'adulto' | 'pareja' | 'menor'`)
  - `COLUMNA_PSICOLOGO: Record<TipoConsulta, 'psicologo_adultos_id' | 'psicologo_pareja_id' | 'psicologo_infantil_id'>`
  - `ETIQUETA_TIPO: Record<TipoConsulta, string>` → 'Adultos' | 'Pareja' | 'Infantil'
  - `normalizarNombre(nombre: string): string`
  - `filtroPacientesDePsicologo(psicologoId: string): string` → cadena para `.or()` de Supabase
  - `tiposDePaciente(p: PacienteTipos, psicologoId: string): TipoConsulta[]`
  - `tiposDisponibles(psicologo: { tipos_consulta: TipoConsulta[] } | null, esMenor: boolean | null): TipoConsulta[]`
  - `evaluarDuplicado(nuevo: NuevoPaciente, existentes: PacienteExistente[]): DecisionDuplicado`

- [x] **Step 1: Escribir los tests (fallan porque el módulo no existe)**

```ts
// lib/pacientes-tipos.test.ts
import { describe, it, expect } from 'vitest'
import {
  COLUMNA_PSICOLOGO, normalizarNombre, filtroPacientesDePsicologo, tiposDePaciente,
  tiposDisponibles, evaluarDuplicado, type PacienteExistente,
} from './pacientes-tipos'

const base = (over: Partial<PacienteExistente> = {}): PacienteExistente => ({
  id: 'p1', nombre: 'Ana Belén', telefono: '600111222', fecha_nacimiento: '1990-05-04',
  psicologo_adultos_id: 'psi-A', psicologo_pareja_id: null, psicologo_infantil_id: null, ...over,
})

describe('COLUMNA_PSICOLOGO', () => {
  it('mapea cada tipo a su columna', () => {
    expect(COLUMNA_PSICOLOGO.adulto).toBe('psicologo_adultos_id')
    expect(COLUMNA_PSICOLOGO.pareja).toBe('psicologo_pareja_id')
    expect(COLUMNA_PSICOLOGO.menor).toBe('psicologo_infantil_id')
  })
})

describe('normalizarNombre', () => {
  it('ignora tildes, mayúsculas y espacios de más', () => {
    expect(normalizarNombre('  Ana  BELÉN ')).toBe('ana belen')
    expect(normalizarNombre('ana belen')).toBe('ana belen')
  })
})

describe('filtroPacientesDePsicologo', () => {
  it('genera el or de las tres columnas', () => {
    expect(filtroPacientesDePsicologo('x')).toBe(
      'psicologo_adultos_id.eq.x,psicologo_pareja_id.eq.x,psicologo_infantil_id.eq.x',
    )
  })
})

describe('tiposDePaciente', () => {
  it('devuelve los tipos en los que ese psicólogo atiende al paciente', () => {
    const p = base({ psicologo_adultos_id: 'psi-A', psicologo_pareja_id: 'psi-A', psicologo_infantil_id: 'psi-B' })
    expect(tiposDePaciente(p, 'psi-A')).toEqual(['adulto', 'pareja'])
    expect(tiposDePaciente(p, 'psi-B')).toEqual(['menor'])
    expect(tiposDePaciente(p, 'psi-C')).toEqual([])
  })
})

describe('tiposDisponibles', () => {
  it('menor → solo menor si el psicólogo lo pasa', () => {
    expect(tiposDisponibles({ tipos_consulta: ['adulto', 'menor'] }, true)).toEqual(['menor'])
  })
  it('adulto → los tipos del psicólogo salvo menor', () => {
    expect(tiposDisponibles({ tipos_consulta: ['adulto', 'pareja', 'menor'] }, false)).toEqual(['adulto', 'pareja'])
  })
  it('sin tipos configurados → los tres (no bloquear al usuario)', () => {
    expect(tiposDisponibles({ tipos_consulta: [] }, null)).toEqual(['adulto', 'pareja', 'menor'])
    expect(tiposDisponibles(null, null)).toEqual(['adulto', 'pareja', 'menor'])
  })
})

describe('evaluarDuplicado', () => {
  it('sin coincidencias → ninguno', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '699000000', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r.tipo).toBe('ninguno')
  })
  it('adulto: mismo teléfono y mismo nombre (aunque cambie la forma) → bloquear', () => {
    const r = evaluarDuplicado(
      { nombre: 'ANA BELEN', telefono: '600111222', fechaNacimiento: '1990-05-04', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'mismo_telefono_y_nombre', paciente: { id: 'p1' } })
  })
  it('pareja: mismo teléfono, otro nombre → confirmar suave, columna libre', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', fuerza: 'suave', paciente: { id: 'p1' }, columnaOcupadaPor: null })
  })
  it('adulto: mismo teléfono, otro nombre → confirmar fuerte', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'adulto', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', fuerza: 'fuerte' })
  })
  it('pareja: la ficha ya tiene otro psicólogo de pareja → confirmar con columnaOcupadaPor', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-B' },
      [base({ psicologo_pareja_id: 'psi-Z' })],
    )
    expect(r).toMatchObject({ tipo: 'confirmar', columnaOcupadaPor: 'psi-Z' })
  })
  it('pareja: la ficha ya tiene a ESTE psicólogo de pareja → bloquear (ya está en su lista)', () => {
    const r = evaluarDuplicado(
      { nombre: 'Luis Gómez', telefono: '600111222', fechaNacimiento: '1980-01-01', esMenor: false, tipoConsulta: 'pareja', psicologoId: 'psi-Z' },
      [base({ psicologo_pareja_id: 'psi-Z' })],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'ya_en_tu_lista' })
  })
  it('menor: mismo nombre y misma fecha → bloquear; el teléfono no cuenta', () => {
    const r = evaluarDuplicado(
      { nombre: 'ana belén', telefono: '', fechaNacimiento: '1990-05-04', esMenor: true, tipoConsulta: 'menor', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r).toMatchObject({ tipo: 'bloquear', motivo: 'menor_mismo_nombre_fecha' })
  })
  it('menor: misma fecha pero otro nombre → ninguno', () => {
    const r = evaluarDuplicado(
      { nombre: 'Pedro Ruiz', telefono: '', fechaNacimiento: '1990-05-04', esMenor: true, tipoConsulta: 'menor', psicologoId: 'psi-B' },
      [base()],
    )
    expect(r.tipo).toBe('ninguno')
  })
})
```

- [x] **Step 2: Ejecutar y ver que falla**

Run: `cd somos-app && npm test -- lib/pacientes-tipos.test.ts`
Expected: FAIL, "Cannot find module './pacientes-tipos'".

- [x] **Step 3: Implementar el módulo**

```ts
// lib/pacientes-tipos.ts
// Lógica pura del modelo "paciente con varios psicólogos por tipo" (migración 014).
// Sin acceso a datos: las pantallas consultan Supabase y llaman a estas funciones.
import type { TipoCita } from '@/types/database'

export type TipoConsulta = TipoCita
export type ColumnaPsicologo = 'psicologo_adultos_id' | 'psicologo_pareja_id' | 'psicologo_infantil_id'

export const TIPOS_CONSULTA: TipoConsulta[] = ['adulto', 'pareja', 'menor']

export const COLUMNA_PSICOLOGO: Record<TipoConsulta, ColumnaPsicologo> = {
  adulto: 'psicologo_adultos_id',
  pareja: 'psicologo_pareja_id',
  menor: 'psicologo_infantil_id',
}

export const ETIQUETA_TIPO: Record<TipoConsulta, string> = {
  adulto: 'Adultos',
  pareja: 'Pareja',
  menor: 'Infantil',
}

/** minúsculas, sin tildes, espacios colapsados: "  Ana  BELÉN " → "ana belen" */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Cadena para `.or(...)` de Supabase: pacientes atendidos por ese psicólogo en cualquier tipo. */
export function filtroPacientesDePsicologo(psicologoId: string): string {
  return TIPOS_CONSULTA.map((t) => `${COLUMNA_PSICOLOGO[t]}.eq.${psicologoId}`).join(',')
}

export type PacienteTipos = Record<ColumnaPsicologo, string | null>

export function tiposDePaciente(p: PacienteTipos, psicologoId: string): TipoConsulta[] {
  return TIPOS_CONSULTA.filter((t) => p[COLUMNA_PSICOLOGO[t]] === psicologoId)
}

/**
 * Tipos que puede elegir el usuario: los del psicólogo, acotados por la edad del
 * paciente. Sin tipos configurados (ficha antigua o vacía) se ofrecen los tres.
 */
export function tiposDisponibles(
  psicologo: { tipos_consulta: TipoConsulta[] } | null,
  esMenor: boolean | null,
): TipoConsulta[] {
  const propios = psicologo?.tipos_consulta?.length ? psicologo.tipos_consulta : TIPOS_CONSULTA
  if (esMenor === true) return propios.includes('menor') ? ['menor'] : []
  if (esMenor === false) return propios.filter((t) => t !== 'menor')
  return [...propios]
}

export type PacienteExistente = PacienteTipos & {
  id: string
  nombre: string
  telefono: string | null
  fecha_nacimiento: string | null
}

export type NuevoPaciente = {
  nombre: string
  telefono: string
  fechaNacimiento: string
  esMenor: boolean
  tipoConsulta: TipoConsulta
  psicologoId: string
}

export type DecisionDuplicado =
  | { tipo: 'ninguno' }
  | { tipo: 'bloquear'; paciente: PacienteExistente; motivo: 'menor_mismo_nombre_fecha' | 'mismo_telefono_y_nombre' | 'ya_en_tu_lista' }
  | { tipo: 'confirmar'; paciente: PacienteExistente; fuerza: 'suave' | 'fuerte'; columnaOcupadaPor: string | null }

/**
 * Decide qué hacer antes de crear un paciente (reglas de la especificación §5).
 * `existentes` son los candidatos que la pantalla ya ha consultado: por teléfono
 * (adultos) o por fecha de nacimiento (menores).
 */
export function evaluarDuplicado(nuevo: NuevoPaciente, existentes: PacienteExistente[]): DecisionDuplicado {
  const nombreNuevo = normalizarNombre(nuevo.nombre)

  if (nuevo.esMenor) {
    const igual = existentes.find(
      (p) => p.fecha_nacimiento === nuevo.fechaNacimiento && normalizarNombre(p.nombre) === nombreNuevo,
    )
    return igual ? { tipo: 'bloquear', paciente: igual, motivo: 'menor_mismo_nombre_fecha' } : { tipo: 'ninguno' }
  }

  const telefono = nuevo.telefono.trim()
  const mismoTelefono = telefono ? existentes.filter((p) => (p.telefono ?? '').trim() === telefono) : []
  if (mismoTelefono.length === 0) return { tipo: 'ninguno' }

  const mismoNombre = mismoTelefono.find((p) => normalizarNombre(p.nombre) === nombreNuevo)
  if (mismoNombre) return { tipo: 'bloquear', paciente: mismoNombre, motivo: 'mismo_telefono_y_nombre' }

  const candidato = mismoTelefono[0]
  const columna = COLUMNA_PSICOLOGO[nuevo.tipoConsulta]
  const ocupadaPor = candidato[columna]
  if (ocupadaPor === nuevo.psicologoId) return { tipo: 'bloquear', paciente: candidato, motivo: 'ya_en_tu_lista' }
  return {
    tipo: 'confirmar',
    paciente: candidato,
    fuerza: nuevo.tipoConsulta === 'pareja' ? 'suave' : 'fuerte',
    columnaOcupadaPor: ocupadaPor ?? null,
  }
}
```

- [x] **Step 4: Ejecutar los tests**

Run: `cd somos-app && npm test -- lib/pacientes-tipos.test.ts`
Expected: PASS (12 tests).

- [x] **Step 5: Commit**

```bash
git add lib/pacientes-tipos.ts lib/pacientes-tipos.test.ts
git commit -m "Lógica pura de tipos de consulta y duplicados de pacientes con tests"
```

---

### Task 4: Alta y edición de psicólogos (API + pantalla Usuarios)

**Files:**
- Modify: `app/api/usuarios/route.ts` (GET líneas 12-80; POST 82-197)
- Modify: `app/api/usuarios/[id]/route.ts` (PATCH líneas 7-115)
- Modify: `app/dashboard/usuarios/page.tsx` (estado 150-200, formulario 396-425, listado ~440-490)

**Interfaces:**
- Consumes: `Psicologo`, `PsicologoCentro`, `TipoCita` (Tarea 2); `ETIQUETA_TIPO`, `TIPOS_CONSULTA` (Tarea 3).
- Produces: `POST /api/usuarios` acepta `tipos_consulta: TipoCita[]` y `centro_ids: string[]` y crea UNA fila; `GET /api/usuarios` devuelve en cada psicólogo `centro_ids: string[]`, `centros_nombres: string[]`, `tipos_consulta: TipoCita[]`; `PATCH /api/usuarios/[id]` acepta `centro_ids` y `tipos_consulta`.

- [x] **Step 1: GET — devolver centros y tipos de cada psicólogo**

En `route.ts` GET, cambiar el `select` de psicólogos a `'id, nombre, email, telefono, calendar_id, activo, puede_bloquear, citas_media_hora, tipos_consulta'` y añadir una consulta `admin.from('psicologos_centros').select('psicologo_id, centro_id')`. Componer cada fila de salida con:

```ts
const centrosDe = new Map<string, string[]>()
for (const pc of (psicologosCentros.data ?? [])) {
  const l = centrosDe.get(pc.psicologo_id) ?? []
  l.push(pc.centro_id)
  centrosDe.set(pc.psicologo_id, l)
}
const centroNombre = new Map((centros.data ?? []).map((c) => [c.id, c.nombre]))
// en el map de psicólogos:
centro_ids: centrosDe.get(p.id) ?? [],
centros_nombres: (centrosDe.get(p.id) ?? []).map((id) => centroNombre.get(id) ?? '—'),
tipos_consulta: p.tipos_consulta ?? [],
```
Eliminar cualquier agrupación por email/`centro_id` que quede en el GET (buscar `centro_id` en el archivo: la única referencia válida tras esta tarea es la de agentes).

- [x] **Step 2: POST — una fila + centros + tipos**

En `CrearBody` añadir `tipos_consulta?: TipoCita[] | null` (importar `TipoCita` de `@/types/database`). Tras la validación de `centroIds`, añadir:

```ts
const tiposConsulta = Array.from(new Set((body.tipos_consulta ?? []).filter((t): t is TipoCita => TIPOS_CONSULTA.includes(t))))
if (body.tipo === 'psicologo' && tiposConsulta.length === 0)
  return NextResponse.json({ error: 'Selecciona al menos un tipo de consulta para el psicólogo' }, { status: 400 })
```
(importar `TIPOS_CONSULTA` de `@/lib/pacientes-tipos`). Eliminar el bloque `centroNombres` (ya no existe `psicologos.centro`); mantener la comprobación de que los centros existen con `admin.from('centros').select('id').in('id', centroIds)` y comparar longitudes.

Sustituir el "Paso 3" por:

```ts
    const psi = await admin
      .from('psicologos')
      .insert({
        nombre,
        email,
        telefono: body.telefono ?? null,
        calendar_id: body.calendar_id!.trim(),
        activo: true,
        tipos_consulta: tiposConsulta,
      })
      .select('id')
      .single()
    if (psi.error || !psi.data) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: psi.error?.message ?? 'Error creando psicólogo' }, { status: 500 })
    }
    const psicologoId = psi.data.id
    const pcs = await admin
      .from('psicologos_centros')
      .insert(centroIds.map((centroId) => ({ psicologo_id: psicologoId, centro_id: centroId })))
    if (pcs.error) {
      await admin.from('psicologos').delete().eq('id', psicologoId)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: pcs.error.message }, { status: 500 })
    }
    const perfil = await admin.from('perfiles').insert({
      id: userId, nombre, rol: 'psicologo', psicologo_id: psicologoId, centro_id: centroIds[0],
    })
    if (perfil.error) {
      await admin.from('psicologos').delete().eq('id', psicologoId) // borra también psicologos_centros (cascade)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: perfil.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: psicologoId, email, password, emailSent }, { status: 201 })
```

- [x] **Step 3: PATCH — centros, tipos y permisos por id**

En `EditarBody` sustituir `centro_id?: string | null` por `centro_ids?: string[]` y añadir `tipos_consulta?: TipoCita[]`. En la rama `psicologo`:
- Quitar el bloque `if (body.centro_id !== undefined) {…}` entero.
- Añadir `if (body.tipos_consulta !== undefined) campos.tipos_consulta = body.tipos_consulta.filter((t) => TIPOS_CONSULTA.includes(t))`.
- Tras el `update` de campos, si `body.centro_ids !== undefined`:

```ts
      const ids = Array.from(new Set(body.centro_ids.filter(Boolean)))
      if (ids.length === 0) return NextResponse.json({ error: 'Un psicólogo necesita al menos un centro' }, { status: 400 })
      const del = await admin.from('psicologos_centros').delete().eq('psicologo_id', id)
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
      const ins = await admin.from('psicologos_centros').insert(ids.map((centro_id) => ({ psicologo_id: id, centro_id })))
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
```
- Simplificar `puede_bloquear` y `citas_media_hora`: quitar la búsqueda por email y dejar solo `admin.from('psicologos').update({ puede_bloquear: body.puede_bloquear }).eq('id', id)` (ídem medias horas). Actualizar el comentario de horarios: "horario del psicólogo (único)".

- [x] **Step 4: Pantalla Usuarios**

En `page.tsx`:
- Tipo de fila de psicólogo (líneas ~50-58): sustituir `centro_id: string | null` por `centro_ids: string[]; centros_nombres: string[]; tipos_consulta: TipoCita[]`.
- Estado del alta: añadir `const [tiposConsulta, setTiposConsulta] = useState<TipoCita[]>(['adulto'])` y

```ts
  function toggleTipoAlta(t: TipoCita) {
    setTiposConsulta((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
```
- En `crear`: validar `if (tipo === 'psicologo' && tiposConsulta.length === 0) { setError('Selecciona al menos un tipo de consulta'); return }` y enviar `tipos_consulta: tipo === 'psicologo' ? tiposConsulta : null` (quitar `centro_id` del cuerpo cuando `tipo === 'psicologo'`).
- Debajo del bloque de checkboxes de centros (línea ~411), añadir un bloque igual para tipos:

```tsx
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5870', margin: '12px 0 8px' }}>Tipos de consulta</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {TIPOS_CONSULTA.map((t) => (
                <label key={t} style={{ fontSize: 13, color: '#4a5870', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tiposConsulta.includes(t)} onChange={() => toggleTipoAlta(t)} />
                  {ETIQUETA_TIPO[t]}
                </label>
              ))}
            </div>
```
  y cambiar el texto de ayuda a "Una sola ficha; los centros y los tipos se pueden cambiar después."
- Listado de psicólogos: donde se muestra el centro, mostrar `p.centros_nombres.join(' · ')` y debajo, en pequeño, `p.tipos_consulta.map((t) => ETIQUETA_TIPO[t]).join(' · ') || 'Sin tipos'`. Añadir dos `ActionButton`: "Centros" (prompt con checkboxes → `patchUsuario(id, { tipo: 'psicologo', centro_ids })`) y "Tipos" (ídem con `tipos_consulta`). Si la pantalla no tiene un diálogo reutilizable, usar un pequeño panel inline con checkboxes como el del alta (mismo patrón que `editandoHorario`).
- Quitar `centroId` para psicólogos (solo lo usan agentes y call center).

- [x] **Step 5: Type-check y prueba manual**

Run: `cd somos-app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/api/usuarios\|app/dashboard/usuarios"`
Expected: sin líneas. Luego `npm run dev`, entrar como agente, crear un psicólogo de prueba con dos centros y dos tipos: en Supabase, una fila en `psicologos`, dos en `psicologos_centros`, `tipos_consulta = {adulto,pareja}`, perfil creado. Editar centros y tipos y comprobar que se sincronizan.

- [x] **Step 6: Commit**

```bash
git add app/api/usuarios app/dashboard/usuarios/page.tsx
git commit -m "Usuarios: una ficha por psicólogo con centros (psicologos_centros) y tipos de consulta"
```

---

### Task 5: Centro activo, disponibilidad y formulario de Citas

**Files:**
- Modify: `lib/centro-activo.ts`
- Modify: `lib/disponibilidad-datos.ts` (líneas 27-40)
- Modify: `app/dashboard/psicologos/page.tsx` (variantes 372-392; selección de centro 246-256 y 740-760 `elegirCentro`/`cambiarDeCentro`; desplegable de pacientes ~285-300; tipo de cita 197 y 394-399 y el `<select>` de tipo; payload 740-770)

**Interfaces:**
- Consumes: `filtroPacientesDePsicologo`, `tiposDisponibles`, `ETIQUETA_TIPO` (Tarea 3); `Psicologo.tipos_consulta` (Tarea 2).
- Produces: `datosProcesados.psicologo_id` y `datosProcesados.centro_id` en el envío a Make (Agendar/Cambiar/Cancelar/bloqueos); `CentroActivo = { psicologoId: string; centroId: string }` (mismo tipo, `psicologoId` es siempre el único id).

- [x] **Step 1: `lib/centro-activo.ts`** — sustituir el comentario de cabecera por:

```ts
// Selección de centro activo para psicólogos que trabajan en varios centros.
// Desde la migración 014 un psicólogo es una sola fila; sus centros están en
// `psicologos_centros`. Se guarda el centro elegido por usuario en localStorage.
```
No cambia la API (`CentroActivo`, `getCentroActivo`, `setCentroActivo`, `clearCentroActivo`).

- [x] **Step 2: `lib/disponibilidad-datos.ts`** — quitar la búsqueda de fichas por `calendar_id` (líneas 32-37) y usar `.eq('psicologo_id', p.id)` en citas y bloqueos. Actualizar el comentario: "citas y bloqueos del psicólogo (una sola ficha desde la 014)".

- [x] **Step 3: Citas — cargar la ficha única y sus centros**

Sustituir el `useEffect` "Multi-centro" (líneas 372-392) por:

```ts
  // Psicólogo logueado: su ficha (por email, con respaldo en perfil) y sus centros.
  useEffect(() => {
    if (!esPsicologo || !userId) return
    let cancelled = false
    async function cargar() {
      let ficha: Psicologo | null = null
      if (userEmail) {
        const { data } = await supabase.from('psicologos').select('*').eq('email', userEmail).eq('activo', true).maybeSingle()
        ficha = (data as Psicologo | null) ?? null
      }
      if (!ficha && perfil?.psicologo_id) {
        const { data } = await supabase.from('psicologos').select('*').eq('id', perfil.psicologo_id).maybeSingle()
        ficha = (data as Psicologo | null) ?? null
      }
      if (cancelled) return
      setMiFicha(ficha)
      if (!ficha) { setMisCentros([]); setVariantesCargadas(true); return }
      const { data: pcs } = await supabase.from('psicologos_centros').select('centro_id').eq('psicologo_id', ficha.id)
      if (cancelled) return
      const ids = (pcs ?? []).map((r) => r.centro_id)
      setMisCentros(ids)
      const guardada = getCentroActivo(userId)
      if (guardada && guardada.psicologoId === ficha.id && ids.includes(guardada.centroId)) setCentroActivoState(guardada)
      else if (ids.length === 1) setCentroActivoState({ psicologoId: ficha.id, centroId: ids[0] })
      setVariantesCargadas(true)
    }
    cargar()
    return () => { cancelled = true }
  }, [esPsicologo, userEmail, userId, perfil?.psicologo_id])
```
Estados: sustituir `misVariantes` por `const [miFicha, setMiFicha] = useState<Psicologo | null>(null)` y `const [misCentros, setMisCentros] = useState<string[]>([])`. Reescribir:
- `esMultiCentro = esPsicologo && misCentros.length > 1`
- `psiPsicologoId = miFicha?.id ?? perfil?.psicologo_id ?? null`
- `psiCentroId = centroActivo?.centroId ?? (misCentros.length === 1 ? misCentros[0] : null) ?? perfil?.centro_id ?? null`
- La pantalla de "elige centro" itera `misCentros` y muestra `centros.find(c => c.id === id)?.nombre`; `elegirCentro(centroId)` guarda `{ psicologoId: miFicha!.id, centroId }`.

- [x] **Step 4: Desplegable de pacientes** (líneas ~285-300): sustituir `.eq('psicologo_id', psicologoId)` por `.or(filtroPacientesDePsicologo(psicologoId))` y en el `select` añadir las tres columnas `psicologo_adultos_id, psicologo_pareja_id, psicologo_infantil_id`.

- [x] **Step 5: Tipo de cita limitado** — donde se renderiza el `<select>` de tipo de cita (buscar `setTipoCita(e.target.value`), calcular:

```ts
  const tiposCita = tiposDisponibles(psicologoSeleccionado, pacienteSeleccionado ? pacienteSeleccionado.es_menor : null)
```
y renderizar solo `tiposCita.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)`. Cambiar el `useEffect` de preselección (394-399) a: `setTipoCita(tiposCita.length === 1 ? tiposCita[0] : (pacienteSeleccionado.es_menor ? 'menor' : 'adulto'))`, solo si el valor calculado está en `tiposCita`. Si `tiposCita.length === 0` mostrar bajo el select el aviso "Este psicólogo no atiende este tipo de paciente." y no dejar enviar.

- [x] **Step 6: Envío a Make** — en `datosProcesados` (línea ~744) añadir, tras `psicologo_nombre`:

```ts
        psicologo_id:         effPsicologoId,
        centro_id:            effCentroId,
```
También en el envío de "Añadir nuevo paciente" (línea ~702) y en el de "Paciente duplicado" (~600).

- [x] **Step 7: Type-check y prueba manual**

Run: `cd somos-app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "psicologos/page.tsx\|lib/"`
Expected: sin líneas (las de la alta de paciente se resuelven en la Tarea 6; si quedan, anotarlas). Manual con el psicólogo de la Tarea 4: entra, elige centro, ve solo sus tipos de cita, agenda (Make apagado: el envío se queda en la cola del webhook; verlo en Make › Webhooks › Queue y **borrarlo**).

- [x] **Step 8: Commit**

```bash
git add lib/centro-activo.ts lib/disponibilidad-datos.ts app/dashboard/psicologos/page.tsx
git commit -m "Citas: ficha única de psicólogo, centro activo por psicologos_centros, tipos de cita del psicólogo, psicologo_id y centro_id en el envío"
```

---

### Task 6: Alta de paciente (tipo de consulta, duplicados, tutor existente, teléfono en menores)

**Files:**
- Modify: `app/dashboard/psicologos/page.tsx` (estado 210-226; validación 486-530; bloque "AÑADIR NUEVO PACIENTE" 580-735; JSX del formulario de alta — buscar `npTelefono` en el JSX)

**Interfaces:**
- Consumes: `evaluarDuplicado`, `COLUMNA_PSICOLOGO`, `tiposDisponibles`, `ETIQUETA_TIPO`, `normalizarNombre` (Tarea 3); `AsociadoMenorInsert.T1_paciente_id/T2_paciente_id` (Tarea 2).
- Produces: inserts en `pacientes` con la columna del tipo; vinculación (`update`) cuando el usuario confirma; `asociados_menores` con `Tn_paciente_id`.

- [x] **Step 1: Estado nuevo**

```ts
  const [npTipoConsulta, setNpTipoConsulta] = useState<TipoConsulta>('adulto')
  // Duplicado pendiente de confirmación (aviso suave/fuerte). null = no hay.
  const [npConfirmacion, setNpConfirmacion] = useState<{ decision: Extract<DecisionDuplicado, { tipo: 'confirmar' }>; nombrePsi: string; nombreOcupa: string | null } | null>(null)
  const [npT1PacienteId, setNpT1PacienteId] = useState<string | null>(null)
  const [npT2PacienteId, setNpT2PacienteId] = useState<string | null>(null)
  const [busquedaTutor, setBusquedaTutor] = useState<{ slot: 1 | 2; texto: string; resultados: PacienteExistente[] } | null>(null)
```
(importar `TipoConsulta`, `DecisionDuplicado`, `PacienteExistente` de `@/lib/pacientes-tipos`). Añadir los resets en `resetForm`.

- [x] **Step 2: JSX del alta**

- Teléfono: si `npEsMenor`, sustituir el `<input>` por `<div style={inputStyle}>El contacto será el teléfono del tutor 1</div>` (mismo estilo de campo, texto en gris `#7a9090`) y no exigirlo.
- Donde hoy se muestra el estado "es menor" (buscar `npEsMenor` en el JSX del alta): si `!npEsMenor` y hay fecha de nacimiento, renderizar:

```tsx
<FormField label="Tipo de consulta" required>
  <select value={npTipoConsulta} onChange={(e) => setNpTipoConsulta(e.target.value as TipoConsulta)} style={{ ...inputStyle, cursor: 'pointer' }}>
    {tiposDisponibles(psicologoSeleccionado, false).map((t) => (
      <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
    ))}
  </select>
</FormField>
```
  Si es menor, mantener la sección de tutores y fijar `npTipoConsulta = 'menor'` (un `useEffect` sobre `npEsMenor`).
- En cada tutor, un botón "Ya es paciente" que abre `busquedaTutor` con un input de texto (nombre o teléfono) y una lista de resultados; al elegir uno: rellenar `npT1Nombre/npT1Telefono/npT1Mail` (o T2) desde la ficha y guardar `npT1PacienteId` (o T2). Consulta:

```ts
async function buscarTutor(texto: string): Promise<PacienteExistente[]> {
  const q = texto.trim()
  if (q.length < 3) return []
  const { data } = await supabase
    .from('pacientes')
    .select('id, nombre, telefono, email, fecha_nacimiento, psicologo_adultos_id, psicologo_pareja_id, psicologo_infantil_id')
    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
    .eq('es_menor', false)
    .limit(8)
  return (data ?? []) as (PacienteExistente & { email: string | null })[]
}
```
- Bloque de confirmación de duplicado: cuando `npConfirmacion` no es null, en lugar del botón "Añadir" mostrar un `InfoBox` con el texto (según `fuerza`):
  - suave: `Este teléfono es de ${p.nombre}, en adultos con ${nombrePsi}. ¿Es la misma persona?`
  - fuerte: `Este teléfono ya es de ${p.nombre} con ${nombrePsi}. ¿Seguro que es para adultos?`
  - si `columnaOcupadaPor`: añadir ` ${p.nombre} ya tiene psicólogo de ${ETIQUETA_TIPO[npTipoConsulta].toLowerCase()}: ${nombreOcupa}. Si continúas, pasará a ser tuyo.`
  y dos botones: "Sí, vincular a mi lista" → `vincularExistente()`; "No, es otra persona" → `crearPaciente({ omitirDuplicados: true })`; y "Cancelar".

- [x] **Step 3: Lógica del alta** — reestructurar el bloque `if (isNuevoPaciente) {…}` del `handleSubmit` en tres funciones dentro del componente:

```ts
  async function candidatosDuplicado(): Promise<PacienteExistente[]> {
    const cols = 'id, nombre, telefono, fecha_nacimiento, psicologo_adultos_id, psicologo_pareja_id, psicologo_infantil_id'
    if (npEsMenor) {
      const { data } = await supabase.from('pacientes').select(cols).eq('fecha_nacimiento', npFechaNacimiento)
      return (data ?? []) as PacienteExistente[]
    }
    const { data } = await supabase.from('pacientes').select(cols).eq('telefono', npTelefono.trim())
    return (data ?? []) as PacienteExistente[]
  }

  async function avisarDuplicadoAMake(existente: PacienteExistente) {
    await fetch('/api/webhook/psicologos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: 'Paciente duplicado', responseId: 'web_' + Date.now(), timestampFormulario: new Date().toISOString(),
        datosProcesados: {
          psicologo_nombre: psicologoNombre, psicologo_id: effPsicologoId, centro_id: effCentroId,
          accion: 'Paciente duplicado', tipo_consulta: npTipoConsulta,
          psicologo_solicitante_nombre: psicologoNombre, psicologo_solicitante_id: effPsicologoId,
          paciente_existente_nombre: existente.nombre, paciente_existente_id: existente.id,
          telefono: npTelefono.trim() || null, nombre_intentado: npNombre.trim(),
          es_paciente_recomendado: npEsRecomendado,
        },
        respuestasFormulario: { 'Selecciona tu centro': centroNombre, '¿Qué necesitas hoy?': 'Añadir nuevo paciente' },
      }),
    })
  }

  async function vincularExistente() {
    const conf = npConfirmacion
    if (!conf || !effPsicologoId) return
    const columna = COLUMNA_PSICOLOGO[npTipoConsulta]
    const { error } = await supabase.from('pacientes').update({ [columna]: effPsicologoId }).eq('id', conf.decision.paciente.id)
    if (error) { setError('No se pudo vincular al paciente: ' + error.message); return }
    setNpConfirmacion(null)
    setSuccess(true)
    resetForm()
  }
```
En `handleSubmit`, rama `isNuevoPaciente`:

```ts
        const existentes = await candidatosDuplicado()
        const decision = evaluarDuplicado(
          { nombre: npNombre, telefono: npEsMenor ? '' : npTelefono, fechaNacimiento: npFechaNacimiento, esMenor: npEsMenor, tipoConsulta: npTipoConsulta, psicologoId: effPsicologoId },
          existentes,
        )
        if (decision.tipo === 'bloquear') {
          if (decision.motivo === 'ya_en_tu_lista') { setError(`Este paciente ya está en tu lista: ${decision.paciente.nombre}.`); return }
          await avisarDuplicadoAMake(decision.paciente)
          setError('Este paciente ya existe. Revisa los datos y vuelve a crearlo; el equipo está avisado. Si sigue fallando y los datos son correctos, contacta con nosotros.')
          return
        }
        if (decision.tipo === 'confirmar' && !omitirDuplicados) {
          const nombrePsi = nombreDePsicologo(decision.paciente) // ver abajo
          const nombreOcupa = decision.columnaOcupadaPor ? psicologos.find((p) => p.id === decision.columnaOcupadaPor)?.nombre ?? null : null
          setNpConfirmacion({ decision, nombrePsi, nombreOcupa })
          return
        }
        await crearPaciente()
```
donde `nombreDePsicologo(p)` devuelve el nombre del primer psicólogo no nulo de `p` (adultos, pareja, infantil) buscándolo en `psicologos`, y `crearPaciente()` contiene el insert actual con estos cambios:

```ts
          telefono:            npEsMenor ? npT1Telefono.trim() : telefonoNorm,
          centro_id:           effCentroId,
          [COLUMNA_PSICOLOGO[npTipoConsulta]]: effPsicologoId,
```
(eliminar `psicologo_id`), y en el insert de `asociados_menores` añadir `T1_paciente_id: npT1PacienteId, T2_paciente_id: npSoloUnTutor ? null : npT2PacienteId`. En el envío "Añadir nuevo paciente" añadir `tipo_consulta: npTipoConsulta`.

`handleSubmit` recibe el flag: crear `const [omitirDuplicados, setOmitirDuplicados] = useState(false)` y el botón "No, es otra persona" hace `setOmitirDuplicados(true); setNpConfirmacion(null)` y reenvía el formulario (`formRef.current?.requestSubmit()`); `resetForm` vuelve a ponerlo a false.

- [x] **Step 4: Validaciones** — en el bloque de validación del alta: el teléfono solo es obligatorio si `!npEsMenor`; si `npEsMenor`, `npT1Telefono` obligatorio (ya lo es). Si `tiposDisponibles(psicologoSeleccionado, npEsMenor).length === 0`: error "Este psicólogo no atiende este tipo de paciente."

- [x] **Step 5: Type-check y pruebas manuales** (Make apagado; borrar los envíos de la cola después)

Run: `cd somos-app && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errores en `psicologos/page.tsx`. Manual, en orden: (a) adulto tipo adultos → fila con `psicologo_adultos_id`; (b) misma persona, tipo pareja con otro psicólogo → aviso suave → "Sí" → misma fila con `psicologo_pareja_id`, sin fila nueva; (c) mismo teléfono y nombre → bloqueo con el texto nuevo; (d) menor con tutor 1 "ya es paciente" → `asociados_menores.T1_paciente_id` relleno y `pacientes.telefono` = teléfono del tutor; (e) menor duplicado (mismo nombre y fecha) → bloqueo.

- [x] **Step 6: Commit**

```bash
git add app/dashboard/psicologos/page.tsx
git commit -m "Alta de paciente: tipo de consulta, duplicados con vinculación, tutor existente y teléfono del tutor en menores"
```

---

### Task 7: Lecturas del modelo nuevo (Mis pacientes, dashboard, mensajes, calendario, estadísticas)

**Files:**
- Modify: `app/dashboard/pacientes/page.tsx` (líneas 25-58), `app/dashboard/pacientes/PacientesClient.tsx` (tipo `PacienteTableRow`, columna "Psicólogo" ~196)
- Modify: `app/dashboard/page.tsx` (líneas 125-135)
- Modify: `app/dashboard/mensajes-psicologo/page.tsx` (líneas 55-125)
- Modify: `app/dashboard/calendario/page.tsx` (líneas 78-130)
- Modify: `app/dashboard/psicologos/stats/page.tsx` (líneas 52-118 y usos de `personas`)

**Interfaces:**
- Consumes: `filtroPacientesDePsicologo`, `tiposDePaciente`, `ETIQUETA_TIPO` (Tarea 3); `AccionPsicologo.centro_id` (Tarea 2).

- [x] **Step 1: Mis pacientes** — sustituir el bloque `misPsicologoIds` por la ficha única:

```ts
  let miPsicologoId: string | null = null
  if (esPsicologo) {
    const ficha = user?.email ? psi.find((p) => p.email === user.email) : undefined
    miPsicologoId = ficha?.id ?? perfil?.psicologo_id ?? null
  }
  …
  if (esPsicologo) pacientesQuery = pacientesQuery.or(filtroPacientesDePsicologo(miPsicologoId ?? '00000000-0000-0000-0000-000000000000'))
```
y en `rows`: `psicologo_nombre` pasa a ser la lista `[['adulto', p.psicologo_adultos_id], ['pareja', p.psicologo_pareja_id], ['menor', p.psicologo_infantil_id]]` filtrada de nulos y formateada como `"${ETIQUETA_TIPO[t]}: ${psicologoMap[id] ?? '—'}"` unida por ` · `. `PacientesClient` no cambia de tipo (sigue siendo `string`); renombrar la cabecera de la columna a "Psicólogos".

- [x] **Step 2: Dashboard** — `psicologosData`: contar pacientes donde cualquiera de las tres columnas es `p.id`:

```ts
      count: pac.filter((pa) => pa.psicologo_adultos_id === p.id || pa.psicologo_pareja_id === p.id || pa.psicologo_infantil_id === p.id).length,
```
y en `tableData`, el nombre de psicólogo con el primer id no nulo.

- [x] **Step 3: Mensajes a pacientes** — `Variante` pasa a ser la ficha única: cargar `psicologos` por email (`maybeSingle`), luego `psicologos_centros` para obtener `centro_id[]`, y `centros` (con `google_review_url`) por esos ids. `setCentroId` al único si hay uno. Pacientes: `.or(filtroPacientesDePsicologo(ficha.id))` (dependencia del efecto: `ficha?.id`, no `centroId`).

- [x] **Step 4: Calendario** — en el `select` de citas añadir `centro_id`; en el mapeo `centroId: c.centro_id ?? null` (y para bloqueos `centroId: null`). Comprobar en `lib/calendario.ts` que el filtro por centro deja pasar los eventos con `centroId === null` cuando hay centro elegido solo si son bloqueos; si la función de filtro oculta `null`, ajustarla así y añadir un test en `lib/calendario.test.ts`:

```ts
it('un bloqueo sin centro se ve en cualquier filtro de centro', () => {
  const bloqueo = { ...evento, tipo: 'bloqueo' as const, centroId: null }
  expect(filtrarEventos([bloqueo], { centroId: 'c1', tipoCita: '', psicologoId: '' })).toHaveLength(1)
})
```
(adaptar `evento` y `filtrarEventos` a los nombres reales del módulo.)

- [x] **Step 5: Estadísticas** — eliminar el bloque "Agrupación por persona" (tipo `Persona`, `personaKey`, `personasMap`). El filtro por centro pasa a: `const idsEnCentro = selectedCentroId ? new Set((await supabase.from('psicologos_centros').select('psicologo_id').eq('centro_id', selectedCentroId)).data?.map((r) => r.psicologo_id) ?? []) : null` y `psicologos = idsEnCentro ? allPsicologos.filter((p) => idsEnCentro.has(p.id)) : allPsicologos`. `idsSeleccionados = selectedPsicologoId ? [selectedPsicologoId] : null`. La columna "Centro" de la tabla: nombres de `psicologos_centros` del psicólogo unidos por ` · ` (una consulta a `psicologos_centros` para todos). `perPsi` se indexa por `p.id`.

- [x] **Step 6: Type-check completo, tests y build**

Run: `cd somos-app && npx tsc --noEmit -p tsconfig.json && npm test && npm run build`
Expected: 0 errores, tests en verde, build OK. Si `tsc` señala más usos de `psicologo_id`/`centro_id` de psicólogo fuera de esta lista, corregirlos en este mismo paso (la salida guardada en la Tarea 2 sirve de guía).

- [x] **Step 7: Commit**

```bash
git add app/dashboard lib/calendario.ts lib/calendario.test.ts
git commit -m "Pantallas de lectura sobre el modelo nuevo: pacientes por tipo, ficha única, centro de la cita"
```

---

### Task 8: Make — cambios en el escenario y documento para Sonia

**Files:**
- Create: `z:\Claude\Somos Psicológos\docs\make-cambios-2026-09-26.md` (fuera del repo, junto a `make-cambios-2026-09-25.md`)

**Interfaces:**
- Consumes: campos nuevos del envío (`psicologo_id`, `centro_id`, `tipo_consulta`, `paciente_id`) de las tareas 5 y 6.

- [x] **Step 1: Escribir el documento con esta tabla** (misma estructura que el de 25-09):

| Módulo | Cambio |
|---|---|
| 3 (Buscar psicólogo) | Search criteria: `id` Equals `{{1.datosProcesados.psicologo_id}}` (quitar nombre y centro). Limit 1. |
| 14, 42, 98, 101, 105, 107, 226 (upserts de `acciones_psicologos`) | Añadir `centro_id = {{1.datosProcesados.centro_id}}`. |
| 41, 201, 204 (upserts de `pacientes`) | **Quitar** `psicologo_id` y `centro_id`. |
| 203, 202, 205, 212 y cualquier texto con `{{3.centro}}` | Sustituir por `{{1.respuestasFormulario.Selecciona tu centro}}`. |
| 1 (webhook) | "Redetermine data structure" + un envío desde la app con Make ya activo (o el payload de prueba con todos los campos). |
| Ejecución | Reactivar el escenario solo después de desplegar la app (Tarea 7) y recrear psicólogos (Tarea 10). |

Incluir la sección "Dante" de la Tarea 9 y la lista de pruebas de la Tarea 10.

- [ ] **Step 2: Aplicar en Make** (Sonia). Exportar el blueprint a `Make blueprints/Formulario Citas Psicologos.blueprint.json` al terminar.

- [ ] **Step 3: Verificar el blueprint exportado** con el script de revisión (ver sesión del 25-09) o a mano: módulo 3 busca por `id`; los siete upserts tienen `centro_id`; 41/201/204 no tienen `psicologo_id`. Sin referencias a módulos inexistentes.

---

### Task 9: Dante (n8n) — herramientas sobre el modelo nuevo

**Files:**
- Modify: `n8n/workflows/somos-main-agent.json` (nodos `ListarPsicologos`, `ConsultarPsicologo`, `ConsultarPaciente`, `RegistrarPaciente`, `EjecutarAccion`, prompt del `AI Agent`) — exportar primero el workflow vivo a `n8n/workflows/_backups/somos-main-agent-<fecha>.json`.

**Interfaces:**
- Consumes: vista `psicologos_por_centro`, columnas nuevas de `pacientes`, `evaluarDuplicado` (reimplementada en JS del nodo, misma tabla de reglas).

- [x] **Step 1: `ListarPsicologos`** — URL: `…/rest/v1/psicologos_por_centro?centro_id=eq.{centro_id}&activo=eq.true&select=id,nombre,centro,tipos_consulta&order=nombre.asc&apikey=…`. Descripción: añadir "devuelve tipos_consulta".

- [x] **Step 2: `ConsultarPsicologo`** — `select=id,nombre,activo,calendar_id,tipos_consulta` sobre `psicologos`; añadir una segunda llamada (o incluir en la descripción) a `psicologos_centros?psicologo_id=eq.{id}&select=centro_id`.

- [x] **Step 3: `ConsultarPaciente`** — `select` con `psicologo_adultos_id,psicologo_pareja_id,psicologo_infantil_id` en vez de `psicologo_id`. Descripción: "cada columna es el psicólogo de ese tipo; puede haber hasta tres".

- [x] **Step 4: `RegistrarPaciente`** (código del nodo) — parámetros nuevos `tipo_consulta` (`adulto|pareja`; `menor` se deduce por edad). Sustituir el bloque de duplicados por la misma tabla de reglas de `lib/pacientes-tipos.ts` (copiar `normalizarNombre` y `evaluarDuplicado` traducidas a JS sin tipos). En el insert: `[columna]: psicologoId` con `columna = { adulto: 'psicologo_adultos_id', pareja: 'psicologo_pareja_id', menor: 'psicologo_infantil_id' }[tipo]`; `telefono` = chat id (sin cambios). Comprobación de centro: `psicologos_centros?psicologo_id=eq.X&centro_id=eq.Y` debe devolver 1 fila (sustituye a `psico.centro_id !== centroId`). Envío a Make: añadir `psicologo_id`, `centro_id`, `tipo_consulta`. En el caso "confirmar" Dante no puede preguntar dentro del nodo: devolver `{ ok: false, necesita_confirmacion: true, paciente_existente: {...}, fuerza }` y que el prompt indique que pregunte al usuario y, si confirma, llame a la herramienta con `vincular_a: <paciente_id>` (el nodo entonces hace el `PATCH pacientes?id=eq.<id>` con la columna del tipo).

- [x] **Step 5: `EjecutarAccion`** — al agendar: `psicologoId` = columna de la ficha del paciente según `tipo_cita`; `centroId` = `pac.centro_id` si `psicologos_centros` tiene esa pareja, si no devolver `{ ok: false, error: 'Ese psicólogo no pasa consulta en el centro del paciente; pregunta el centro' }` y aceptar `centro_id` opcional como parámetro. Añadir `psicologo_id` y `centro_id` a `datosProcesados`.

- [x] **Step 6: Prompt** — párrafo nuevo: "Un paciente puede tener un psicólogo de adultos, otro de pareja y otro infantil. Para agendar, usa el que corresponda al tipo de cita. Las citas se hacen en el centro de la ficha del paciente salvo que el psicólogo no atienda allí."

- [ ] **Step 7: Importar el workflow en n8n**, activarlo y probar por Telegram: listar psicólogos de un centro, registrar paciente, agendar. Guardar el JSON final en `n8n/workflows/somos-main-agent.json`.

---

### Task 10: Recrear psicólogos de prueba, avisar a Elias y pruebas de aceptación

**Files:**
- Modify: `docs/make-cambios-2026-09-26.md` (anotar ids y resultados)

- [x] **Step 1: Desplegar la app** — PR de `modelo-pacientes-psicologos` a `main`, merge, comprobar el despliegue.

- [ ] **Step 2: Revisar los psicólogos reales** en `/dashboard/usuarios`: la migración los ha conservado con una sola ficha, nombre sin sufijo y centros fusionados. Completar `tipos_consulta` en los que hayan quedado vacíos y comprobar centros. Enviar a Elias la tabla de `migracion_014_ids` (`id_antiguo → id_nuevo`, solo las fichas fusionadas; el resto de ids no cambia) con la nota "cada aviso trae ahora `centro_id`". Crear psicólogos de prueba nuevos solo si hacen falta para las pruebas.

- [ ] **Step 3: Activar Make** (Tarea 8) y **Dante** (Tarea 9).

- [ ] **Step 4: Ejecutar las diez pruebas de aceptación del §9 de la especificación**, en orden, anotando resultado y hora en el documento. Verificación en Supabase desde el repo (ejemplo para la prueba 6):

```bash
cd somos-app && URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"\r') && KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"\r') && curl -s "$URL/rest/v1/acciones_psicologos?select=accion,tipo_cita,centro_id,psicologo_id,paciente_id,activo&order=creado_en.desc&limit=3" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: la última fila con `tipo_cita = "pareja"`, `centro_id` no nulo, `activo = true`. Y `SELECT status_code FROM net._http_response ORDER BY created DESC LIMIT 1;` → 202.

- [x] **Step 5: Cerrar** — actualizar la memoria del proyecto (estado: implementado, fecha) y `docs/roles-y-permisos.md` si menciona fichas por centro.

---

## Self-review (hecho al escribir el plan)

- **Cobertura de la especificación:** §3 modelo → Tarea 1 y 2; §4.1 → Tarea 4; §4.2-4.3 → Tarea 5; §4.4 y §5 → Tarea 3 y 6; §4.5-4.7 → Tarea 7; §6 → Tarea 8; §7 → Tarea 9; §8-9 → Tarea 10. §10 fuera de alcance: nada lo implementa.
- **Nombres consistentes:** `filtroPacientesDePsicologo`, `evaluarDuplicado`, `COLUMNA_PSICOLOGO`, `ETIQUETA_TIPO`, `tiposDisponibles`, `tiposDePaciente`, `PacienteExistente`, `DecisionDuplicado` se definen en la Tarea 3 y se usan con esos nombres en 4-7 y 9. Columnas `psicologo_adultos_id | psicologo_pareja_id | psicologo_infantil_id`, tabla `psicologos_centros`, vista `psicologos_por_centro`, `tipos_consulta`, `centro_id` iguales en SQL, tipos, app, Make y Dante.
- **Review Focus:** 1 → test "columnaOcupadaPor" (Tarea 3) y paso 3 de la Tarea 6; 2 → test `normalizarNombre`; 3 → test "misma fecha, otro nombre"; 4 → tests de `tiposDisponibles` y paso 5 de la Tarea 5; 5 → paso 4 de la Tarea 1 y paso 4 de la Tarea 7.
