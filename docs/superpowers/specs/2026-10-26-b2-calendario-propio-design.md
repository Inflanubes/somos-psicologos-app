# B2 — Calendario propio con huecos libres (diseño)

Fecha: 26-10-2026. Bloque B2 del tablero `docs/backlog-2026-10-21.md` (tareas 14, 15, 16, 18, 17, 19, 20, 53, 29). Depende de B1 (franjas por centro, estados `pasado`/`antelacion`, `cargarDatosDisponibilidad` por centro). Decisiones con Sonia el 26-10; lo marcado **[mi decisión]** lo decidió Claude.

## Por qué

- La vista Calendario solo pinta citas y bloqueos; los huecos libres solo salen en el selector de hora del formulario, uno a uno.
- El psicólogo ve su agenda en un iframe de Google Calendar dentro de Citas: no se refresca al agendar (17), tiene botones ajenos "Más detalles" y "Copiar a mi calendario" (19), empieza la semana según la cuenta de quien mira (20) y la app no controla nada de lo que muestra.
- Los colores van por centro y el cliente quiere colores por estado (15). Los bloqueos salen en una fila "Día" y el cliente los quiere hora a hora (16).
- Jaime pidió que los psicólogos también tengan calendario.

## Objetivos

1. Un solo componente de agenda semanal propio (`CalendarioAgenda`) que usan dos sitios: la página **Calendario** (agentes y call center, vista global con filtros) y la página **Citas** (los tres roles, junto al formulario, sustituyendo al iframe de Google).
2. Huecos libres calculados con la misma lógica que el formulario (`generarHuecos` de B1, franjas del centro, `ahora`), para cada psicólogo visible, 1 h o 30 min según `citas_media_hora`.
3. Colores por estado: libre azul, ocupada roja, primera cita naranja, anulada roja con fondo blanco y texto tachado, bloqueada gris. Leyenda por estado; desaparece la leyenda por centro (el centro va en el texto del bloque y en el tooltip).
4. Bloqueos hora a hora dentro del horario del psicólogo, con su motivo (Bloqueo / Vacaciones / Asuntos propios / Baja).
5. Clic en un hueco libre rellena en el formulario psicólogo, centro, fecha, hora y acción "Agendar cita"; clic en una cita rellena "Cambiar cita" con esa cita seleccionada. Desde la página Calendario, el clic lleva a Citas con esos datos.
6. Refresco automático tras agendar, cambiar o anular.
7. Psicólogo multicentro: desaparece "¿En qué centro vas a trabajar hoy?"; arriba, pastillas con "Todos" y sus centros.
8. Psicólogo inactivo: el call center ve sus citas pero no sus huecos libres; el agente lo ve todo.

## No objetivos

- Enlace o vista a Google Calendar: se quita del todo. **Se consultará con el cliente el día de la entrega** (no antes) si quieren un enlace "Abrir en Google Calendar". Anotado en el tablero (tarea 19).
- Arrastrar citas, vista mensual, impresión.
- Cambiar el modelo de bloqueos (siguen siendo días completos; se pintan hora a hora solo en pantalla).

## Modelo de eventos (`lib/calendario.ts`)

```
EventoCalendario.tipo: 'cita' | 'anulada' | 'bloqueo' | 'libre'
  + primera: boolean          (cita: el paciente no tiene ninguna otra cita anterior, activa ni en el histórico)
  + centros?: string[]        (libre sin filtro de centro: todos los centros donde esa hora está libre)
  + pacienteId: string | null
```

- **Citas**: `acciones_psicologos` activas de la semana (como hoy).
- **Anuladas**: `acciones_historial` con `accion = 'Cancelar cita'` y `fecha_cita` en la semana. Solo se cargan y pintan con la casilla "Ver anuladas" (desmarcada por defecto).
- **Primera cita**: para los pacientes de la semana, `acciones_historial` con `accion = 'Agendar cita'`; una cita es primera si no hay otra fila de "Agendar cita" del mismo paciente con `accion_id` distinto y `fecha_cita` anterior (o igual con `creado_en` anterior) **[mi decisión]**.
- **Bloqueos**: como hoy (rango de días), pero en pantalla se convierten en un bloque por cada hora del horario del psicólogo ese día; si el psicólogo no tiene franja ese día, no se pinta nada (en B1 "sin franja" ya significa "sin citas") **[mi decisión]**.
- **Libres**: por psicólogo visible y día, `generarHuecos` con las franjas del centro filtrado (o de todos sus centros, uniendo las horas libres en un solo bloque con `centros`), sus citas y bloqueos, `ahora` y `mediaHora`. Solo estado `libre`. No se calculan para días anteriores a hoy.

## Colores por estado (`COLORES_ESTADO` en `lib/calendario.ts`)

| Estado | Fondo | Borde | Texto | Extra |
|---|---|---|---|---|
| libre | `#e3edff` | `#2f5aae` | `#1f3f80` | |
| cita (ocupada) | `#fee2e2` | `#dc2626` | `#7f1d1d` | |
| cita primera | `#fff1dc` | `#ed8f0c` | `#8a5200` | |
| anulada | `#ffffff` | `#dc2626` (discontinuo) | `#991b1b` | texto tachado |
| bloqueo | `#e5e7eb` | `#4b5563` | `#1f2937` | |

Texto del bloque: libre → `Libre · {nombre}` (y `· {centro}` si no hay filtro de centro); cita → `{hora} {nombre}` y debajo `{iniciales} · {tipo} · {centro}`; anulada → igual que cita, tachado; bloqueo → `{nombre} · {motivo}`.

