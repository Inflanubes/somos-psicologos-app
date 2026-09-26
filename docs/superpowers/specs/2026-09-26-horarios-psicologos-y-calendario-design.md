# Horarios de psicólogos, reglas de disponibilidad en Citas y calendario del call center

Fecha: 2026-09-26

## Problema

Hoy la app no sabe cuándo trabaja cada psicólogo en cada centro. Al agendar una cita se
puede elegir cualquier fecha y cualquier hora entre 08:00 y 21:30, aunque el psicólogo no
esté ese día en ese centro o ya tenga otra cita a esa hora. El call center agenda a ciegas
y descubre los errores cuando Make o el psicólogo avisan.

Se quiere:

1. Que los agentes definan, desde Usuarios, el **horario semanal de cada psicólogo en cada
   centro** y si ese psicólogo admite **citas a las medias horas**.
2. Que en Citas, psicólogos y call center **solo puedan elegir huecos reales** (dentro del
   horario y no ocupados). Los agentes pueden elegir cualquier cosa, pero ven un **aviso**
   antes de enviar si se salen de las reglas.
3. Una pestaña **Calendario** para call center (y agentes) con las citas y bloqueos de todos
   los psicólogos, filtrable por centro, tipo de cita y psicólogo, que sea la página de
   entrada del call center.

Se entrega en dos fases. La fase 1 (puntos 1 y 2) es útil por sí sola; la fase 2 (punto 3)
se apoya en los mismos datos.

## Decisiones tomadas con Sonia (26-09-2026)

- Horario **semanal fijo**: días de la semana con uno o varios tramos por día y centro
  (ejemplo: lunes y miércoles de 09:00 a 14:00). No hay semanas alternas.
- Toda cita dura **60 minutos**, sea del tipo que sea.
- Las medias horas (10:30, 11:30...) solo se ofrecen a los psicólogos que las tengan
  activadas. Por defecto nadie las tiene. Se activa con un botón **30'** en Usuarios.
- El selector de hora oculta las horas **fuera de horario** y las **ya ocupadas** (cita
  activa o bloqueo).
- En el calendario, cada cita muestra **psicólogo, hora, tipo de cita e iniciales del
  paciente**. Nunca el nombre completo.
- Vista de calendario: **agenda semanal** con citas y bloqueos. La rejilla de "cuántos
  psicólogos libres hay a cada hora" queda para más adelante.
- Ficha sin horario definido: se trata como **sin restricción de horario** (solo se ocultan
  las horas ocupadas). Así no se bloquea a nadie mientras se rellenan los horarios.

## Modelo de datos (migración `Supabase/migrations/012_horarios_psicologos.sql`)

### Tabla nueva `horarios_psicologos`

Una fila por ficha de psicólogo, día de la semana y tramo horario.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | `gen_random_uuid()` |
| `psicologo_id` | uuid, FK `psicologos.id` ON DELETE CASCADE | La ficha ya es por centro, así que el centro va implícito |
| `dia_semana` | smallint, CHECK 1..7 | 1 = lunes … 7 = domingo (ISO) |
| `hora_inicio` | time | Solo en punto o y media |
| `hora_fin` | time | CHECK `hora_fin > hora_inicio` |
| `creado_en` | timestamptz, default now() | |

Índice en `psicologo_id`. Sin restricción de solapamiento en SQL: la valida la API al guardar.

RLS: se deja como en el resto de tablas (abierta con sesión), coherente con la situación
actual documentada en `docs/roles-y-permisos.md`. Se anota en la deuda de seguridad pendiente.

### Columna nueva en `psicologos`

`citas_media_hora boolean NOT NULL DEFAULT false`. `true` = puede recibir citas a y media.
Como `puede_bloquear`, es un permiso de la **persona**: al cambiarlo se aplica a todas las
fichas con el mismo email.

### Tipos (`types/database.ts`)

- `HorarioPsicologo` y `HorarioPsicologoInsert`, y la tabla en `Database`.
- `Psicologo.citas_media_hora: boolean | null` y en `PsicologoInsert`.

### Sin cambios en Make ni en el aviso a Elias

El horario y el permiso de medias horas solo los lee la app. No se envían al webhook.

## Fase 1A: editor de horarios en Usuarios

### Lectura

`GET /api/usuarios` devuelve, para cada psicólogo, `citas_media_hora` y `horarios`
(array de `{ dia_semana, hora_inicio, hora_fin }` ordenado por día y hora). Se obtiene con
una consulta más a `horarios_psicologos` y se agrupa por `psicologo_id` en el servidor.

### Tabla de psicólogos

