# Estudio de riesgo: paciente con varios psicólogos y una sola ficha por psicólogo

Fecha: 2026-09-26 (revisión 2, tras aclaraciones de Sonia). Estado: análisis previo a la
especificación.

## 1. Qué se propone

- **Cambio A — Paciente con varios psicólogos por tipo de consulta.** `pacientes.psicologo_id`
  pasa a tres columnas: `psicologo_adultos_id`, `psicologo_pareja_id`, `psicologo_infantil_id`.
  El alta pide tipo de consulta (adultos / pareja; menor se deduce de la fecha de nacimiento),
  los duplicados se juzgan con ese tipo, y un tutor puede ser un paciente ya existente (enlace
  por id en `asociados_menores`).
- **Cambio B — Una sola ficha por psicólogo.** Una fila en `psicologos` con `centros` (varios) y
  `tipos_consulta` (varios). Las citas y los horarios guardan `centro_id`.

## 2. Premisas confirmadas (26-09-2026)

- **Todos los datos actuales son de prueba y se pueden borrar.** No hay que fusionar fichas ni
  migrar histórico: se vacían las tablas, se ejecuta el modelo nuevo y se recrean los psicólogos
  de prueba. Esto elimina el mayor riesgo del cambio B.
- **`pacientes.telefono` = chat id de Telegram cuando el alta la hace Dante.** Es deliberado:
  Dante identifica al paciente por `telefono = chat_id` (herramientas ConsultarPaciente,
  RegistrarPaciente, EjecutarAccion), y Make envía las confirmaciones a ese campo como chat id.
  Cuando Dante pase a WhatsApp, el campo volverá a ser el teléfono real. **No se crea columna
  aparte.** Consecuencia para el cambio A: la regla "mismo teléfono" funciona igual en ambos
  casos; solo hay que tener en cuenta que un chat id nunca coincidirá con un teléfono tecleado en
  la app, así que durante la fase Telegram un paciente registrado por Dante y el mismo dado de
  alta desde la app no se detectarán como duplicados. Aceptado como limitación temporal.
- **Make puede seguir buscando por nombre + centro (módulo 3)** si se crea una vista
  `psicologos_por_centro` (una fila por psicólogo × centro, con `id` = id del psicólogo,
  `nombre`, `centro`, `centro_id`, `calendar_id`, `telefono`). Para Make y para Dante es
  indistinguible de la tabla actual. Hay que comprobar en Make que el módulo Supabase lista
  vistas además de tablas (un minuto). Si no las lista, se cambia el módulo 3 a buscar por `id`
  (la app y Dante ya conocen el id del psicólogo).
- **Elias**: se le avisa de que los ids de psicólogo cambian (datos nuevos) y de que llega
  `centro_id` en cada aviso. Sin tabla de equivalencias, porque no hay histórico que conservar.

## 3. Quién depende de qué

### 3.1 De "una ficha de psicólogo por centro" (cambio B)

| Sistema | Hoy | Con el cambio |
|---|---|---|
| App: `lib/centro-activo.ts` y formulario de Citas | Elegir "centro" = elegir ficha (`psicologoId` + `centroId`) | Elegir centro entre `psicologos.centros`; un solo id |
| App: `lib/disponibilidad-datos.ts` | Horarios de la ficha; citas de todas las fichas de la persona | Horarios por (psicólogo, centro); citas por psicólogo |
| Supabase: `horarios_psicologos` (012) | Una fila por ficha (= por centro) | Añadir `centro_id` |
| Supabase: `acciones_psicologos`, `acciones_historial` | No guardan centro | Añadir `centro_id`; la app y Dante lo envían; Make lo escribe (14, 42, 98, 101, 105, 107, 226) |
| App: `/dashboard/calendario` | Centro desde la ficha | Centro desde la cita |
| App: estadísticas | Agrupa fichas por nombre | Se simplifica |
| App: `/dashboard/usuarios` y `api/usuarios` | Alta = N filas con el mismo `calendar_id` | Una fila con lista de centros y tipos |
| Supabase: `perfiles.psicologo_id` | Primera ficha | Única ficha |
| Make, módulo 3 | Busca `nombre` + `centro` (texto) | Igual, sobre la vista `psicologos_por_centro` |
| Make, 41/201/204 y textos Telegram | `3.centro_id`, `3.centro` | Igual (la vista los devuelve) |
| Dante, `ListarPsicologos` | `psicologos?centro_id=eq.X` | Misma consulta sobre la vista |
| Dante, `RegistrarPaciente` | Exige `psico.centro_id === centroId` | Comprobar que el centro está en `centros` (o consultar la vista) |
| Dante, `ConsultarPsicologo`, `EjecutarAccion` | Leen `centro` de la ficha y lo envían a Make | Con varios centros hay que elegir uno: el de la cita (preguntar o tomar el del paciente) |
| Elias | Recibe `psicologo_id` | Ids nuevos + `centro_id`; avisar |
| Datos | Fichas por centro | Se borran y se recrean |