## Densidad **[mi decisión, acordada]**

- Con filtro de psicólogo **o** de centro: los huecos libres se pintan como bloques.
- Con "Todos los centros" y "Todos los psicólogos": cada media hora muestra un contador `N libres` (chip azul); al pulsarlo se despliega la lista de psicólogos (nombre · centro) y cada uno es pulsable (mismo clic que un bloque libre). Las citas y bloqueos se pintan siempre.

## Componente `CalendarioAgenda` (`app/dashboard/_components/CalendarioAgenda.tsx`)

Props:

```
{
  rol: 'agente' | 'psicologo' | 'call_center'
  filtros: { centroId: string; psicologoId: string; tipoCita: string }   // '' = todos
  psicologosVisibles: Psicologo[]            // ya filtrados por rol y centro por quien lo usa
  centros: Centro[]
  onClickLibre?: (h: { psicologoId: string; centroId: string; fecha: string; hora: string }) => void
  onClickCita?: (e: EventoCalendario) => void
  recargaKey?: number                        // cambia → recarga inmediata y de nuevo a los 4 s y 10 s
  cambioLocal?: AccionLocal | null           // aplicar en local sin esperar a Make
}
```

Dentro: navegación de semana (hoy, anterior, siguiente), casilla "Ver anuladas", leyenda por estado, vista de un día en móvil (como hoy), esqueleto de carga. Carga en `lib/calendario-datos.ts` (`cargarSemanaCalendario(cliente, { lunes, psicologoIds, verAnuladas })`), que devuelve citas, bloqueos, anuladas, histórico de "Agendar cita" de los pacientes de la semana y franjas de todos los psicólogos pedidos.

Reglas por rol:
- `call_center`: libres solo de psicólogos `activo`; citas y bloqueos de todos.
- `psicologo`: solo él mismo (`psicologosVisibles` = su ficha).
- `agente`: todo.

## Página Calendario (`app/dashboard/calendario/page.tsx`)

Conserva los filtros y pasa el resto al componente. Desaparece la leyenda por centro y la fila "Día". Clic en libre → `router.push('/dashboard/psicologos?accion=agendar&centro=…&psicologo=…&fecha=…&hora=…')`; clic en cita → `router.push('/dashboard/psicologos?accion=cambiar&cita=<id>')`.

## Página Citas (`app/dashboard/psicologos/page.tsx`)

- El bloque del iframe (líneas ~2107–2135, clases `cal-desktop` / `cal-mobile`, estilos `.calendar-panel`) se sustituye por `CalendarioAgenda`. Filtros: agente y call center → `centroId` = centro elegido, `psicologoId` = psicólogo elegido (si no hay psicólogo, todos los del centro; si no hay centro, modo contador). Psicólogo → él mismo y el centro de las pastillas ("Todos" = `''`).
- `onClickLibre`: fija centro, psicólogo, fecha, hora y acción "Agendar cita"; hace scroll al formulario. `onClickCita`: acción "Cambiar cita", `eventoSeleccionadoId` = id de la cita, psicólogo y centro de la cita.
- Parámetros de URL al cargar (`useSearchParams`, con `Suspense` como exige el App Router): mismos efectos que los clics.
- Tras un envío correcto (`setSuccess(true)` en los tres sitios): `cambioLocal` con la cita nueva / cambiada / anulada y `recargaKey + 1`.
- **Tarea 53**: la pantalla "¿En qué centro vas a trabajar hoy?" desaparece. Arriba del formulario, pastillas `Todos` + sus centros (los apagados con "(no recibe citas nuevas)", de B1). Con un centro elegido, el formulario fija ese centro como hoy. Con "Todos", el formulario muestra el desplegable de centro con solo sus centros (obligatorio al agendar) y el calendario enseña todos. La elección se guarda en `lib/centro-activo.ts` (`centroId: 'todos'` pasa a ser válido).

## Textos de interfaz

- Casilla: `Ver anuladas`
- Leyenda: `Libre`, `Ocupada`, `Primera cita`, `Anulada`, `Bloqueada`
- Chip: `{N} libres` · `1 libre`
- Pastillas del psicólogo: `Todos` y el nombre de cada centro
- Vacío: `No hay citas ni huecos esta semana con los filtros elegidos.`

## Lo que queda al builder

- Cómo repartir en columnas libres, citas y anuladas que coincidan en hora (`distribuirColumnas` ya existe; los libres de media hora ocupan una fila, las citas dos).
- Si el popover del contador se hace con un `<details>` o con estado.
- Dónde poner el scroll al formulario tras un clic.

## Comprobación de aceptación

1. Agente en Calendario con "Todos": chips `N libres`; filtra por Moratalaz: bloques azules de cada psicólogo; clic en uno → Citas con todo relleno.
2. Psicóloga con dos centros: pastillas Todos / Moratalaz / San Blas; con Todos, el calendario mezcla ambos y el formulario pide centro; con uno, se fija.
3. Agendar desde Citas: la cita aparece en el calendario al instante y sigue ahí tras 10 s (cuando Make ya escribió); anular: desaparece y, con "Ver anuladas", vuelve tachada en rojo.
4. Paciente nuevo: su primera cita sale naranja; la segunda, roja.
5. Bloqueo de vacaciones de lunes a miércoles: gris hora a hora solo dentro de las franjas de esos días.
6. Call center con un psicólogo inactivo: ve sus citas, no sus huecos; el agente ve ambos.
7. Móvil: un día, chips y bloques legibles, sin scroll horizontal.
