# Pruebas de aceptación — Resumen de pacientes, Actividad de citas e Inspección (bloque B8)

Para el equipo de Somos Psicólogos. Cada prueba dice quién la hace, qué pasos seguir y qué tiene que verse.
Marcad cada una con ✅ o ❌ y, si falla, anotad qué se vio en lugar de lo esperado.

Antes de empezar:

- Hacen falta los usuarios de siempre (un agente, alguien del call center y un psicólogo). El usuario de Inspección
  se crea en la prueba E1.
- Elegid un **psicólogo de prueba con horario de lunes a viernes de 9:00 a 14:00** en un solo centro (se ve y se
  cambia en **Psicólogos**, en su ficha). Lo usan B6 y D2.
- Tened a mano un mes con citas que conozcáis (por ejemplo octubre de 2026), para comparar con Google Calendar.
- Al terminar, quitad los bloqueos y las citas de prueba.

Dos cosas que conviene saber antes de mirar los números:

- **Resumen de pacientes** cuenta las citas por el **día de la sesión**. **Actividad de citas** cuenta las acciones
  por el **día en que se hicieron** (una cita agendada hoy para el mes que viene sale hoy en Actividad y el mes que
  viene en Resumen).
- La **ocupación** y las **horas bloqueadas** salen del horario de cada psicólogo. Para fechas en las que un
  psicólogo aún no tenía horario cargado salen «—» o 0 h: no es un fallo.

## A. Selector de periodo y centros

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| A1 | Agente | Mirar el menú lateral | Salen **Resumen de pacientes** y **Actividad de citas**. Ya no salen «Panel General» ni «Estadísticas» |
| A2 | Agente | Abrir **Resumen de pacientes** | Arriba, el título y debajo el periodo (por ejemplo «1 oct – 31 oct 2026»). El botón **Este mes** está marcado |
| A3 | Agente | Pulsar uno a uno **Hoy**, **Esta semana**, **Mes pasado**, **Últimos 90 días** y **Desde siempre** | Cada vez se marca el botón pulsado, cambia el texto del periodo y se recalculan las cifras. **Esta semana** va de lunes a domingo |
| A4 | Agente | Poner **Desde** 01/10/2026 y **Hasta** 15/10/2026 y salir del campo (o pulsar Intro) | Ningún atajo queda marcado, el periodo dice «1 oct – 15 oct 2026» y las cifras cambian |
| A5 | Agente | Mientras se escribe el año en **Desde**, fijarse en la página | No recarga con cada tecla; solo al salir del campo o al pulsar Intro |
| A6 | Agente | Copiar la dirección de la página y abrirla en otra pestaña | Sale el mismo periodo y el mismo centro |
| A7 | Agente | Pulsar el botón de un centro | El botón queda marcado y las cifras bajan. La tabla **Pacientes Recientes** muestra solo pacientes de ese centro. **Todos los centros** lo deshace |

## B. Cuadros de Resumen de pacientes

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| B1 | Agente | Elegir del 1 al 31 de un mes conocido | **Citas agendadas** coincide con las citas no anuladas de ese mes en Google Calendar (sumando los calendarios de todos los psicólogos). **Pacientes citados** es igual o menor que Citas agendadas |
| B2 | Agente | Con ese mismo mes, elegir un centro | **Citas agendadas** y **Pacientes citados** bajan y cuadran con las citas de ese centro |
| B3 | Agente | Agendar una cita de prueba para este mes y después anularla | Al agendarla, **Citas agendadas** sube 1. Al anularla vuelve a bajar y **Tasa de anulación** sube |
| B4 | Agente | Comparar **Pacientes nuevos** y **Menores nuevos** con la lista de **Pacientes** del mismo periodo | Pacientes nuevos = fichas dadas de alta en el periodo; Menores nuevos = las de menores entre ellas |
| B5 | Agente | Dar de alta una pareja rellenando también **Segunda persona** | **Parejas nuevas** sube **1** (no 2), aunque se crean dos fichas |
| B6 | Agente | Mirar **Ocupación** en un mes en que los psicólogos ya tenían horario | Sale un porcentaje y debajo «X citas / Y huecos». Si se elige un periodo o un centro sin horarios cargados sale «Sin horario cargado: la ocupación no se puede calcular.» |
| B7 | Agente | Ponerle al psicólogo de prueba vacaciones de lunes a viernes (5 días) este mes y volver a Resumen | Los huecos bajan **25** (5 días × 5 horas), porque los días bloqueados no cuentan como huecos libres |
| B8 | Agente | Buscar un psicólogo que tenga **toda** la agenda bloqueada en el periodo y ninguna cita | No cuenta en **Psicólogos activos** |