### 3.2 De `pacientes.psicologo_id` (cambio A)

| Sistema | Hoy | Con el cambio |
|---|---|---|
| App: desplegable de pacientes en Citas, "Mis pacientes", contadores, mensajes | `psicologo_id = X` | Cualquiera de las tres columnas = X |
| App: duplicados en el alta | Solo teléfono | Reglas por tipo (§4) |
| Make, 41/201/204 | Escriben `pacientes.psicologo_id = 3.id` en cada cita | Dejar de escribirlo |
| Dante, `RegistrarPaciente` | Copia la lógica de la app | Replicar las reglas nuevas y la columna por tipo |
| Make "Cto general" | Busca pacientes por nombre + teléfono | No cambia |
| Elias | Recibe la fila de `pacientes` | Columnas nuevas, inofensivo |

## 4. Reglas nuevas de duplicados (cambio A)

| Caso | Regla |
|---|---|
| Menor (por fecha de nacimiento) | Sin teléfono propio ("El contacto será el teléfono del tutor 1"). Duplicado = mismo nombre + misma fecha de nacimiento. |
| Adulto, pareja, mismo teléfono que un paciente de otro psicólogo | Aviso "Está en adultos con X, ¿es la misma persona?". Sí → se **vincula** la ficha existente (`psicologo_pareja_id`), no se crea otra. No → ficha nueva. |
| Adulto, adultos, mismo teléfono | Aviso fuerte "Ya existe con X, ¿seguro que es para adultos?". Misma mecánica. |
| Mismo teléfono + mismo nombre | Bloqueo + aviso al equipo, con el texto "Revisa los datos y vuelve a crearlo; el equipo está avisado; si sigue fallando y es correcto, contacta con nosotros". No se crea nada. |

## 5. Riesgos no contemplados hasta ahora

1. **El tipo de consulta está hoy en el nombre del psicólogo** ("MARTA - PAREJAS",
   "BEA - ADULTOS"). Con `tipos_consulta` en la ficha, los nombres pasan a ser solo nombres. Make
   busca por nombre: mientras app, Dante y tabla usen el mismo texto no hay problema, pero hay que
   renombrar a la vez en los tres sitios. Los títulos de Calendar y los Telegram usan `3.nombre`;
   cambian de aspecto, no de funcionamiento.
2. **Coherencia tipo de consulta ↔ tipo de cita.** Usar los mismos valores en todo:
   `adulto` / `pareja` / `menor` (los de `tipo_cita`). El formulario de Citas debe ofrecer solo
   los tipos que el psicólogo tiene, y el vínculo del paciente solo puede apuntar a un psicólogo
   que tenga ese tipo. Validarlo en la app y en Dante.
3. **`pacientes.centro_id` pierde sentido** cuando un paciente tiene psicólogos en centros
   distintos. Propuesta: conservarlo como "centro principal" (el del alta) y no usarlo para
   decidir nada. Dante lo usa en RegistrarPaciente; Make lo escribe en 41/201/204.
