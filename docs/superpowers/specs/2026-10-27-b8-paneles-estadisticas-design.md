# B8 — Paneles y estadísticas (diseño)

Fecha: 27-10-2026. Bloque B8 del tablero (tareas 21, 22, 23, 24, 25, 56). Tarea 23 resuelta: Jaime mandó la lista de indicadores el 27-10 (copiada al final de este documento). Depende de **B1** (horarios por centro: sin ellos no hay ocupación ni horas bloqueadas) y de **B4** (`pareja_de` para contar parejas). **[mi decisión]** = lo decidió Claude. Las cuatro propuestas marcadas **[confirmado 29-10]** las aprobó Sonia el 29-10-2026: no hay decisiones abiertas.

## Cómo funciona hoy (verificado el 27-10)

- **Panel General** (`app/dashboard/page.tsx`): seis KPIs sobre *toda* la tabla de pacientes sin periodo (total, agendados = estado Agendado, nuevos últimos 7 días, tasa de anulación = estado Anulado / total, menores, psicólogos activos = `activo`), gráfica "Distribución por estado", barras "Pacientes por psicólogo" (top 8) y tabla de 50 pacientes recientes. Las pastillas de centro son etiquetas fijas. El call center ve `PanelCallCenter` (su actividad, periodo hoy / semana / mes por `?periodo=`).
- **Estadísticas** (`app/dashboard/psicologos/stats/page.tsx`): periodo `?period=this_month|last_30|last_90|all` por `creado_en`, filtros `?centro=` y `?psi=`; cuenta **número de bloqueos** (filas `Bloquear agenda`) y acciones del historial (agendadas, cambiadas, anuladas); quesito de motivos; barras "bloqueos por psicólogo" top 10; tabla por psicólogo; últimas 10 acciones del psicólogo elegido.
- Datos disponibles: citas en `acciones_psicologos` (`accion = 'Agendar cita'` con `activo`; al anular la fila pasa a `accion = 'Cancelar cita'` y conserva `fecha_cita`), con `psicologo_id`, `centro_id`, `tipo_cita` (adulto / pareja / menor; null en citas de antes de 06-2026), `paciente_id`, `origen`. Bloqueos: filas `Bloquear agenda` con `fecha_bloqueo_inicio` / `fecha_bloqueo_fin` (**días completos**, tipo `date`) y `motivo_bloqueo`. Pacientes: `fecha_incorporacion`, `es_menor`, `centro_id`, `origen` (`dante` | `agente` | `call_center` | `psicologo`; null en fichas de antes de 09-2026), `psicologo_pareja_id`, y desde B4 `pareja_de`. Horarios: `horarios_psicologos` (tramos semanales; desde B1 con `centro_id`).
- Historial `acciones_historial`: una fila por acción con `creado_en` (cuándo se hizo), `accion`, `psicologo_id`, `centro_id`, `tipo_cita`, `motivo_bloqueo`, fechas de bloqueo.

## Objetivos

