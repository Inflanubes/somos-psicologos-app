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

- [x] **Step 1: Actualizar la tabla** de abajo con lo que ya esté hecho en el momento de ejecutar este bloque (columna Estado) y las fechas que Sonia tenga. Hecho 31-10-2026: el borrador del 27-10 hablaba de bloques por hacer y cuatro madrugadas; a 31-10 los nueve bloques están en `main` y sus migraciones (016–022) aplicadas, así que el texto pasa a ser «desarrollo terminado, queda probar y activar». El borrador antiguo queda en el historial de git.
- [ ] **Step 2: Enviar el texto** (está listo para pegar en un email; Sonia pone la fecha de la prueba conjunta y la de activación).

**Texto para Jaime (actualizado, 31-10-2026):**

> Hola Jaime,
>
> Te cuento cómo va todo lo que salió de la reunión del 21 de octubre: **el desarrollo está terminado**. Los nueve bloques están hechos y subidos, con los cambios de base de datos, Make y Dante aplicados.
>
> | Bloque | Qué incluye | Estado |
> |---|---|---|
> | 1. Horarios por centro | Horario de cada psicólogo por clínica, interruptor "recibe citas nuevas" por clínica, sin horario no se agenda, reglas de antelación | hecho |
> | 2. Calendario propio | Calendario con huecos libres, colores por estado, clic para agendar, sin Google embebido | hecho |
> | 3. Reglas del call center | Qué puede y qué no puede hacer el call center, solicitudes al equipo, operador | hecho |
> | 4. Consentimiento informado | Firma, reenvío, marcar firmado en papel, menores y parejas | hecho |
> | 5. Dante: citas para terceros | Cita para otra persona, pareja desde Dante, máximo dos cambios por cita, reenviar consentimiento | hecho |
> | 6. Bloqueos | Menú de cinco opciones, "Baja médica" | hecho |
> | 7. Avisos internos | Emergencias a ti y a Bea a la vez, pasar una derivación a otra persona, recordatorio cada 30 min | hecho |
> | 8. Resumen y Actividad | Tus indicadores, fechas libres, filtro por clínica, gráficas con selector, perfil Inspección | hecho |
> | 9. Pequeños cambios | Accesos, Agentes, pie en los mensajes, estados documentados | hecho |
> | 10. Salida | Prueba completa contigo, arranque de consentimientos, activación | pendiente |
>
> Lo que queda antes de activar la app en las clínicas:
>
> 1. **Pruebas internas** de cada bloque en la app real (las hacemos nosotras esta semana).
> 2. **Una prueba completa contigo (o con Bea)**, de una hora más o menos: agendar, cambiar y cancelar citas, altas de adulto, menor y pareja, bloqueos, Dante y los paneles. ¿Te viene bien el [fecha]?
> 3. **Que cada psicólogo tenga su horario cargado por clínica**: sin horario la app no deja agendarle. Los indicadores de ocupación y horas bloqueadas salen de ese horario, así que serán fiables desde que esté completo. Los pacientes anteriores a septiembre no tienen "canal de entrada" y saldrán como "sin dato".
> 4. **Arranque de consentimientos**: los pacientes actuales saldrán con el consentimiento pendiente. Avisaremos a los psicólogos; los que lo firmaron en papel se marcan con un botón y al resto se les reenvía.
>
> Con eso, la activación podría ser el [fecha].
>
> Sigo necesitando de vosotros: los textos de las clínicas y las respuestas a preguntas frecuentes para Dante (8, 10), si una pareja son siempre una o dos personas en la ficha (40), qué estados del call center activamos (51), la decisión de Bea sobre nombre + iniciales (52), y qué era "algo de bloqueo en el calendario del psicólogo" que comentaste en la reunión (55). Nada de esto bloquea la activación: lo que no llegue se hace después.
>
> Un saludo,
> Sonia

- [ ] **Step 3: Anotar en el tablero** la fecha de envío y, cuando Jaime conteste, la fecha de activación acordada.

### Task 2: Lista de comprobación antes de activar

Se marca al ejecutar B10; cada línea remite a su plan.