4. **El centro de cada cita tiene que viajar en el envío.** Hoy Make recibe el centro solo como
   texto (`Selecciona tu centro`). Hay que añadir `centro_id` a `datosProcesados` en la app y en
   Dante, y mapearlo en los siete upserts de acciones. Si se olvida uno, el calendario mostrará
   esas citas sin centro.
5. **Dante con un psicólogo de varios centros.** Hoy elige psicólogo y el centro viene dado. Con
   B tendrá que preguntar el centro (o tomar el `centro_id` del paciente) antes de agendar. Es un
   cambio en el prompt y en `EjecutarAccion`, no solo en las consultas.
6. **Horarios por centro.** Si un psicólogo tiene horarios distintos en cada centro, el alta de
   horarios en `/dashboard/usuarios` pasa a pedirlos por centro; la disponibilidad en Citas debe
   filtrar por el centro elegido. Es el cambio de app más grande de B.
7. **Borrado de datos mientras Make y Dante están activos.** Hay que desactivar el escenario de
   Make y el workflow de n8n durante la migración, vaciar también la cola del webhook, y avisar a
   Elias para que vacíe su lado. Los eventos de prueba de Google Calendar quedan; borrarlos a mano
   o ignorarlos.
8. **Cuentas de acceso.** `perfiles` apunta a `psicologos.id`. Al recrear psicólogos, o se
   recrean las cuentas desde `/dashboard/usuarios` (que ya crea Auth + perfil + ficha) o se
   actualiza `perfiles.psicologo_id` a mano.
9. **Tests existentes.** `lib/*.test.ts` (horarios, disponibilidad, calendario) asumen ficha por
   centro; hay que actualizarlos, no solo el código.
10. **Vista para Make.** Si el módulo Supabase de Make no lista vistas, el módulo 3 y las
    consultas de Dante pasan a buscar por `id`. No es grave, pero hay que saberlo antes de
    diseñar.

## 6. Recomendación (revisada)

Con datos borrables, **A y B se pueden hacer en el mismo cambio**, en este orden dentro del
mismo trabajo, con Make y Dante parados durante la migración:

1. Migración 014: vaciar tablas de prueba; `psicologos` con `centros uuid[]`, `tipos_consulta
   text[]`; vista `psicologos_por_centro`; `centro_id` en `acciones_psicologos`,
   `acciones_historial` y `horarios_psicologos`; tres columnas de psicólogo en `pacientes`;
   `T1_paciente_id` / `T2_paciente_id` en `asociados_menores`. Actualizar el trigger de historial
   y el aviso a Elias para incluir `centro_id`.
2. App: alta de psicólogo (centros, tipos, horarios por centro), selector de centro, Citas
   (tipo de cita limitado, `centro_id` y `paciente_id` en el envío), alta de paciente (tipo de
   consulta, duplicados, tutor existente, texto de teléfono en menores), "Mis pacientes",
   calendario y disponibilidad por centro de la cita.
3. Make: mapear `centro_id` en los siete upserts; quitar `psicologo_id` de 41/201/204;
   comprobar que el módulo 3 funciona sobre la vista.
4. Dante: `RegistrarPaciente` (reglas nuevas, columna por tipo), `ListarPsicologos` sobre la
   vista, elección de centro en `EjecutarAccion`.
5. Elias: aviso de ids nuevos y de `centro_id`.
6. Recrear psicólogos de prueba desde `/dashboard/usuarios` y probar el ciclo completo.

## 7. Decisiones pendientes

- Terapia de pareja: ¿el vínculo "pareja" lo tiene uno de los dos miembros o los dos? (Afecta a
  qué ficha se elige al agendar.)
- Tutor que ya es paciente: ¿se copian nombre y teléfono desde su ficha y se enlaza el id, o solo
  se enlaza?
- Nombres de psicólogos sin el sufijo de tipo ("MARTA" en vez de "MARTA - PAREJAS"): ¿se
  renombran en este cambio?
