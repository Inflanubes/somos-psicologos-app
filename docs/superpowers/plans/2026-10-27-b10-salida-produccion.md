# B10 — Salida a producción: plan

> **For agentic workers:** este bloque es de coordinación, no de código. Se ejecuta con `superpowers:executing-plans` marcando casillas; cada paso de Supabase, Make o n8n lo hace Sonia a mano y lo autoriza en el chat.

**Goal:** Activar la app en las clínicas con todos los bloques terminados, Make y Dante alineados, el manual al día y el cliente informado de plazos.

**Spec:** este mismo documento (sección "Diseño"). Tareas del tablero: 58 (estimación a Jaime), 57 (arranque de consentimientos, procedimiento en `docs/arranque-consentimientos.md` de B4), 60 (prueba real de serie de citas); 52, 55 y 59 esperan al cliente o quedan fuera.

## Diseño

- **Regla del cliente:** no hay entregas parciales; la app se activa cuando B1–B9 están en `main`, desplegados y probados. Hasta entonces el equipo sigue como hoy.
- **Ventanas:** cada subida que toque Supabase, Make o Dante va de madrugada (4–5 h) o con Dante y Make parados. Las migraciones se aplican en orden y cada una se anota con fecha en su plan.
- **Agrupación de madrugadas [mi decisión]:** los bloques se despliegan en cuatro ventanas, no una por bloque, para reducir riesgo y noches: (1) B1 + B6 (migraciones 016 y 020, Make Baja médica), (2) B3 + B4 (017, 018, Make operador y reenvío de consentimiento), (3) B5 + B7 (019, 021, workflows de Dante y cron), (4) B8 + B9 + B2 (022, solo app). Si un bloque se retrasa, su ventana se mueve; las demás no.
- **Prueba de aceptación final:** un recorrido con Jaime (o Bea) por el guion de abajo, en la app desplegada, antes de dar la app por activa.
- **Fecha de activación:** por fijar con Jaime a partir de la estimación (tarea 58); el plan cuenta hacia atrás desde esa fecha cuando exista.

## Global Constraints

- Nada en Supabase de producción, Make ni n8n sin autorización de Sonia en el chat.
- Dante en producción: cualquier workflow se prueba en copia antes de importarlo.
- `Supabase/migrations/` y `n8n/` están fuera del repo: antes de tocar, copia en `_backups/` con fecha; anotar en el tablero qué archivos cambiaron.
- Cada subida: `npm run build` limpio en `main` antes de desplegar.

---

### Task 1: Estimación de plazos para Jaime (58)

- [ ] **Step 1: Actualizar la tabla** de abajo con lo que ya esté hecho en el momento de ejecutar este bloque (columna Estado) y las fechas que Sonia tenga.
- [ ] **Step 2: Enviar el texto** (está listo para pegar en un email; Sonia rellena las semanas según su agenda).

**Texto para Jaime (borrador, 27-10-2026):**

> Hola Jaime,
>
> Te paso el plan de trabajo con todo lo que salió de la reunión del 21 de octubre. Lo hemos ordenado en bloques; cada bloque se desarrolla, se prueba y se sube en una madrugada para no interferir con Dante ni con el equipo.
>
> | Bloque | Qué incluye | Trabajo | Subida |
> |---|---|---|---|
> | 1. Horarios por centro | Horario de cada psicólogo por clínica, interruptor "recibe citas nuevas" por clínica, sin horario no se agenda, reglas de antelación | 2–3 sesiones | madrugada 1 |
> | 2. Calendario propio | Calendario con huecos libres, colores por estado, clic para agendar, sin Google embebido | 3–4 sesiones | madrugada 4 |
> | 3. Reglas del call center | Qué puede y qué no puede hacer el call center, solicitudes al equipo, operador | 2 sesiones | madrugada 2 |
> | 4. Consentimiento informado | Firma, reenvío, marcar firmado en papel, menores y parejas | 2 sesiones | madrugada 2 |
> | 5. Dante: citas para terceros | Cita para otra persona, pareja desde Dante, máximo dos cambios por cita, reenviar consentimiento, sin "limbo" | 2–3 sesiones | madrugada 3 |
> | 6. Bloqueos | Menú de cinco opciones, "Baja médica" | 1 sesión | madrugada 1 |
> | 7. Avisos internos | Emergencias a Jaime y Bea a la vez, pasar una derivación a otra persona, recordatorio cada 30 min | 1–2 sesiones | madrugada 3 |
> | 8. Resumen y Actividad | Tus indicadores, fechas libres, filtro por clínica, gráficas con selector, perfil Inspección | 3 sesiones | madrugada 4 |
> | 9. Pequeños cambios | Accesos, Agentes, pie en los mensajes, estados documentados | 1 sesión | madrugada 4 |
> | 10. Salida | Prueba completa contigo, arranque de consentimientos, activación | 1 sesión + prueba | — |
>
> En total son unas 18–22 sesiones de trabajo y cuatro madrugadas de subida. A mi ritmo actual eso son [X] semanas: la activación podría ser la semana del [fecha]. Si algún bloque se retrasa, se mueve solo su madrugada.
>
> Dos avisos sobre los indicadores: la ocupación y las horas bloqueadas se calculan a partir del horario de cada psicólogo, así que solo serán fiables desde que todos tengan el horario cargado (bloque 1); y los pacientes anteriores a septiembre no tienen "canal de entrada", saldrán como "sin dato".
>
> Para seguir necesito de vosotros: los textos de las clínicas y las respuestas a preguntas frecuentes para Dante (8, 10), si una pareja son siempre una o dos personas en la ficha (40), qué estados del call center activamos (51), la decisión de Bea sobre nombre + iniciales (52), y qué era "algo de bloqueo en el calendario del psicólogo" que comentaste en la reunión (55). Lo que no llegue a tiempo se deja para después de la activación, sin bloquearla.
>
> Un saludo,
> Sonia

