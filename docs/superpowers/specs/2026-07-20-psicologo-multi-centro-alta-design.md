# Alta de psicólogo con varios centros

Fecha: 2026-07-20

## Problema

Un psicólogo puede trabajar en dos centros compartiendo el mismo calendario de Google.
El modelo de datos ya lo soporta (una fila en `psicologos` por persona × centro), pero el
formulario de alta en `/dashboard/usuarios` solo crea **una** fila. Las filas adicionales
había que crearlas a mano en Supabase.

## Modelo de datos: sin cambios

Se mantiene una fila en `psicologos` por (persona × centro):

- mismo `nombre`, mismo `email`, mismo `calendar_id`
- distinto `centro_id` y distinto `centro` (texto)

Es lo que asume Make, que busca al psicólogo por **nombre + centro (texto)**, y lo que el
resto de la app ya resuelve por email (`app/dashboard/psicologos/page.tsx`,
`app/dashboard/pacientes/page.tsx`). No hay migración SQL.

## Cambios

### 1. Formulario (`app/dashboard/usuarios/page.tsx`)

Para tipo **psicólogo**, el `<select>` de centro se sustituye por una lista de checkboxes
(mínimo un centro marcado). Para tipo **agente** sigue siendo un select de un solo centro.
El campo `calendar_id` sigue siendo único y se copia igual a todas las filas.

### 2. API POST (`app/api/usuarios/route.ts`)

El body acepta `centro_ids: string[]` además de `centro_id` (compatibilidad).

- Se resuelven los nombres de todos los centros en una sola consulta (`.in('id', ids)`).
- Un único `insert` con N filas, cada una con su `centro_id` + `centro` texto y el mismo
  `nombre` / `email` / `telefono` / `calendar_id` / `activo: true`.
- `perfiles` se crea **una sola vez**, apuntando al `psicologo_id` y `centro_id` de la
  primera fila (el primer centro marcado). El selector "Cambiar de centro" y la pantalla de
  Pacientes resuelven las demás filas por email.
- Rollback: si falla el insert de psicólogos o el de perfiles, se borran **todas** las filas
  creadas (`.in('id', ids)`) y el usuario de auth.

### 3. Tabla de psicólogos

Sin cambios: sigue mostrando una fila por centro. Es coherente con el filtro por centro.

## Validación

- Psicólogo: al menos un centro. Los duplicados se ignoran.
- Si algún `centro_id` no existe en `centros`, error 400. (Antes se guardaba `centro` a
  `null` en silencio y Make no encontraba al psicólogo.)

## Riesgos

Ninguno para Make: cada fila queda idéntica a las que hoy se crean a mano. Las estadísticas
por centro cuentan a la persona una vez por centro, que ya es el comportamiento actual.
