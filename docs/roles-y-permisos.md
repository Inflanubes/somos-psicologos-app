# Roles y permisos de la app Somos Psicología

Última revisión: 28-09-2026 (psicólogos desactivados en Citas y Dante).

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
| Calendario (agenda semanal de todos) | `/dashboard/calendario` | Sí | No | Sí (página de entrada) |
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

Al entrar aterriza en **Calendario**. En Citas puede elegir **cualquier centro y cualquier psicólogo** y usar las
acciones **Agendar cita, Cambiar cita, Cancelar cita y Añadir nuevo paciente**. No ve las acciones
de bloqueo de agenda (bloquear, desbloquear, vacaciones, asuntos propios, baja, modificar bloqueo).
En el Panel General ve **solo su propia actividad** ("Mi actividad", componente `PanelCallCenter`): citas agendadas, cambiadas y canceladas y pacientes añadidos por él, con filtro hoy / esta semana / este mes, gráfico de citas por día, reparto por centro y psicólogo y sus últimas acciones. Nunca ve los datos globales de la clínica ni la tabla de pacientes. No ve pacientes, equipo, usuarios ni comunicaciones.

Cada cita que registra queda atribuida a su usuario (`created_by` con su nombre y
`origen = 'call_center'` en `acciones_psicologos`), así que conviene **un acceso por persona**.

En **Calendario** ve la agenda semanal de todos los psicólogos: cada cita activa aparece como un bloque
de una hora con el color de su centro, el nombre del psicólogo, las **iniciales** del paciente (nunca el
nombre) y el tipo de cita; los bloqueos (vacaciones, asuntos propios, baja, bloqueo) ocupan la fila "Día".
Se filtra por centro, tipo de cita y psicólogo; al filtrar por un psicólogo se sombrean sus horas de
trabajo según el horario definido en Usuarios. Solo se ve lo gestionado desde la app: lo que un psicólogo
apunte a mano en Google Calendar no aparece. El filtro por tipo de cita depende de que Make guarde
`tipo_cita` al agendar (hecho desde el 26-09-2026; ver `docs/make-cambios-2026-09-25.md`, apartado F,
fuera del repo).

## Psicólogos desactivados

Desactivar un psicólogo (`psicologos.activo = false`, desde Usuarios o Psicólogos) no le quita el acceso.
Desde el 28-09-2026 el formulario de Citas trata así a un psicólogo desactivado:

| Quién | ¿Lo puede elegir? | Citas y bloqueos | Añadir nuevo paciente |
|---|:-:|:-:|:-:|
| Agente | Sí, aparece como "Nombre (inactivo)" | Sí | Sí |
| El propio psicólogo | Entra en su agenda como siempre | Sí | **No** (la acción no aparece y se rechaza al enviar) |
| Call center | No, no aparece en el desplegable | No | No |
| Dante | No sale en `ListarPsicologos`; `EjecutarAccion` y `RegistrarPaciente` lo rechazan | No, deriva al equipo | No |

El Calendario sigue mostrando solo psicólogos activos en su filtro (decisión del 28-09-2026). Si en algún
momento deben seguir apareciendo sus citas ahí, hay que cambiar `app/dashboard/calendario/page.tsx`.

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

Desde la migración `Supabase/migrations/014_modelo_pacientes_psicologos.sql` (28-09-2026) cada
psicólogo es **una sola ficha** en `psicologos`, con sus centros en `psicologos_centros` y sus tipos
de consulta en `psicologos.tipos_consulta` (`adulto`, `pareja`, `menor`). Su horario semanal está en
`horarios_psicologos` (día de la semana y uno o varios tramos) y vale para todos sus centros; el
permiso `psicologos.citas_media_hora` (citas a y media) también es de la ficha. Un psicólogo con
varios centros elige en Citas en cuál está hoy (se recuerda en el navegador).

- Los **agentes** lo gestionan en Usuarios: columna **Horarios** (resumen tipo `L, X 09:00–14:00 · V 16:00–20:00`),
  botón **Horario** (editor de siete días), botón **30'** (medias horas), y botones **Centros** y
  **Tipos** (panel con casillas bajo la fila). Nadie más puede editarlo.
- Una ficha **sin horario** no restringe nada: solo se ocultan las horas ya ocupadas. Una ficha **sin
  tipos de consulta** ofrece los tres tipos en Citas (y así se ve en Usuarios, en rojo, para completarla).
- Toda cita dura **60 minutos**. Se ofrecen las horas de 08:00 a 21:00 en punto y, si la persona tiene 30',
  también las y media hasta 21:30.