- [x] Todos los bloques B1–B9 en `main` con `npm run build` limpio. Comprobado 31-10-2026 en la rama `b10-salida-produccion` (sale de `main` f31a8b3): tsc limpio, 241/241 tests, build OK.
- [x] Migraciones aplicadas en orden y con fecha en su plan: 016 (B1) · 017 (B3) · 018 (B4) · 019 (B5) · 020 (B6) · 021 (B7) · 022 (B8). Comprobado 31-10-2026: las siete constan como aplicadas en su plan y en el tablero (016 el 29-10, 017 el 30-10, 018–022 el 31-10).
- [ ] Variables de entorno en producción: las de B1–B9 que cada plan liste (al menos `DANTE_API_TOKEN` de B1 y `MAKE_MENSAJES_WEBHOOK`).
  **Quedó así (31-10):** el código lee siete variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DANTE_API_TOKEN`, `MAKE_CALL_CENTER_WEBHOOK`, `MAKE_PSYCHOLOGIST_WEBHOOK`, `MAKE_MENSAJES_WEBHOOK`. `DANTE_API_TOKEN` verificado en producción el 29-10; las demás las confirma Sonia en el panel del hosting (desde aquí no se ve).
- [x] Make: apartados hechos por Sonia: operador (B3, `docs/make-cambios-2026-10-b3.md`), reenvío de consentimiento (B4, `docs/make-cambios-2026-10-b4.md`), Baja médica (B6, `docs/make-cambios-2026-10-b6.md`), rutas 6–9 del call center si el cliente las aprobó (`docs/make-cambios-2026-10-22.md`).
  **Quedó así (31-10):** operador (B3), reenvío de consentimiento (B4) y Baja médica (B6) hechos por Sonia el 31-10. Rutas 6–9: Make listo desde el 22-10; en la app solo «Otro» activa hasta que Jaime diga cuáles encender (tarea 51; una línea en `ACCIONES_SOLICITUD_ACTIVAS` de `lib/call-center.ts`). No bloquea la activación.
- [x] Dante: workflows importados en producción: B1 (disponibilidad por centro), B5 (terceros), B7 (comandos y cron a 30 min); chats de Marta, Jaime y Bea en `agentes`.
  **Quedó así (31-10):** B1 importado el 29-10, B5 importado el 31-10, chats de los cuatro agentes en `agentes` (021). B7 importado por Sonia el 31-10 por la tarde; sus pruebas P1–P7 van en el documento de Jaime.
- [ ] Horarios: todos los psicólogos activos con horario por centro cargado y revisado (B1 deja la lista de "revísalo").
- [ ] Accesos: usuario de cada agente, psicólogo y call center creado; perfil Inspección si lo piden.
- [x] **Pie de los mensajes (B9, tarea 37b del tablero).** Decisión de Sonia del 31-10-2026: mientras los mensajes salgan por Telegram se queda como está (`Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: 91 166 50 47`). Al pasar a WhatsApp, revisar con Sonia:
  - El contacto: cambiar `CONTACTO_DANTE` en `lib/mensajes-pie.ts` por el número de WhatsApp de Dante (o el que se decida).
  - El texto: hoy el paciente recibe el mensaje en el chat de Telegram de Dante (conexión «Dante Bot SPs» del escenario «SPs envio mensajes») y si contesta ahí le responde Dante, así que «no recibimos respuestas» solo será exacto cuando salgan de un número de WhatsApp que no conteste.
  - Si cambia el texto: actualizar el test `lib/mensajes-pie.test.ts`, el manual (fichas Comunicaciones y Mensajes) y la prueba C de `docs/pruebas-aceptacion-b9.md`.
  - Al cambiar el contacto, los mensajes ya enviados con el pie antiguo no importan (el pie solo se añade al enviar).
- [ ] Manual republicado con las novedades de todos los bloques. **Reabierto 31-10 tarde:** `index.html` actualizado con las cuatro solicitudes del call center (check OK); falta republicar tras el merge. Antes: Versión 24 del artifact (31-10-2026, con B9); B10 no cambia nada que el cliente vea.
- [ ] Memoria de Claude actualizada (estado del tablero).

### Task 3: Prueba de aceptación con el cliente

**Antes, las pruebas internas pendientes** (Sonia decidió el 30-10 hacerlas todas juntas al final; cada bloque pasa de `verificar` a `hecha` en el tablero cuando pasan):

| Bloque | Dónde está el guion | Pruebas | Resultado |
|---|---|---|---|
| B1 Horarios | plan B1 (`superpowers/plans/2026-10-26-b1-horarios-por-centro.md`) | 6 pruebas de aceptación | |
| B2 Calendario | plan B2 (`superpowers/plans/2026-10-26-b2-calendario-propio.md`) | 1–7 | |
| B3 Call center | plan B3 (`superpowers/plans/2026-10-26-b3-reglas-call-center.md`) | 1–7 | |
| B4 Consentimiento | `docs/pruebas-aceptacion-b4.md` | 1–5 | |
| B5 Dante terceros | `docs/dante-cambios-2026-10-b5.md` §3 | guion §3 | |
| B6 Bloqueos | `docs/pruebas-aceptacion-b6.md` | todas (falta la 4) + avisar a Elias | |
| B7 Avisos internos | `docs/dante-cambios-2026-10-b7.md` | P1–P6 + tarea 5 (tras importar los JSON) | |
| B8 Paneles | `docs/pruebas-aceptacion-b8.md` | A–F | |
| B9 Pequeños cambios | `docs/pruebas-aceptacion-b9.md` | 1–5 | |

Después, el recorrido con Jaime o Bea:

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