- Columna nueva **Horarios** entre Centro y Email, con un resumen compacto por ficha:
  `L, X 09:00–14:00 · V 16:00–20:00`. Los días se agrupan cuando comparten exactamente los
  mismos tramos. Sin filas: `Sin horario` en gris.
- En la columna Estado, debajo de "Puede bloquear agenda", una línea
  `✓ Citas a y media` / `Solo en punto`.
- En la fila de acciones, dos botones nuevos:
  - **Horario**: abre el editor.
  - **30'**: alterna `citas_media_hora` (variante `success` si está apagado, `default` si
    está encendido, como el botón de bloqueo). Título: "Permitir o quitar citas a las medias
    horas para este psicólogo".

### Editor de horario

Panel modal (misma estética de tarjeta blanca, borde y radio 12) con el nombre del
psicólogo y el centro en el título. Siete filas, de lunes a domingo. Cada fila tiene una
lista de tramos; cada tramo son dos selectores de hora (08:00 a 22:00 en pasos de 30
minutos) y un botón "Quitar". Botón "Añadir tramo" por día. Botones Guardar y Cancelar.

Validación en el cliente antes de guardar y en el servidor:

- `hora_fin > hora_inicio`.
- Tramos del mismo día sin solapamiento.
- Mensajes en español en el mismo cuadro rojo de error de la página.

Guardar llama a `PATCH /api/usuarios/[id]` con
`{ tipo: 'psicologo', horarios: [{ dia_semana, hora_inicio, hora_fin }] }`.
El servidor **borra las filas de esa ficha e inserta las nuevas**. Si el insert falla, se
reintenta insertar las filas anteriores y se devuelve error 500 con mensaje. Es aceptable:
el editor lo usa un solo agente a la vez y el volumen es mínimo.

El botón 30' llama al mismo PATCH con `{ tipo: 'psicologo', citas_media_hora: boolean }`,
que se aplica a todas las fichas con el mismo email (igual que `puede_bloquear`).

Solo agentes: la API ya lo garantiza con `requireAgente`.

## Fase 1B: reglas de disponibilidad en Citas

### Módulo puro `lib/disponibilidad.ts`

Sin dependencias de React ni de Supabase, para poder probarlo con tests unitarios.

```ts
type Tramo = { dia_semana: number; hora_inicio: string; hora_fin: string }   // 'HH:MM' o 'HH:MM:SS'
type CitaOcupada = { fecha: string; hora: string; accionId?: string }        // 'YYYY-MM-DD', 'HH:MM[:SS]'
type Bloqueo = { inicio: string; fin: string }                               // días completos, ambos incluidos

type EstadoHueco = 'libre' | 'ocupado' | 'fuera_horario' | 'media_hora'
type Hueco = { hora: string; estado: EstadoHueco }   // hora 'HH:MM'

type ParamsHuecos = {
  tramos: Tramo[]            // horario de la ficha (vacío = sin restricción)
  citas: CitaOcupada[]       // citas activas de la persona (todas sus fichas)
  bloqueos: Bloqueo[]        // bloqueos activos de la persona
  fecha: string
  mediaHora: boolean         // citas_media_hora de la ficha
  incluirMedias: boolean     // true en modo aviso (agente): lista las y media aunque no estén activas
  excluirAccionId?: string   // al cambiar una cita, su propia fila no ocupa
}

function diaSemanaISO(fecha: string): number                       // 1..7
function diaBloqueado(bloqueos: Bloqueo[], fecha: string): Bloqueo | null
function trabajaEseDia(tramos: Tramo[], fecha: string): boolean    // true si no hay tramos (sin restricción)
function generarHuecos(params: ParamsHuecos): Hueco[]
// Texto en español del aviso para agentes, o null si la fecha y la hora son válidas.
function motivoAviso(params: ParamsHuecos & {
  hora: string
  nombrePsicologo: string
  nombreCentro: string
}): string | null
```

Reglas de `generarHuecos`:

- Se generan las horas de 08:00 a 21:00 en punto y, si `mediaHora` o `incluirMedias`,
  también las y media (hasta 21:30). Es la misma franja que hoy ofrece `TimeSelect`.
- Estado `media_hora` si la hora es y media y `mediaHora` es falso (solo puede darse con
  `incluirMedias`).
- Estado `fuera_horario` si hay tramos y la cita (hora, hora + 60 min) no cabe entera en
  algún tramo del día. Sin tramos, nunca es fuera de horario.
