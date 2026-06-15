# Diseño — Módulo de administración de usuarios

**Fecha:** 2026-06-15
**Estado:** Aprobado (pendiente de plan de implementación)
**App:** `somos-app` (Next.js 14 App Router + Supabase)

## Problema

Crear un nuevo psicólogo o agente hoy requiere 3 pasos manuales y desconectados
(crear cuenta en Auth, insertar fila en `psicologos`/`agentes`, insertar fila en
`perfiles`). Olvidar el paso de `perfiles` provoca un bug de atribución: la acción
se atribuye al psicólogo seleccionado en vez de al agente que la realiza, porque
`getPerfilActual()` devuelve `null` y el código cae al nombre del psicólogo.
Además, al alta de un psicólogo hay que registrar su `calendar_id` (el ID del
calendario de Google que usa la automatización de Make), cosa que hoy implica
editar datos a mano.

Se quiere un único sitio para crear accesos, reenviar contraseñas y editar datos
de psicólogos y agentes, sin trabajo doble y sin que nadie se quede "a medias".

## Decisiones acordadas

1. **Psicólogo = registro + calendario + login, siempre juntos.** No hay psicólogos
   "solo calendario" sin cuenta.
2. **Un solo rol por persona.** Cada cuenta es agente *o* psicólogo, nunca ambos.
   Quien necesite ambos usaría dos cuentas/emails distintos.
3. **Acceso al módulo: todos los agentes** (`rol = 'agente'`).
4. **Contraseña por invitación email** (`inviteUserByEmail`); el envío de email ya
   está configurado en Supabase.
5. **Baja = desactivar** (`activo = false`), nunca borrado. Por ahora desactivar
   solo lo quita de los selectores; el login NO se bloquea (decisión revisable).
6. **El email de login NO se edita** desde este módulo (operación delicada → queda
   para el dashboard de Supabase si hiciera falta).

## Modelo de datos relevante

- `auth.users` — email + contraseña (el login real). Única fuente de credenciales.
- `perfiles` — `id` (= auth user id, PK), `nombre`, `rol`, `psicologo_id`, `centro_id`.
  De aquí lee la atribución (`created_by`, `created_by_id`, `origen`).
- `psicologos` — `id`, `nombre`, `centro_id`, `activo`, `telefono`, `calendar_id`, `email`.
- `agentes` — `id`, `nombre`, `telefono`, `activo`, `centro_id`, `auth_user_id`, `email`.
- `centros` — `id`, `nombre`.

## Arquitectura (Enfoque elegido: módulo dentro de la app Next.js)

```
app/dashboard/usuarios/page.tsx   UI cliente: lista + crear/editar/desactivar/reenviar
app/api/usuarios/route.ts         GET listar, POST crear            (servidor, service_role)
app/api/usuarios/[id]/route.ts    PATCH editar, PATCH desactivar, POST reset password
lib/supabase-admin.ts             cliente Supabase con service_role (SOLO servidor)
```

- La página es un componente cliente; **nunca** accede a la `service_role`. Solo hace
  `fetch` a `/api/usuarios`.
- Toda operación privilegiada (crear auth user, invitar, resetear, borrar en limpieza)
  ocurre en los Route Handlers del servidor.
- `lib/supabase-admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY` (ya presente en `.env`),
  con comentario explícito de "solo servidor".
- Enlace "Usuarios" en el menú del dashboard, visible solo si el perfil en sesión
  es `agente`.

### Control de acceso (doble capa)

1. `middleware.ts` ya exige sesión para `/dashboard/*`.
2. Cada Route Handler de `/api/usuarios` verifica **en el servidor** que el usuario
   en sesión tiene `rol = 'agente'` en `perfiles`. Si no, responde `403`, aunque se
   llame a la URL directamente.

## Flujos

### Alta de psicólogo
Campos del formulario: `nombre`, `email`, `telefono`, `centro` (selector de `centros`),
`calendar_id`, `activo` (true por defecto).

Pasos en el servidor (en orden):
1. `auth.admin.inviteUserByEmail(email)` → crea la cuenta y envía el email para fijar
   contraseña. Devuelve `user_id`.
2. `insert` en `psicologos` (`nombre`, `email`, `telefono`, `centro_id`, `calendar_id`, `activo`).
3. `insert` en `perfiles`: `{ id: user_id, nombre, rol: 'psicologo', psicologo_id, centro_id }`.

### Alta de agente
Campos: `nombre`, `email`, `telefono`, `centro` (opcional).

Pasos: invitar por email → `insert` en `agentes` (con `auth_user_id`) → `insert` en
`perfiles` con `rol: 'agente'` (`psicologo_id` null).

### Edición de existentes
- Psicólogo: `nombre`, `telefono`, `email` (de la tabla `psicologos`, no el de login),
  `centro`, `calendar_id`, `activo`. El `nombre` se actualiza también en `perfiles`
  para mantener coherente la atribución.
- Agente: `nombre`, `telefono`, `centro`, `activo`; `nombre` también en `perfiles`.
- El email de login NO se edita aquí.

### Reset de contraseña
Botón "Reenviar acceso" → el servidor envía el email de recuperación de Supabase.

### Baja (desactivar)
Botón "Desactivar" → `activo = false` en `psicologos`/`agentes`. Desaparece de
selectores y de la app; el historial se conserva. El login no se bloquea (por ahora).

## Control de errores

El alta son llamadas separadas (Auth + tablas), no una transacción única, así que el
servidor hace **limpieza automática** para que no queden huérfanos:

- Si falla el paso 2 (insert registro) → borrar la cuenta auth recién creada.
- Si falla el paso 3 (insert perfiles) → borrar el registro insertado **y** la cuenta auth.
- Resultado: o se crean las 3 filas o no queda nada. El error se devuelve claro a la UI.

Otros casos:
- **Email ya existe** → mensaje "Ya hay un usuario con ese email", sin crear nada.
- **Campos obligatorios**: `nombre`, `email`, y `calendar_id` (solo psicólogo).
  Validación en formulario y de nuevo en el servidor.
- **Sin permiso** (no agente) → `403`.

## Pruebas

1. Crear psicólogo de prueba → verificar las 3 filas (auth, `psicologos`, `perfiles`)
   y que llega el email de invitación.
2. Provocar fallo en el paso 3 → verificar que NO queda cuenta auth huérfana.
3. Editar `calendar_id` y `nombre` → verificar que el nombre también cambia en `perfiles`.
4. Desactivar → verificar que desaparece de selectores y el historial se mantiene.
5. Reenviar acceso → verificar que llega el email de reset.
6. Llamar a `/api/usuarios` como psicólogo (no agente) → verificar `403`.

## Fuera de alcance (YAGNI)

- Multi-rol (una persona como agente y psicólogo a la vez).
- Borrado físico de usuarios.
- Bloqueo de login al desactivar (revisable más adelante).
- Edición del email de login.
