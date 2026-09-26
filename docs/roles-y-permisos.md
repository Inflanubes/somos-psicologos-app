# Roles y permisos de la app Somos Psicología

Última revisión: 26-09-2026 (horarios de psicólogos, medias horas y disponibilidad en Citas).

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
| Panel General | `/dashboard` | Sí (datos globales) | No | Sí, pero solo **su actividad** ("Mi actividad") |
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

#### Restablecer la contraseña de un usuario (psicólogo, agente o call center)

Cuando alguien olvida su contraseña, un agente puede restablecerla desde dos sitios:

- **Usuarios** (`/dashboard/usuarios`): en cada fila de psicólogo, agente o call center.
- **Agentes** (`/dashboard/agentes`): en cada fila de agente (añadido el 25-09-2026, antes solo se podía activar/desactivar).

En ambos hay los mismos dos botones, que llaman a `POST /api/usuarios/[id]`:

| Botón | Qué hace | Cuándo usarlo |
|---|---|---|
| **Enviar acceso** | Supabase envía al email del usuario un enlace para crear una contraseña nueva. La actual sigue funcionando hasta que la cambie. | Lo normal. El usuario se la pone él mismo. |
| **Generar contraseña** | Crea una contraseña temporal y la muestra en pantalla una sola vez (con botón Copiar). La anterior deja de funcionar. | Si el email no le llega o hay prisa. Hay que entregársela a mano. |

Los botones se desactivan si la ficha no tiene cuenta de acceso (`auth_user_id` vacío); en ese caso hay que
crear el usuario desde Usuarios. Ojo con las personas que tienen dos fichas (una de agente y otra de call center):
cada ficha tiene su propia cuenta y su propio email.

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
En el Panel General ve **solo su propia actividad** ("Mi actividad", componente `PanelCallCenter`): citas agendadas, cambiadas y canceladas y pacientes añadidos por él, con filtro hoy / esta semana / este mes, gráfico de citas por día, reparto por centro y psicólogo y sus últimas acciones. Nunca ve los datos globales de la clínica ni la tabla de pacientes. No ve pacientes, equipo, usuarios ni comunicaciones.

Cada cita que registra queda atribuida a su usuario (`created_by` con su nombre y
`origen = 'call_center'` en `acciones_psicologos`), así que conviene **un acceso por persona**.

## Quién ha añadido cada paciente

Desde la migración `Supabase/migrations/011_pacientes_atribucion.sql`, la tabla `pacientes` guarda
`created_by` (nombre), `created_by_id` (usuario de Auth) y `origen` (`psicologo` | `agente` | `call_center`)
de quien dio de alta al paciente desde el formulario de Citas. La pantalla de Pacientes muestra la
columna **Añadido por** con ese dato, así se sabe si un paciente lo añadió un psicólogo concreto, un
agente o el call center. Los pacientes anteriores a la migración quedan sin dato. Si la migración
no se ha ejecutado, el alta sigue funcionando (reintenta sin atribución) y el panel del call center
muestra "—" en Pacientes añadidos.

#### Cuántos usuarios de call center pueden estar conectados a la vez

No hay límite. Supabase Auth no restringe las sesiones simultáneas por cuenta salvo que se active
la opción "Single session per user" en el panel de Auth (está desactivada), y la app no lleva
ningún contador de sesiones. Pueden entrar tantas personas como haga falta, tanto con cuentas
distintas como compartiendo una misma cuenta. La única pega de compartir cuenta es que todas las
citas saldrán con el mismo nombre.

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
