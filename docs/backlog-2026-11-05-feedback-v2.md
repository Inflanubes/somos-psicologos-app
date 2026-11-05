# Backlog — Feedback de Jaime v2 (05-11-2026)

Fuente: `docs/Feedback IA v2.docx` (en la carpeta `docs/` de la raíz del proyecto, fuera de `somos-app`; 9 capturas). Los números entre paréntesis son los del checklist de pruebas de Jaime.

**Forma de trabajo:** cuatro chats en paralelo, uno por bloque, cada uno en **su propia carpeta (git worktree) y su propia rama**. Reglas de coordinación al final del documento.

**Decisiones ya tomadas (05-11-2026):**
- «Bloqueo general» se mantiene como tipo propio, renombrado a **«Cerrar agenda»**; en el calendario se muestra solo **«Cerrado»**.
- Tarea 13 (quitar «Sin cita disponible» del call center) ya estaba hecha (01-11-2026, `lib/call-center.ts`).

---

## Bloques

| Bloque | Carpeta | Rama | Migración reservada | Estado |
|---|---|---|---|---|
| F1 Calendario y bloqueos | `../somos-app-f1` | `f1-calendario-bloqueos` | 024 (no usada) | **en main** 05-11-2026 (b512d47, fast-forward; tsc, 249 tests y build OK). Notas y pruebas P1–P10 en `docs/f1-notas.md`. Falta: arreglo de Make (baja médica → F4), pruebas de aceptación |
| F2 Call center | `../somos-app-f2` | `f2-call-center` | 025 (no usada) | **en main** 05-11-2026 (58963d7; tsc, 257 tests y build OK). Notas y pruebas 1–11 en `docs/f2-notas.md`. Make ruta «Otro» sin ficha hecha por Sonia 05-11. Falta: pruebas de aceptación |
| F3 Pacientes, comunicaciones y usuarios | `../somos-app-f3` | `f3-pacientes-comunicaciones` | 026 (aplicada 05-11) | **en main** 05-11-2026 (55a2eca; tsc, 273 tests y build OK). Notas y pruebas 1–9 en `docs/f3-notas.md`. Falta: número de Dante (18), Make rutas 6–8 (F4 tarea 19), pruebas |
| F4 Dante y Make | `../somos-app-f4` | `f4-dante-make` | 027 (no usada) | **en main** 05-11-2026 (solo docs: `docs/f4-notas.md`). Make 1A y 1B hechos; Dante subido a n8n; historial de Jaime limpio. Falta: 1C (opcional), Marta y Bea inician @Jaimervr_bot, borrar 5 eventos del calendario de JAIME, pruebas P1–P9 |

---

## Tareas

Estado: `pendiente` · `en curso` · `hecha` · `verificar` · `espera cliente`.

### F1 Calendario y bloqueos

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 1 | Huecos libres de **60 min** siempre (hoy se pintan de 30). Con «cita a las medias horas» activado, huecos de y media a y media (4:30–5:30…), nunca dos huecos por hora (caso Marta, San Blas) (0.0) | verificar | `lib/disponibilidad.ts` lo usa también Dante (`/api/disponibilidad`): cualquier cambio de formato avisar a F4 |
| 2 | Calendario de agentes: **ocultar bajas y asuntos propios** (meten ruido). «X libres» se queda (0.0) | verificar | |
| 3 | Vista móvil por día: «Día >» y «< Día» no se bloquean al final/principio de semana (2.8) | verificar | |
| 4 | «Desbloquear» dice «Sin bloqueos activos» aunque los haya; solo lista el bloqueo general (2.6, 6.4) | verificar | `psicologos/page.tsx` ~l. 777 (Desbloquear → solo genéricos) |
| 5 | «Modificar un bloqueo» no lista el bloqueo general (6.4) | verificar | |
| 6 | Baja médica no se ve en el calendario del propio psicólogo (sí en agente y call center) (6.4) | hecha en la app; Make → F4 tarea 20 | |
| 7 | Regla: los 4 tipos de bloqueo funcionan igual: se ven en los 3 paneles, mandan Telegram, se modifican y se desbloquean (6.4) | hecha en la app; Make → F4 tarea 20 | Telegram es Make → F4 (tarea 20) |
| 8 | Renombrar «Bloqueo general» → «Cerrar agenda»; en el calendario solo «Cerrado» (6.5) | verificar | Si cambia el valor que se envía a Make, avisar a F4 |
| 9 | Clínica apagada: el psicólogo sigue viendo y usando sus huecos; quitar «(no recibe citas nuevas)» de su selector de centros. Solo el call center no puede agendar (1.3) | verificar | `psicologos/page.tsx` ~l. 1998–2053 |