- Estado `ocupado` si el día está bloqueado o si alguna cita activa (excluida la que se
  está cambiando) se solapa con (hora, hora + 60 min). Una cita a las 10:30 ocupa 10:00 y
  11:00 en un psicólogo con medias horas; una cita a las 10:00 ocupa 10:00 y, si hay
  medias, también 09:30 y 10:30.
- Prioridad cuando coinciden varios: `ocupado` > `fuera_horario` > `media_hora`.

### Datos que carga el formulario al elegir psicólogo

Al cambiar la ficha seleccionada (`effPsicologoId`) se cargan en paralelo:

1. Sus tramos: `horarios_psicologos` por `psicologo_id`.
2. Las fichas de la misma persona: `psicologos` con el mismo `calendar_id` (si es nulo, solo
   la propia). Comparten calendario, así que una cita en un centro ocupa a la persona en
   todos.
3. Citas activas de esas fichas: `acciones_psicologos` con `accion = 'Agendar cita'`,
   `activo = true`, `fecha_cita >= hoy`, seleccionando `id, fecha_cita, hora_cita`.
4. Bloqueos activos de esas fichas: `accion = 'Bloquear agenda'`, `activo = true`,
   `fecha_bloqueo_fin >= hoy` o nula. Los bloqueos son rangos de días completos.

Estos datos se guardan en estado del formulario y se recalculan los huecos al cambiar la
fecha. Mientras cargan, el selector de hora muestra "Cargando disponibilidad…" y queda
desactivado. Si la carga falla, se aplica el modo sin restricción y se muestra el error
habitual de la página.

### Comportamiento en Agendar cita y Cambiar cita

Se aplica a los campos "Fecha de cita" / "Nueva fecha" y "Hora de cita" / "Nueva hora". Los
campos de bloqueo (fecha y hora de inicio de un bloqueo) no cambian.

`TimeSelect` recibe una prop opcional `opciones: Hueco[]`. Sin ella se comporta como hoy
(para los bloqueos). Con ella:

- Modo **restringido** (psicólogo y call center): solo lista los huecos `libre`. Si la fecha
  no es laborable o está bloqueada, el selector se desactiva y debajo se lee el motivo:
  "Marta no trabaja los martes en San Blas" o "Agenda bloqueada ese día (Vacaciones)".
  Si es laborable pero no queda ningún hueco: "No quedan huecos libres ese día".
  El campo fecha lleva `min = hoy`.
- Modo **aviso** (agente): lista todos los huecos, marcando los no libres con un sufijo en
  la opción: `11:00 · ocupada`, `16:00 · fuera de horario`, `10:30 · media hora no activa`.
  Si el día no es laborable o está bloqueado, el selector sigue activo con todas las horas.
  Cuando la fecha u hora elegidas no son `libre`, aparece un **aviso ámbar** justo encima
  del botón de enviar con el motivo, por ejemplo:
  "Aviso: Marta no trabaja los martes en San Blas. Puedes agendar igualmente."
  El aviso no bloquea el envío.
- Un valor antiguo fuera de la rejilla (citas a las 17:15) sigue mostrándose seleccionado,
  como ahora.

El modo se decide con `perfil.rol`: `agente` → aviso; `psicologo` y `call_center` →
restringido.

Al cambiar una cita, `excluirAccionId` es el `id` de la cita elegida en el selector de
eventos (`eventoActual.id`), para que su hora actual cuente como libre.

### Lo que no cambia

- El envío al webhook y el registro en `formulario_citas_psicologos` son idénticos.
- Make sigue siendo quien escribe en `acciones_psicologos`.
- Las acciones de bloqueo no consultan la disponibilidad.

## Fase 2: pestaña Calendario

### Ruta y roles

- Página `app/dashboard/calendario/page.tsx` (cliente), con `loading.tsx` de esqueleto.
- Menú lateral: entrada **Calendario** en primera posición, roles `agente` y `call_center`.
- `RoleGate`: `HOME.call_center = '/dashboard/calendario'` y la ruta permitida para call
  center. El call center conserva Panel General y Citas.
- `docs/roles-y-permisos.md` se actualiza con la fila nueva y la página de entrada.

### Vista

Agenda semanal de lunes a domingo, de 08:00 a 22:00, con filas cada 30 minutos y columnas
por día. Cabecera con:

- Botones "Semana anterior", "Hoy", "Semana siguiente" y el rango de fechas visible.
- Filtro **Centro** (Todos por defecto), **Tipo de cita** (Todos, Adulto, Pareja, Menor,
  Sin tipo) y **Psicólogo** (Todos; la lista se reduce a los del centro elegido).

Al entrar se ve todo: todos los centros, todos los tipos, todos los psicólogos, semana actual.