1. **Un solo selector de periodo (22, 24)** para Resumen, Estadísticas y el panel del call center: fecha inicio y fecha fin libres, con atajos *Hoy · Esta semana · Este mes · Mes pasado · Últimos 90 días · Desde siempre*. Al lado, pastillas de centro (*Todos* + un botón por centro) que filtran de verdad **(21)**. En Estadísticas se mantiene además el desplegable de psicólogo. El periodo y el centro viajan en la URL (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&centro=`), así un enlace se puede compartir y el atajo elegido se reconstruye al cargar.
2. **Títulos (24):** `/dashboard` pasa a llamarse **Resumen de pacientes** y `/dashboard/psicologos/stats` **Actividad de citas** (menú lateral, título de página y manual). **[mi decisión, confirmado 29-10]** Jaime no propuso nombres; con estos se entiende cuál es cuál.
3. **Resumen de pacientes: indicadores de Jaime (23).** Todos sobre el periodo y el centro elegidos. Las citas se cuentan por la **fecha de la sesión** (`fecha_cita`), no por cuándo se agendaron; los pacientes por `fecha_incorporacion`.

   | Cuadro | Qué cuenta |
   |---|---|
   | Pacientes citados | pacientes distintos con al menos una cita no anulada con `fecha_cita` en el periodo |
   | Citas agendadas | citas no anuladas con `fecha_cita` en el periodo (futuras incluidas si el periodo las abarca) |
   | Pacientes nuevos | fichas con `fecha_incorporacion` en el periodo |
   | Tasa de anulación | citas anuladas con `fecha_cita` en el periodo / (anuladas + no anuladas) del periodo, en % |
   | Menores nuevos | pacientes nuevos del periodo con `es_menor` |
   | Psicólogos activos | psicólogos distintos con al menos una cita no anulada en el periodo (quien tuvo toda la agenda bloqueada no cuenta) |
   | Parejas nuevas | pacientes nuevos del periodo con `psicologo_pareja_id`; si dos fichas están enlazadas por `pareja_de` (B4) cuentan como una pareja |
   | Ocupación | citas no anuladas del periodo / huecos abiertos del periodo, en % (ver "Huecos") |

   Orden de los cuadros: el de la tabla **[mi decisión]** (el del documento de Jaime; la línea "Lo distribuiría así" llegó cortada).

   **Gráfica 1 (quesito, con selector):** *Citas por tipo de terapia* (adultos / pareja / infantil; las citas sin tipo salen como "Sin tipo"), *Nuevos pacientes por centro*, *Nuevos pacientes por canal de entrada* (Dante / Agentes / Call center / Psicólogos / Sin dato), y **Distribución por estado** (la actual) como cuarta opción **[mi decisión, confirmado 29-10]**.

   **Gráfica 2 (barras horizontales, con selector):** *Nuevos pacientes por psicólogo*, *Nuevos pacientes por centro*, *Citas por psicólogo*, *Citas por centro*, *Ocupación por psicólogo (%)*, *Ocupación por centro (%)*, *Anulación por psicólogo (%)*, *Anulación por centro (%)*. Todos los psicólogos activos (no top 8/10), ordenados de mayor a menor, con scroll dentro de la tarjeta. Un psicólogo activo sin datos aparece con 0.

   **Anulación por psicólogo / centro [mi decisión, confirmado 29-10]:** se calcula sobre **citas** (anuladas / total de citas de ese psicólogo o centro), igual que el cuadro general, y no sobre huecos como escribió Jaime: así compara psicólogos aunque no tengan horario cargado y coincide con la tasa de arriba.

   La tabla "Pacientes recientes" se queda igual debajo (filtrada por centro, no por periodo).

4. **Actividad de citas: indicadores de Jaime (23, 25).** El periodo filtra por la **fecha en que se hizo la acción** (`creado_en` en hora de Madrid), como hoy. Cambios:
   - *Psicólogos activos* = psicólogos distintos con alguna cita no anulada cuya `fecha_cita` cae en el periodo (misma definición que en Resumen).
   - *Bloqueos en agenda* (antes "Bloqueos totales"), *Vacaciones*, *Asuntos propios*, *Baja médica* pasan a contar **horas** (ver "Horas bloqueadas"), no filas. El cuadro muestra `12 h`.
   - *Citas agendadas, cambiadas, anuladas*: como hoy (acciones del historial en el periodo).
   - Quesito de motivos de bloqueo: igual, pero en horas.
   - Barras con selector **(25)**: *Bloqueos por psicólogo (h)*, *Vacaciones por psicólogo (h)*, *Asuntos propios por psicólogo (h)*, *Baja médica por psicólogo (h)*, *Citas agendadas por psicólogo*, *Citas anuladas por psicólogo*. Todos los psicólogos activos, de mayor a menor, con scroll.
   - La tabla por psicólogo muestra horas en las columnas de bloqueos.

5. **Huecos y horas bloqueadas (ocupación).** Un hueco = una hora de horario. Huecos abiertos de un psicólogo en el periodo = suma, para cada día del periodo, de las horas de sus tramos de ese día de la semana (todos sus centros, o solo el centro filtrado), **menos** las horas de esos tramos que caen en un día bloqueado. Horas bloqueadas de un bloqueo = horas de los tramos del psicólogo en los días de `fecha_bloqueo_inicio..fecha_bloqueo_fin` que caen dentro del periodo. Las citas a y media no cambian el cómputo (una cita ocupa una hora). Ocupación por centro = citas del centro / huecos de los tramos de ese centro. Si los huecos son 0, la ocupación se muestra como "—". Puede superar el 100 % cuando hay citas fuera de horario (Dante y Make no miran el horario): se muestra tal cual con la nota `Las citas fuera de horario cuentan; por eso puede pasar del 100 %.`
   **Aviso para Jaime (va en el manual y en la estimación de plazos):** ocupación y horas bloqueadas solo son fiables desde que cada psicólogo tiene su horario cargado (B1). Para periodos anteriores saldrán 0 h / "—".
6. **Perfil inspección (56).** Nuevo rol `inspeccion` en `perfiles`: ve y hace lo mismo que un agente **salvo** Resumen de pacientes y Actividad de citas (ni en el menú ni por URL; su página de inicio es Calendario). Se da de alta desde Usuarios (pestaña "Inspección", misma ficha en `agentes` que agentes y call center). **[mi decisión, confirmado 29-10]:** no es solo lectura; el tablero lo describe como "copia del rol agente sin los dos paneles" y hacerlo de solo lectura tocaría todas las pantallas. Si el cliente quiere solo lectura, es una tarea aparte.

## No objetivos

- Exportar a Excel / PDF.
- Cambiar qué guarda Make en las citas o los bloqueos.
- Indicadores de facturación.
- Panel del call center: solo cambia el selector de periodo (mismo componente); sus cuadros siguen siendo los suyos.

## Modelo de datos (migración `022_rol_inspeccion.sql`)

```
perfiles.rol CHECK (rol IN ('agente', 'psicologo', 'call_center', 'inspeccion'))
```

Idempotente: `ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check; ADD CONSTRAINT perfiles_rol_check CHECK (...)`. Nada más: todos los indicadores se calculan en la app a partir de las tablas que ya existen. Si en B1/B4 las columnas `horarios_psicologos.centro_id` y `pacientes.pareja_de` aún no estuvieran aplicadas, el bloque no puede empezar (dependencia).

## Módulos puros (`lib/`)

- **`lib/periodo.ts`**: `type Rango = { desde: string; hasta: string }` (fechas `YYYY-MM-DD` inclusivas; `desde = ''` o `hasta = ''` = sin límite por ese lado). `ATAJOS: { key: AtajoKey; label: string }[]` con `hoy | semana | mes | mes_anterior | ultimos_90 | siempre`. `rangoDeAtajo(key, hoy)`, `rangoDeParams(params: { desde?, hasta?, periodo? }, hoy)` (fechas mal formadas → atajo `mes`; `desde > hasta` → se intercambian), `atajoDeRango(rango, hoy): AtajoKey | null` (para marcar el atajo activo), `enRango(fecha: string | null, rango): boolean`, `fechaMadrid(iso)` (movida desde `PanelCallCenter`), `diasDelRango(rango): string[]` (lista de días; `siempre` acotado al primer y último dato disponibles, que pasa la página).
- **`lib/kpis.ts`**: tipos de entrada mínimos (`CitaKpi`, `PacienteKpi`, `BloqueoKpi`, `TramoKpi = Tramo & { psicologo_id; centro_id }`), y funciones puras: `citasDelPeriodo(citas, rango)` (separa activas / anuladas por `fecha_cita`), `kpisResumen(...)`, `horasAbiertas(tramos, dias, bloqueos)`, `horasBloqueo(bloqueo, tramos, rango)`, `agruparPor(items, clave)`, `serieBarras(...)` (etiqueta, valor, orden descendente), `ocupacion(citas, huecos): number | null`, `tasa(parte, total): number | null`, `parejasNuevas(pacientes)`. Sin React ni Supabase; tests en `lib/kpis.test.ts` y `lib/periodo.test.ts`.
- **`lib/roles.ts`**: `ROLES: Rol[]`, `esGestor(rol)` = `agente` o `inspeccion` (lo que hoy se comprueba como `rol === 'agente'`), `HOME_POR_ROL`, `rutaPermitida(rol, path)` (movido desde `RoleGate`).

## Pantallas

- **`app/dashboard/_components/FiltroPeriodo.tsx`** (cliente): dos `<input type="date">`, los seis atajos como botones, pastillas de centro; escribe en la URL con `router.push` y `useTransition` (como hace `StatsDashboard`). Props: `rango`, `centros`, `centroId`, `mostrarCentros`. Se usa en las tres páginas.
- **Resumen de pacientes** (`app/dashboard/page.tsx` + nuevo cliente `ResumenDashboard.tsx` con los selectores de gráfica): lee citas (`acciones_psicologos` con `accion in ('Agendar cita','Cancelar cita')` y `fecha_cita` en el rango), pacientes, psicólogos activos, centros, tramos y bloqueos del rango; calcula con `lib/kpis.ts`; los selectores de gráfica son estado local (no URL). Quesitos: `GraficaQuesito.tsx` (generaliza `MotivosChart`); barras: `GraficaBarras.tsx` (generaliza `BloqueosBarChart`, con `unidad: '' | 'h' | '%'` y altura por fila + scroll).
- **Actividad de citas**: misma barra de filtros; `PERIOD_OPTIONS` / `PeriodKey` desaparecen a favor de `lib/periodo.ts`; KPIs de bloqueo en horas; selector de barras; tabla con horas; enlaces del psicólogo elegido conservan `desde`/`hasta`.
- **Panel del call center**: `PERIODOS` y `inicioPeriodo` sustituidos por `FiltroPeriodo` sin centros.
- **Roles**: `SidebarNav` (rutas con `inspeccion` = las del agente menos `/dashboard` y `/dashboard/psicologos/stats`; "Panel General" → "Resumen de pacientes", "Estadísticas" → "Actividad de citas"), `RoleGate` usa `lib/roles.ts`, `requireAgente` acepta `inspeccion`, `psicologos/page.tsx` y las demás comprobaciones `=== 'agente'` pasan a `esGestor`. Usuarios: pestaña "Inspección" (crea ficha en `agentes` con `rol = 'inspeccion'`). `docs/roles-y-permisos.md` y el manual (sección "Quién entra") con el rol nuevo.

## Textos de interfaz

`Resumen de pacientes` · `Actividad de citas` · `Desde` · `Hasta` · `Hoy` · `Esta semana` · `Este mes` · `Mes pasado` · `Últimos 90 días` · `Desde siempre` · `Todos los centros` · `Pacientes citados` · `Citas agendadas` · `Pacientes nuevos` · `Tasa de anulación` · `Menores nuevos` · `Psicólogos activos` · `Parejas nuevas` · `Ocupación` · `Citas por tipo de terapia` · `Nuevos pacientes por centro` · `Nuevos pacientes por canal de entrada` · `Distribución por estado` · `Nuevos pacientes por psicólogo` · `Citas por psicólogo` · `Citas por centro` · `Ocupación por psicólogo` · `Ocupación por centro` · `Anulación por psicólogo` · `Anulación por centro` · `Bloqueos en agenda` · `Bloqueos por psicólogo` · `Vacaciones por psicólogo` · `Asuntos propios por psicólogo` · `Baja médica por psicólogo` · `Citas agendadas por psicólogo` · `Citas anuladas por psicólogo` · `Sin tipo` · `Sin dato` · `Las citas fuera de horario cuentan; por eso puede pasar del 100 %.` · `Sin horario cargado: la ocupación no se puede calcular.` · `Inspección`.

## Comprobación de aceptación

1. Resumen: elegir 1–31 de un mes con citas conocidas → *Citas agendadas* coincide con las citas no anuladas de ese mes en Google Calendar; *Pacientes citados* ≤ citas; cambiar a un centro reduce ambas.
2. Un psicólogo con horario L–V 9–14 y una semana de vacaciones dentro del periodo → *Vacaciones* suma 25 h en Actividad; su ocupación en Resumen se calcula sobre los huecos restantes.
3. Psicólogo con toda la agenda bloqueada en el periodo → no cuenta en *Psicólogos activos*.
4. Selector de quesito y de barras cambian la gráfica sin recargar; la URL solo lleva periodo y centro.
5. `?desde=2026-10-01&hasta=2026-10-31` abre las tres páginas en octubre; `?periodo=semana` marca el atajo.
6. Usuario `inspeccion`: no ve Resumen ni Actividad en el menú; `/dashboard` lo manda a Calendario; el resto funciona como agente.
7. Call center: su panel sigue mostrando solo su actividad, ahora con fechas libres.

## Anexo: lista de indicadores de Jaime (27-10-2026)

Panel general: selector de fechas libre (inicio y fin). KPIs: pacientes citados (pacientes con cita en el periodo); citas agendadas (citas totales, no personas); pacientes nuevos (registrados por primera vez en el periodo; sin "esta semana"); tasa de anulación (% anuladas / total de citas del periodo); menores nuevos; psicólogos activos (con citas en el periodo; descontar los que tuvieron toda la agenda bloqueada); parejas nuevas; ocupación (% citas reales no anuladas / huecos abiertos). Quesitos con selector: citas por tipo de terapia (infantil / pareja / adultos), nuevos pacientes por centro, nuevos pacientes por canal de entrada (Dante, agentes, call center, psicólogos). Barras con selector: nuevos pacientes por psicólogo, nuevos pacientes por centro, citas por psicólogo (efectivas), citas por centro, ocupación por psicólogo, ocupación por centro, anulación por psicólogo, anulación por centro.

Estadísticas: selector de fechas (atajos no sustituyen al selector). Psicólogos activos (misma definición); bloqueos en agenda en **horas** (una semana bloqueada de 15 h de horario = 15), suma de todos los subtipos; vacaciones / asuntos propios / baja en horas y por periodo; citas agendadas / cambiadas / anuladas por periodo. Quesito de motivos igual, por periodo. Barras con desplegable: vacaciones, asuntos propios, baja por psicólogo (mayor a menor), citas agendadas y anuladas por psicólogo. En todas: todos los psicólogos activos con scroll, no top 10.