- En Citas (Agendar y Cambiar cita):
  - **Psicólogo y call center** solo ven los huecos libres: dentro del horario del psicólogo,
    sin cita activa que se solape (en cualquiera de sus centros, porque comparten calendario) y sin
    bloqueo de agenda ese día. Si el día no es laborable o está bloqueado, el selector de hora se desactiva y
    se explica el motivo.
  - **Agente** puede elegir cualquier fecha y hora fuera del horario, en una media hora no activa o en un día
    con bloqueo de agenda: ve un aviso ámbar encima del botón de enviar y puede continuar. Lo que **nadie** puede
    hacer, tampoco el agente, es agendar sobre una hora que ya tiene cita: esa hora aparece atenuada como
    "10:00 · ocupada" y no se puede elegir (un psicólogo no atiende a dos pacientes a la vez).
  - **Fecha y hora son obligatorias** al agendar o cambiar una cita (antes del 26-09-2026 se podía enviar sin ellas).
  - Si la app no consigue consultar la disponibilidad (fallo de base de datos), psicólogo y call center ven el
    selector de hora desactivado con el texto "Ahora mismo no podemos consultar la disponibilidad. Contacta con
    nosotros para agendar esta cita." y no pueden enviar; el agente ve todas las horas sin avisos y puede seguir.
  - El formulario carga el horario y las citas del psicólogo al elegirlo. Si se cambia el horario en Usuarios con
    Citas ya abierto, hay que recargar Citas para que lo tenga en cuenta.
- Lógica: `lib/horarios.ts` (tramos, validación, resumen), `lib/disponibilidad.ts` (huecos y avisos; con tests
  en `npm test`), `lib/disponibilidad-datos.ts` (carga desde Supabase) y `app/dashboard/psicologos/useDisponibilidad.ts`.
- Make no interviene: el horario solo lo lee la app.


## Pacientes con varios psicólogos y alta de paciente (migración 014)

- Un paciente tiene hasta tres psicólogos, uno por tipo de consulta: `psicologo_adultos_id`,
  `psicologo_pareja_id` y `psicologo_infantil_id` (al menos uno relleno). `pacientes.centro_id` es el
  centro del alta y no decide nada. Cada cita guarda su centro en `acciones_psicologos.centro_id`
  (lo envía la app o Dante y lo escribe Make); los bloqueos no tienen centro y se ven en todos los
  filtros del Calendario.
- **Mis pacientes**, el panel general, Mensajes y el desplegable de Citas muestran al psicólogo los
  pacientes en los que aparece en cualquiera de las tres columnas; la columna "Psicólogos" indica el
  tipo ("Adultos: Marta · Pareja: Juan").
- **Alta de paciente** (Citas › Añadir nuevo paciente): nombre, fecha de nacimiento (obligatoria) y
  correo. Si tiene 15 años o menos es **menor**: no se pide teléfono (el contacto es el del tutor 1,
  que se copia a `pacientes.telefono`), se piden los tutores y cada tutor tiene el botón **Ya es
  paciente** para buscar su ficha y copiar sus datos (`asociados_menores.T1_paciente_id` /
  `T2_paciente_id`). Si es adulto: teléfono obligatorio y selector **Tipo de consulta** (adultos o
  pareja, solo los que el psicólogo pasa).
- **Duplicados**: menor con mismo nombre y misma fecha, o adulto con mismo teléfono y mismo nombre →
  bloqueo ("Este paciente ya existe. Revisa los datos…") y aviso al equipo por Make. Adulto con el
  mismo teléfono y otro nombre → pregunta "¿Es la misma persona?": **Sí** vincula la ficha existente
  (rellena la columna del tipo; si ya tenía otro psicólogo de ese tipo, avisa y lo sustituye), **No**
  crea ficha nueva. Los nombres se comparan sin tildes, mayúsculas ni espacios de más.
- **Tipo de cita** en Agendar/Cambiar: solo los tipos que el psicólogo pasa (menor → solo `menor`);
  con un único tipo posible se preselecciona.

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
- Calendario: `app/dashboard/calendario/page.tsx` (datos y filtros), `app/dashboard/calendario/AgendaSemanal.tsx`
  (rejilla) y `lib/calendario.ts` (fechas, filas, filtros, colores; con tests).

## Aviso de seguridad

El control por rol está en la interfaz y en las API de la app. Las políticas RLS de Supabase siguen
abiertas para el resto de tablas (solo `perfiles` limita la lectura a la propia fila), así que un
usuario con la anon key y sesión podría leer datos por fuera de la app. Está pendiente de cerrar.

Para añadir un rol nuevo o cambiar permisos: ampliar `Rol` en `types/database.ts`, el CHECK de
`perfiles.rol` en Supabase, `navItems` en SidebarNav, `isAllowed`/`HOME` en RoleGate y, si aplica,
`require-agente.ts` y la pantalla de Usuarios.