Cada cita es un bloque de una hora colocado en su día y hora, con color de fondo por centro
(paleta fija de ocho tonos suaves, uno por centro, con leyenda bajo los filtros) y texto
`Nombre del psicólogo · Iniciales · Tipo`. Si hay varias citas a la misma hora en el mismo
día se apilan en columna dentro de la celda. Al pasar el ratón se ve el centro y la hora
completa en un `title`.

Los bloqueos aparecen como franja de día completo en la parte superior de la columna del
día, con el texto `Nombre · Vacaciones` (o el motivo que sea; `Otros` y nulo se muestran
como "Bloqueo").

Cuando el filtro de psicólogo tiene una ficha concreta, sus tramos de horario se pintan como
fondo sombreado en las celdas correspondientes, así se ve de un vistazo dónde quedan huecos.

En móvil (según los patrones de `globals.css`) se ve un solo día con flechas de día
anterior y siguiente, y los filtros apilados.

### Datos

Una consulta a `acciones_psicologos` por semana visible:

- `accion = 'Agendar cita'`, `activo = true`, `fecha_cita` entre lunes y domingo.
- `accion = 'Bloquear agenda'`, `activo = true`, `fecha_bloqueo_inicio <= domingo` y
  (`fecha_bloqueo_fin >= lunes` o nula).

Se seleccionan `id, accion, psicologo_id, paciente_id, fecha_cita, hora_cita, tipo_cita,
fecha_bloqueo_inicio, fecha_bloqueo_fin, motivo_bloqueo`. Psicólogos (con centro) y centros
se cargan una vez al entrar. Las iniciales se resuelven con una consulta a `pacientes`
por los `paciente_id` de la semana (`select id, iniciales`). Si el horario del psicólogo
filtrado hace falta, se consulta `horarios_psicologos` al cambiar el filtro.

Lee de la tabla de estado actual, así que **solo se ven las citas y bloqueos gestionados
desde la app**. Lo que un psicólogo apunte a mano en Google Calendar no aparece. Es la
misma limitación que hoy tiene el selector de eventos de Citas.

## Dependencia de Make: tipo de cita

En los datos reales, todas las citas agendadas desde julio de 2026 tienen `tipo_cita` a
nulo en `acciones_psicologos`, aunque la app envía `datosProcesados.tipo_cita` al webhook
desde la migración 006. El escenario de Make que escribe la fila de "Agendar cita" no guarda
ese campo (en el historial sí aparece en algún "Cambiar cita").

Consecuencia: el filtro por tipo de cita del calendario solo distinguirá las citas creadas
después de que Make guarde `tipo_cita` al agendar. Hasta entonces aparecen bajo "Sin tipo".
Se añade un apartado al documento de cambios de Make que está fuera del repo, en
`Z:\Claude\Somos Psicológos\docs\make-cambios-2026-09-25.md`, con el mapeo exacto:
`datosProcesados.tipo_cita` → columna `acciones_psicologos.tipo_cita` en el módulo que crea
la fila de "Agendar cita".

La app no puede rellenarlo por su cuenta porque la fila la crea Make después del webhook.

## Pruebas

- El proyecto no tiene ejecutor de tests. Se añade **Vitest** como dependencia de desarrollo
  con un script `npm test`, solo para módulos puros.
- `lib/disponibilidad.test.ts` cubre: día laborable y no laborable, tramos partidos, hueco
  que no cabe entero al final del tramo, cita que ocupa vecinas con y sin medias horas,
  bloqueo de rango de días, exclusión de la cita que se cambia, ficha sin tramos.
- El resto (editor, formulario, calendario) se verifica con `npm run build` y probando en
  la app con los tres roles.

## Riesgos y límites

- **Horarios vacíos al principio**: hasta que los agentes rellenen horarios, la única
  restricción efectiva es la ocupación. Es intencionado.
- **Medias horas**: al pasar a "solo en punto" por defecto, los psicólogos que hoy reciben
  citas a y media dejan de ofrecerlas hasta que un agente pulse 30'. Conviene revisarlo el
  día del despliegue con la lista de psicólogos.
- **Ocupación por calendario compartido**: si dos fichas de la misma persona tienen
  `calendar_id` distinto por error, la ocupación de un centro no se verá en el otro.
- **Concurrencia**: dos usuarios pueden agendar el mismo hueco a la vez; la app no lo
  impide (Make crea ambos eventos). Es el comportamiento actual y no se aborda aquí.
- **Seguridad**: la tabla nueva queda con RLS abierta como el resto. Pendiente global.