## C. Gráficas de Resumen de pacientes

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| C1 | Agente | Abrir el desplegable del quesito y probar las cuatro opciones | Salen **Citas por tipo de terapia**, **Nuevos pacientes por centro**, **Nuevos pacientes por canal de entrada** y **Distribución por estado**. La gráfica cambia al momento: la página no recarga y la dirección no cambia |
| C2 | Agente | **Citas por tipo de terapia** | Porciones Adultos, Pareja, Infantil (y «Sin tipo» para citas antiguas). Sumadas dan **Citas agendadas** |
| C3 | Agente | **Nuevos pacientes por canal de entrada** | Porciones Dante, Agentes, Call center, Psicólogos (y «Sin dato» para fichas antiguas). Sumadas dan **Pacientes nuevos** |
| C4 | Agente | Abrir el desplegable de las barras y probar las ocho opciones | Nuevos pacientes, citas, ocupación y anulación, cada una por psicólogo y por centro. Aparecen **todos** los psicólogos activos (los que no tienen datos, con 0), de mayor a menor; si son muchos, la tarjeta tiene scroll |
| C5 | Agente | **Ocupación por psicólogo** | Debajo sale «Las citas fuera de horario cuentan; por eso puede pasar del 100 %.» Un psicólogo sin horario sale con barra vacía y, al pasar el ratón, «Sin horario cargado» |

## D. Actividad de citas

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| D1 | Agente | Abrir **Actividad de citas** | Mismo selector de periodo y centros que en Resumen, más el desplegable **Psicólogo** |
| D2 | Agente | Hoy, ponerle al psicólogo de prueba vacaciones de lunes a viernes (pueden ser fechas futuras). En Actividad, pulsar **Hoy** | **Vacaciones** sube **25 h** y **Bloqueos en agenda** también. En la tabla, su fila muestra 25 h en Vacaciones |
| D3 | Agente | Mirar el quesito **Motivos de bloqueo** | Va en horas (al pasar el ratón: «25 h»), con Vacaciones, Asuntos propios, Baja médica y Otros |
| D4 | Agente | Abrir el desplegable de las barras | Seis opciones: bloqueos, vacaciones, asuntos propios y baja médica por psicólogo (en horas), y citas agendadas y anuladas por psicólogo. Todos los psicólogos activos, de mayor a menor |
| D5 | Agente | Agendar hoy una cita para el mes que viene y mirar Actividad con **Hoy** | **Citas agendadas** sube 1 (cuenta el día en que se agendó) |
| D6 | Agente | Pulsar una fila de la tabla **Detalle por psicólogo** | Queda elegido ese psicólogo: salen su ficha y sus últimas diez acciones. Si después se cambia de centro, el psicólogo elegido se quita |

## E. Perfil Inspección

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| E1 | Agente | **Usuarios** → **+ Nuevo usuario** → elegir **Inspección**, rellenar nombre y email y crear | Al elegir Inspección sale el texto que explica el perfil. La persona aparece en la pestaña **Inspección** y recibe el correo para crear su contraseña |
| E2 | Inspección | Entrar con su usuario | Aterriza en **Calendario**. En el menú salen Calendario, Pacientes, Psicólogos, Agentes, Usuarios, Citas y Comunicaciones; **no** salen Resumen de pacientes ni Actividad de citas |
| E3 | Inspección | Escribir a mano en la barra del navegador la dirección de Resumen de pacientes (…/dashboard) y la de Actividad de citas (…/dashboard/psicologos/stats) | En los dos casos vuelve al Calendario sin enseñar ningún número |
| E4 | Inspección | En **Citas**, agendar una cita de prueba fuera del horario del psicólogo y abrir **Bloquear / Desbloquear agenda** | Como un agente: le avisa de que está fuera de horario pero le deja seguir, y tiene todos los tipos de bloqueo |
| E5 | Inspección y agente | Inspección da de alta un paciente de prueba. El agente lo busca en **Pacientes** y mira la columna **Añadido por** | Sale el nombre de la persona de Inspección y, al lado en gris, «Inspección» |
| E6 | Agente | En **Usuarios** → pestaña **Inspección**, usar el interruptor de la persona | Se desactiva y se vuelve a activar como un agente |

## F. Call center y psicólogo

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| F1 | Call center | Entrar en **Mi actividad** | Tiene el mismo selector de fechas (sin botones de centro). Solo ve sus propias citas y pacientes; con **Desde siempre** salen todas sus acciones |
| F2 | Psicólogo | Escribir a mano la dirección de Resumen de pacientes (…/dashboard) | Vuelve a su pantalla de **Citas** sin enseñar ningún dato de la clínica |

## G. Quién lo revisa

Todas las pruebas las hace el equipo: un agente (A–D, E1, E5, E6), la persona de Inspección (E2–E4), el call center
(F1) y un psicólogo (F2). Si falla B1 (las citas no cuadran con Google Calendar) o E3/F2 (alguien ve números que no le
tocan), avisad antes de seguir: son las reglas principales de este bloque.

Dos límites conocidos que no son fallos:

- Las anulaciones que Make hizo antes de que existiera el historial de acciones (septiembre de 2026) cuentan como
  citas atendidas en Resumen.
- Hoy Inspección está limitado en pantalla, no en la base de datos: queda pendiente cerrar los permisos en la base de
  datos (punto «Protección de datos» del manual).
