# Pruebas de aceptación — Bloqueos y Baja médica (bloque B6)

Para el equipo de Somos Psicólogos. Cada prueba dice quién la hace, qué pasos seguir y qué tiene que verse.
Marcad cada una con ✅ o ❌ y, si falla, anotad qué se vio en lugar de lo esperado.

Antes de empezar: hacen falta un psicólogo de prueba **con** permiso de bloqueo y otro **sin** él (se cambia en
**Psicólogos**, en su ficha), cada uno con su usuario. Usad fechas futuras que no tengan citas, y al terminar quitad
los bloqueos de prueba (prueba B6).

## A. Qué ve cada uno en el desplegable de Citas («¿Qué necesitas hoy?»)

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| A1 | Agente | En **Citas**, elegir centro y psicólogo y abrir «¿Qué necesitas hoy?» | Salen **Agendar cita**, **Añadir nuevo paciente**, **Cambiar cita**, **Cancelar cita**, **Bloquear / Desbloquear agenda** y **Otros (aviso al equipo)**. Ya no salen Vacaciones, Asuntos propios ni Baja sueltas |
| A2 | Agente | Elegir **Bloquear / Desbloquear agenda** | Debajo aparece **Tipo de bloqueo** con «Selecciona el tipo» y seis opciones: Vacaciones, Asuntos propios, Baja médica, Modificar un bloqueo, Bloqueo general y Desbloquear |
| A3 | Agente | Con un tipo elegido (por ejemplo Vacaciones), volver a cambiar la acción a **Agendar cita** | Desaparece **Tipo de bloqueo** y los campos del bloqueo; sale el formulario normal de cita |
| A4 | Psicólogo **con** permiso | Entrar con su usuario y abrir «¿Qué necesitas hoy?» | Salen las cuatro de citas y **Bloquear / Desbloquear agenda**, con los seis tipos. No sale «Otros (aviso al equipo)» |
| A5 | Psicólogo **sin** permiso | Entrar con su usuario y abrir «¿Qué necesitas hoy?» | Solo salen **Agendar cita**, **Añadir nuevo paciente**, **Cambiar cita** y **Cancelar cita**. No hay ninguna opción de bloqueo (tampoco vacaciones, asuntos propios ni baja médica) |
| A6 | Call center | Abrir «¿Qué necesitas hoy?» con cualquier psicólogo | Salen las cuatro de citas y **Otros (aviso al equipo)**. Ninguna de bloqueo |
| A7 | Agente | En **Psicólogos**, dar permiso de bloqueo al psicólogo de A5. Él recarga **Citas** | Ahora ve **Bloquear / Desbloquear agenda** como en A4. Quitar el permiso de nuevo al terminar |

## B. Cada tipo de bloqueo sigue funcionando como antes

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| B1 | Agente | **Bloquear / Desbloquear agenda** → **Baja médica**, con una fecha de inicio y un periodo, y pulsar **Confirmar baja médica** | El bloqueo se guarda; en el **Calendario** esos días salen bloqueados; el equipo recibe el Telegram «… por baja médica.» |
| B2 | Agente | Lo mismo con **Vacaciones** (botón **Confirmar vacaciones**) y con **Asuntos propios** (botón **Confirmar asuntos propios**) | Igual que B1, cada uno con su motivo en el Telegram |
| B3 | Psicólogo **con** permiso | Ponerse una **Baja médica** en su propia agenda | Igual que B1 |
| B4 | Agente | **Bloqueo general** sobre unos días del psicólogo de prueba | Se bloquea la agenda esos días, como el «Bloquear agenda» de antes |
| B5 | Agente | **Modificar un bloqueo** | En «Bloqueo a modificar» aparecen las vacaciones, asuntos propios y bajas de B1–B3 (también las bajas antiguas, que ahora se llaman «Baja médica»). Cambiar las fechas de una y comprobar que el Calendario se mueve |
| B6 | Agente | **Desbloquear**, elegir en «Bloqueo a eliminar» los bloqueos de prueba uno a uno | Desaparecen del Calendario. Si el psicólogo no tiene ninguno sale «Sin bloqueos activos para este psicólogo» |

## C. «Baja médica» en lugar de «Baja laboral»

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| C1 | Agente | Abrir **Estadísticas** | En las cifras y en la tabla por psicólogo pone **Baja médica**; en ningún sitio pone «Baja laboral» |
| C2 | Agente | En Estadísticas, mirar un periodo en el que hubiera bajas laborales antiguas | Esas bajas cuentan como **Baja médica** (no desaparecen ni salen aparte) |
| C3 | Agente | En el **Calendario**, buscar una baja antigua o la de B1 | Se ve como bloqueo, con el motivo «Baja médica» |
| C4 | Be Banana | En la base, mirar la fila de B1 en `acciones_psicologos` | `motivo_bloqueo = Baja médica` |

## D. Quién lo revisa

Las pruebas A y B las hace el equipo (agente, un psicólogo con permiso, otro sin él y el call center). C4 la hace Be
Banana. Si algo de A5 o A6 falla (un psicólogo sin permiso o el call center ven bloqueos), avisad antes de seguir:
es la regla principal de este bloque.