### F2 Call center

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 10 | Vaciar el campo «Operador» después de cada acción registrada (3.3) | verificar | |
| 11 | Formulario por pasos: al entrar solo el buscador de teléfono; el resto oculto hasta buscar. Tres supuestos (3.4): **1)** paciente con cita previa → centro y psicólogo bloqueados; acciones: Agendar, Cambiar, Cancelar, Hablar con el psicólogo, Cambio de psicólogo, Otros. **2)** paciente creado sin ninguna cita → centro y psicólogo bloqueados; acciones: Agendar, «Cambio de psicólogo o centro», Otros. **3)** no existe → Añadir nuevo paciente, Otros | verificar | Solo rol call center (confirmar si también agentes) |
| 12 | Textos del alta: «Nombre completo de la persona citada (si es menor, el nombre del menor)» y «Fecha de nacimiento de la persona citada» (4.7) | verificar | |
| 13 | Quitar «Sin cita disponible» del call center (0.0) | hecha | 01-11-2026 |

### F3 Pacientes, comunicaciones y usuarios

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 14 | Pacientes (agentes): subpestañas **Parejas** (las dos personas) y **Menores** (menor + tutores), con el estado del consentimiento de cada entidad (0.0) | verificar | `pareja_de` existe desde B4/B8 |
| 15 | Textos de botones: «Marcar "firmado en papel"» y «Desmarcar "firmado"» (4.3, 4.4) | verificar | `ConsentimientoAcciones.tsx` |
| 16 | Comunicaciones no muestra los pacientes de las pruebas (sin cita, hablar con el psicólogo, cambio de psicólogo…) (3.6, 4.8) | hecha en la app (sin filtro de días; pestañas renombradas); Make → F4 tarea 19 | Comprobar la regla «más de 1 día esperando» de la pestaña y si el estado se guarda (puede depender de Make → F4 tarea 19) |
| 17 | Botón para eliminar un usuario (agente o psicólogo) con confirmación: «¿Estás seguro de que quieres eliminar este usuario? Ten en cuenta que se eliminará todo su histórico de citas» (9.1) | verificar | |
| 18 | Pie de mensajes: contacto de **Dante** en lugar del teléfono del call center (91 166 50 47) (9.4) | espera cliente | Falta el número de Dante. `lib/mensajes-pie.ts` (una constante) |

### F4 Dante y Make

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 19 | No llega Telegram de «Sin cita disponible», «Hablar con el psicólogo» y «Cambio de psicólogo» desde el call center; «Otros» sí (3.6) | verificar (Make arreglado el 01-11; las pruebas de Jaime eran anteriores) | Make |
| 20 | No llega Telegram de baja médica ni de bloqueo general (6.4, 6.5) | hecha en Make 05-11 (baja médica y «Cerrar agenda» avisan a los agentes); falta 1C opcional | Make; vacaciones y asuntos propios sí llegan |
| 21 | Dante se queda colgado al confirmar la cita y no crea el paciente (cita para el padre de Jaime, «PapáJaime Prueba Paciente», lun 9-11 10:00) (5.1) | verificar (Dante con memoria de 30 y reglas nuevas, subido 05-11) | Necesita ejecuciones de n8n (conector n8n sin autorizar) |
| 22 | Derivaciones a Marta: no le llega el Telegram (7.2, 7.6); bloquea 7.5 y 7.7 | espera Marta y Bea (abrir @Jaimervr_bot y pulsar Iniciar) | Probable chat_id de Marta ausente o no ha iniciado el bot |
| 23 | Añadir a Marta a los avisos de emergencia (junto a Bea y Jaime) (7.1) | verificar (emergencia a Jaime, Bea y Marta, subido 05-11) | |
| 24 | Borrar el historial de Jaime en Dante para que pueda repetir 1.6 y 5.2–5.16 (Dante le deriva siempre a un agente) | hecha 05-11 (memoria vacía, citas desactivadas, derivaciones cerradas); faltan 5 eventos de Google Calendar | |

---

## Reglas de coordinación entre chats

1. **Cada chat trabaja solo en su carpeta** (`somos-app-fN`). Nunca hace `git checkout` de otra rama ni toca la carpeta `somos-app` (que es `main`).
2. **`app/dashboard/psicologos/page.tsx` lo comparten F1 y F2.** Prohibido reorganizar, mover, reformatear o extraer código de ese archivo. F1 toca solo lo de bloqueos y el selector de centros; F2 solo el buscador, el operador, la visibilidad del formulario y las opciones de «¿Qué necesitas hoy?» del call center. Cambios mínimos y localizados.
3. **Migraciones:** cada bloque usa solo su número reservado (tabla de arriba), en `Supabase/migrations/` (fuera del repo). Si necesita más de una: `024b`, `024c`…
4. **No tocar el manual (artifact), la memoria ni este tablero desde las ramas.** Se actualizan en `main` en el momento del merge, de uno en uno.
5. **Antes de fusionar:** `git merge main` en la rama, resolver conflictos ahí, `npx tsc --noEmit`, tests y `npm run build`. Fusiones de una en una; la siguiente vuelve a traer `main`.
6. Cada bloque lleva sus notas en un archivo propio de su rama, `docs/fN-notas.md` (decisiones, cambios para Make/Dante, pruebas de aceptación). Al ser un archivo nuevo por bloque, no choca con nadie. Si cambia algo que otro bloque usa (formato de `/api/disponibilidad`, valores que se envían a Make), lo deja escrito ahí y se lo dice a Sonia.
