# Roles y permisos de la app Somos Psicología

Última revisión: 25-09-2026.

## Una sola app

Desde septiembre de 2026 **solo se usa `somos-app`** (https://app.somospsicologos.es) para todo el
equipo: agentes internos, psicólogos y call center entran con su usuario y contraseña y ven
únicamente la parte que les corresponde según su rol. La app pública `citas-psicologos/`
(formulario turquesa sin login) queda **retirada** y no hay que mantenerla ni replicar cambios en ella.

## Dónde se define el rol

- Tabla `perfiles` en Supabase (migración `Supabase/migrations/004_perfiles_y_atribucion.sql`):
  una fila por usuario de Auth con `nombre`, `rol`, `psicologo_id` y `centro_id`.
- `rol` admite tres valores: `agente`, `psicologo`, `call_center`.
- Un usuario **sin fila en `perfiles` se trata como `agente`** (acceso total). Es así para que los
  logins antiguos sigan funcionando; conviene que todo usuario tenga su fila.
- Los usuarios se crean desde `/dashboard/usuarios` (solo agentes), eligiendo Psicólogo, Agente o
  Call center. Agentes y call center comparten ficha en la tabla `agentes`; lo que los distingue es
  el `rol` del perfil.

## Qué ve y qué puede hacer cada rol

| Pantalla | Ruta | Agente | Psicólogo | Call center |
|---|---|:-:|:-:|:-:|
| Panel General | `/dashboard` | Sí | No | Sí |
| Estadísticas | `/dashboard/psicologos/stats` | Sí | No | No |
| Pacientes | `/dashboard/pacientes` | Todos los pacientes | Solo los suyos (todas sus filas de psicólogo, por email) | No |
| Psicólogos (equipo) | `/dashboard/equipo` | Sí | No | No |
| Agentes | `/dashboard/agentes` | Sí | No | No |
| Usuarios (altas y accesos) | `/dashboard/usuarios` | Sí | No | No |
| Citas (formulario de agenda) | `/dashboard/psicologos` | Cualquier centro y psicólogo, todas las acciones | Fijado a su propia agenda | Cualquier centro y psicólogo, solo citas y altas de paciente |
| Comunicaciones (call center / avisos) | `/dashboard/mensajes` | Sí | No | No |
| Mensajes a pacientes (reseña Google, libre) | `/dashboard/mensajes-psicologo` | No | Sí | No |

### Agente

Equipo interno de Somos. Acceso completo a todas las pantallas y a las API de gestión de usuarios.
Es el único rol que puede crear, activar, desactivar y restablecer el acceso de otros usuarios.
En el formulario de Citas puede elegir cualquier centro y psicólogo y usar todas las acciones,
incluido Bloquear/Desbloquear agenda sin restricción.

### Psicólogo

Al entrar aterriza en Citas. Su centro y su psicólogo vienen fijados por el email del login
(si trabaja en varios centros, elige el centro y se recuerda en el navegador). Solo ve sus
pacientes y solo puede enviar mensajes a sus pacientes.

Matiz: las acciones **Bloquear agenda** y **Desbloquear agenda** solo aparecen si su ficha en
`psicologos` tiene `puede_bloquear = true` (se activa desde Usuarios). Vacaciones, asuntos propios,
baja y modificar bloqueo personal están siempre disponibles.

### Call center

Al entrar aterriza en Citas. Puede elegir **cualquier centro y cualquier psicólogo** y usar las
acciones **Agendar cita, Cambiar cita, Cancelar cita y Añadir nuevo paciente**. No ve las acciones
de bloqueo de agenda (bloquear, desbloquear, vacaciones, asuntos propios, baja, modificar bloqueo).
También puede abrir el Panel General. No ve pacientes, equipo, usuarios ni comunicaciones.

Cada cita que registra queda atribuida a su usuario (`created_by` con su nombre y
`origen = 'call_center'` en `acciones_psicologos`), así que conviene **un acceso por persona**.

#### Cuántos usuarios de call center pueden estar conectados a la vez

No hay límite. Supabase Auth no restringe las sesiones simultáneas por cuenta salvo que se active
la opción "Single session per user" en el panel de Auth (está desactivada), y la app no lleva
ningún contador de sesiones. Pueden entrar tantas personas como haga falta, tanto con cuentas
distintas como compartiendo una misma cuenta. La única pega de compartir cuenta es que todas las
citas saldrán con el mismo nombre.

## Cómo se aplica en el código

- Menú lateral: `app/dashboard/_components/SidebarNav.tsx` (lista `navItems` con `roles`).
- Redirección por rol: `app/dashboard/_components/RoleGate.tsx` (`isAllowed` + `HOME`).
- Lectura del perfil: `lib/perfil.ts`.
- Guardia de las API de usuarios: `lib/require-agente.ts` (devuelve 403 a psicólogos y call center).
- Filtro de pacientes y agenda fija: `app/dashboard/pacientes/page.tsx` y
  `app/dashboard/psicologos/page.tsx` (variables `esPsicologo` y `esCallCenter`).
- Alta y listado por tipo: `app/api/usuarios/route.ts` (el GET separa `agentes` y `call_center`
  cruzando `agentes.auth_user_id` con `perfiles.rol`).
- Sesión obligatoria en `/dashboard/*`: `proxy.ts`.

## Aviso de seguridad

El control por rol está en la interfaz y en las API de la app. Las políticas RLS de Supabase siguen
abiertas para el resto de tablas (solo `perfiles` limita la lectura a la propia fila), así que un
usuario con la anon key y sesión podría leer datos por fuera de la app. Está pendiente de cerrar.

Para añadir un rol nuevo o cambiar permisos: ampliar `Rol` en `types/database.ts`, el CHECK de
`perfiles.rol` en Supabase, `navItems` en SidebarNav, `isAllowed`/`HOME` en RoleGate y, si aplica,
`require-agente.ts` y la pantalla de Usuarios.