- [ ] **Step 3: Anotar en el tablero** la fecha de envío y, cuando Jaime conteste, la fecha de activación acordada.

### Task 2: Lista de comprobación antes de activar

Se marca al ejecutar B10; cada línea remite a su plan.

- [ ] Todos los bloques B1–B9 en `main` con `npm run build` limpio.
- [ ] Migraciones aplicadas en orden y con fecha en su plan: 016 (B1) · 017 (B3) · 018 (B4) · 019 (B5) · 020 (B6) · 021 (B7) · 022 (B8).
- [ ] Variables de entorno en producción: las de B1–B9 que cada plan liste (al menos `DANTE_API_TOKEN` de B1 y `MAKE_MENSAJES_WEBHOOK`).
- [ ] Make: apartados hechos por Sonia: operador (B3, `docs/make-cambios-2026-10-b3.md`), reenvío de consentimiento (B4, `docs/make-cambios-2026-10-b4.md`), Baja médica (B6, `docs/make-cambios-2026-10-b6.md`), rutas 6–9 del call center si el cliente las aprobó (`docs/make-cambios-2026-10-22.md`).
- [ ] Dante: workflows importados en producción: B1 (disponibilidad por centro), B5 (terceros), B7 (comandos y cron a 30 min); chats de Marta, Jaime y Bea en `agentes`.
- [ ] Horarios: todos los psicólogos activos con horario por centro cargado y revisado (B1 deja la lista de "revísalo").
- [ ] Accesos: usuario de cada agente, psicólogo y call center creado; perfil Inspección si lo piden.
- [ ] `CONTACTO_DANTE` (B9) apunta al canal real (Telegram hoy; WhatsApp cuando Meta apruebe).
- [ ] Manual republicado con las novedades de todos los bloques.
- [ ] Memoria de Claude actualizada (estado del tablero).

### Task 3: Prueba de aceptación con el cliente

- [ ] Agente: agendar, cambiar y cancelar una cita en cada centro; bloquear y desbloquear; dar de alta un paciente adulto, un menor y una pareja; ver el consentimiento llegar.
- [ ] Psicólogo (Jaime): entrar, ver solo su agenda, agendar dentro de horario, intentar fuera de horario (la app no deja), pedir vacaciones, recibir los Telegram de alta / cambio / anulación (tarea 54).
- [ ] Call center: solo lo permitido en B3; su panel con fechas libres.
- [ ] Dante: cita propia, cita para otra persona, segundo cambio avisa al equipo, tercer cambio se deriva, emergencia llega a Jaime y Bea, `atendido` cierra.
- [ ] **Serie de citas (60):** agendar una cita semanal de 4 sesiones desde la app → el paciente recibe **un** mensaje; cambiar una de la serie → un mensaje; cancelar la serie → un mensaje. Anotar fecha y resultado en el tablero.
- [ ] Resumen y Actividad: comprobar con Jaime dos o tres cifras contra Google Calendar.

### Task 4: Arranque de consentimientos (57) y activación

- [ ] Seguir `docs/arranque-consentimientos.md` (B4): listado de pacientes sin consentimiento, aviso a psicólogos, "Marcar firmado" para los de papel, "Reenviar" para el resto.
- [ ] Comunicar al equipo la fecha y el manual; a partir de ahí, las citas se hacen solo desde la app y Dante.
- [ ] Tablero: 57, 58, 60 → hecha; 52, 55, 59 siguen en "Esperando al cliente" / "futuro"; estado global → `activada (fecha)`.
