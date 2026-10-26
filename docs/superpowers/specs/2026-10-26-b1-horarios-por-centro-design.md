# B1 — Horarios por centro y reglas de agenda (diseño)

Fecha: 26-10-2026. Bloque B1 del tablero `docs/backlog-2026-10-21.md` (tareas 13, 28, 46, 47, 31). Decisiones tomadas con Sonia en la sesión del 26-10; lo marcado como **[mi decisión]** lo decidió Claude y Sonia puede cambiarlo.

## Por qué

Hoy el horario de un psicólogo es una lista de franjas por día **sin centro** (`horarios_psicologos`, migración 012, y desde la 014 una sola ficha por persona con N centros). Resultado que el cliente ha reproducido: Jaime puede tener una cita a las 10 en Moratalaz y otra a las 11 en San Blas, cosa físicamente imposible. Además:

- Si un psicólogo no tiene horario, la app lo trata como "sin restricción" y se le puede citar a cualquier hora; en la prueba del cliente la cita decía "realizada correctamente" y no aparecía.
- "Activo" apaga al psicólogo en todos los centros a la vez; el cliente necesita apagar un centro y mantener otro.
- Se puede agendar hoy a una hora ya pasada; el único veto es la fecha anterior a hoy. El psicólogo pide 2 h de antelación mínima.
- Los huecos que ofrece Dante los calcula un escenario de Make a partir de Google Calendar y **Make no lee los horarios de la app** (documentado en la migración 012 y comprobado en los blueprints exportados). Dante puede ofrecer horas fuera del horario del psicólogo.

## Objetivos

1. Cada franja de horario pertenece a un centro. Un psicólogo no puede tener dos franjas que se solapen el mismo día aunque sean de centros distintos. **Excepción (decisión de Sonia, 26-10):** el centro Online sí puede solaparse con una franja presencial (el psicólogo atiende por videollamada desde el despacho). Dos franjas Online tampoco pueden solaparse entre sí.
2. Interruptor "recibe citas nuevas" por psicólogo × centro, independiente del interruptor general.
3. Sin horario no se puede agendar (nadie es excepción: también los psicólogos solo online tienen horario).
4. Nadie puede agendar en el pasado. Antelación mínima de 2 h: bloqueante para psicólogo, call center y Dante; aviso para agentes.
5. Dante obtiene los huecos de la app (misma lógica que el formulario) y sigue agendando por Make como hasta ahora.
6. Agentes: por defecto solo ven las horas del horario; una casilla "Citar fuera de horario" muestra el resto (con aviso).

## No objetivos

- Pintar huecos libres en la vista Calendario, colores por estado, clic para rellenar, sustituir el iframe de Google, quitar "¿En qué centro vas a trabajar hoy?": todo eso es B2. B1 solo deja los datos y la lógica listos.
- Inactividad con fechas de inicio y fin: se descartó por ahora (interruptor simple). Si más adelante se quiere, se añaden `inactivo_desde` / `inactivo_hasta` a la misma tabla.
- Cambiar cómo Make agenda, cambia o cancela. Make no toca horarios.
- Tocar el escenario de Make de disponibilidad: se deja de usar desde Dante y se apaga cuando Sonia confirme.

## Modelo de datos (migración `016_horarios_por_centro.sql`)

```
horarios_psicologos
  + centro_id uuid NOT NULL REFERENCES centros(id)
  índice (psicologo_id, centro_id, dia_semana, hora_inicio)

psicologos_centros
  + activo boolean NOT NULL DEFAULT true   -- "recibe citas nuevas en este centro"

centros
  + es_online boolean NOT NULL DEFAULT false   -- la migración lo pone a true donde nombre ILIKE 'online'

vista psicologos_por_centro
  + centro_activo boolean (= psicologos_centros.activo)
```

Relleno de las filas existentes **[mi decisión]**: cada tramo actual se asigna al centro del psicólogo si solo tiene uno; si tiene varios, al primero por nombre de centro, y la migración imprime (`RAISE NOTICE` o `SELECT` final) la lista de psicólogos con varios centros para que un agente revise sus horarios en la ficha. La ficha muestra un aviso "Horario asignado automáticamente a {centro}: revísalo" hasta que alguien guarde el horario de ese psicólogo una vez (se detecta porque la migración deja `creado_en` anterior a su fecha de ejecución; alternativa más simple si el builder lo prefiere: columna `revisar boolean` que el guardado pone a false).

Idempotente, con `BEGIN/COMMIT`, comentario de contexto arriba, aplicable en el SQL Editor. Se aplica **de madrugada** o con Make y Dante parados (regla del método de trabajo).

## Reglas de disponibilidad (`lib/disponibilidad.ts`, módulo puro con tests)

Entradas nuevas: `centroId` de la cita, `tramos` ya filtrados por ese centro, `ahora` (instante en `Europe/Madrid`, inyectado para poder testear), `rol`.

Estados de hueco (ampliar `EstadoHueco`):

| Estado | Cuándo | Psicólogo / call center / Dante | Agente |
|---|---|---|---|
| `ocupado` | hay cita activa que solapa | no | no |
| `pasado` | fecha anterior a hoy, o hoy y hora ≤ ahora | no | **no** (único veto duro del agente) |
| `antelacion` | hoy y hora < ahora + 2 h | no | sí, con aviso "quedan menos de 2 h" |
| `bloqueado` | bloqueo de agenda cubre el día | no | sí, con aviso (como hoy) |
| `fuera_horario` | el psicólogo no tiene franja en ese centro que cubra el hueco, **o no tiene ninguna franja en ningún centro** | no | sí, con aviso, y solo visible con la casilla "Citar fuera de horario" |
| `centro_inactivo` | `psicologos_centros.activo = false` para ese centro, **solo en "Agendar cita"** | no (el psicólogo no aparece en el desplegable de ese centro al agendar) | sí, con aviso "no recibe citas nuevas en {centro}" |

**Alcance del interruptor de centro [mi decisión, tras la revisión]:** "Recibe citas nuevas" afecta solo a *Agendar cita* (es lo que pidió Jaime: "que no se le cite durante un par de semanas"). *Cambiar cita* y *Cancelar cita* de citas que ya existen en ese centro siguen permitidas para todos los roles; al cambiar, las franjas que valen son las del centro del formulario (comportamiento actual). Para el psicólogo logueado multicentro, el centro apagado sigue apareciendo en "¿En qué centro vas a trabajar hoy?" con la nota "(no recibe citas nuevas)"; dentro, no puede agendar pero sí cambiar o cancelar.
| `media_hora` | como hoy | como hoy | como hoy |

"Sin horario en ningún centro" se trata como `fuera_horario` en todos los huecos y además el formulario lo dice con un mensaje fijo: "{nombre} no tiene horario: pídele a un agente que lo defina en Psicólogos" (psicólogo/call center) o "{nombre} no tiene horario definido" (agente, puede seguir con la casilla).

`validarTramos` admite `centro_id` en cada tramo y recibe la lista de centros con su marca `es_online`. Rechaza solapes del mismo día entre centros **presenciales** y entre dos franjas del mismo centro (también Online con Online). Una franja Online puede solaparse con una presencial. Mensaje: "Los tramos del martes se solapan (San Blas 10:00–14:00 y Moratalaz 13:00–17:00)".

En el formulario de Citas, si la hora pedida cae en una franja presencial y en una Online a la vez, el centro del formulario decide: se usan las franjas del centro elegido y nada más. Una cita Online y una presencial a la misma hora **sí chocan** (`ocupado`): el solape de franjas solo amplía lo que se puede ofrecer, no permite dos citas a la vez.

`resumenHorario` agrupa por centro: `San Blas: L, X 10:00–14:00 · Online: M 16:00–20:00`.

El cálculo de "ahora" en Madrid y de "ahora + 2 h" va en `lib/` (hay helpers de zona horaria en `eventos-activos.ts` / `PanelCallCenter`; reutilizar o extraer uno común).

## Formulario de Citas (`app/dashboard/psicologos/page.tsx`)

- `cargarDatosDisponibilidad` recibe también `centroId` y carga solo las franjas de ese centro, más un indicador `tieneAlgunHorario` (franjas en cualquier centro) y `centroActivo`.
- Al cambiar de centro (agente/call center eligen centro; psicólogo multicentro con el selector actual) se recalcula.
- Modo restringido (psicólogo, call center): el desplegable de hora solo lista huecos `libre`. Si no hay ninguno por `fuera_horario` sin franjas, `centro_inactivo` o `pasado`, se muestra el mensaje fijo correspondiente en vez del desplegable.
- Modo aviso (agente): casilla **"Citar fuera de horario"** encima del desplegable, desmarcada por defecto. Desmarcada: solo `libre` (y `media_hora` si procede, como hoy). Marcada: todas las horas salvo `ocupado` y `pasado`, cada una con su etiqueta, y el aviso al enviar como hoy (`motivoAviso`), ampliado con los textos de `antelacion` y `centro_inactivo`.
- Veto duro para todos al enviar: `ocupado` y `pasado`.
- Series (repetir): las repeticiones se comprueban con las mismas reglas; `pasado` y `antelacion` no aplican a fechas futuras.
- Desplegable de psicólogos por centro: para call center y psicólogo, un psicólogo con el centro apagado no aparece en ese centro. Para agentes aparece con sufijo "(no recibe citas nuevas aquí)".

## Ficha de Psicólogos (`app/dashboard/equipo/*`, `HorarioEditor`, API `usuarios`)

- Editor de horario: selector de centro arriba (solo los centros del psicólogo); las franjas se editan por centro; al guardar se envían todas las franjas de todos los centros (`horarios: Tramo[]` con `centro_id`), para que la validación de solapes vea el conjunto. La API sustituye todas las filas del psicólogo como hoy.
- Bajo "Centros", por cada centro seleccionado, un interruptor "Recibe citas nuevas" que guarda `psicologos_centros.activo` (nuevo campo `centros_activos` en el PATCH, o `centro_ids` como lista de `{id, activo}`; **[mi decisión]** lista de objetos). Quitar un centro borra sus franjas (avisar con `confirm`).
- Tabla y ficha: "Sin horario" en rojo con texto "No se le pueden dar citas hasta que tenga horario". Un psicólogo activo sin horario también se destaca en la lista con un punto rojo.
- El aviso general `aviso_horarios` existente se mantiene.

## Vista Calendario (`app/dashboard/calendario`)

Solo lo mínimo para no romper: el sombreado de horas de trabajo al filtrar por psicólogo usa las franjas del centro filtrado si hay centro elegido, o todas sus franjas si no. El resto es B2.

## API de disponibilidad para Dante (`app/api/disponibilidad/route.ts`)

- `POST` con el mismo cuerpo que hoy manda la herramienta `BuscarDisponibilidad` de n8n: `{ tipo: "psicologo" | "centro", centro_id, psicologo_id?, fecha_deseada? }`. Misma respuesta: `{ psicologo_id, psicologo_nombre, huecos: [{ fecha, hora }] }` (el más próximo primero; horas en punto o y media según `citas_media_hora`). Si no hay huecos, `huecos: []`.
- Autenticación: cabecera `Authorization: Bearer <DANTE_API_TOKEN>` leída de una variable de entorno nueva; sin ella, 401. (Pendiente de seguridad general: ver memoria "Seguridad pendiente Supabase".)
- Lógica: `generarHuecos` con las franjas del centro, citas activas y bloqueos, desde `max(fecha_deseada, ahora + 2 h)` hasta 14 días vista **[mi decisión]**, máximo 10 huecos **[mi decisión]**. `tipo = "centro"`: entre los psicólogos del centro con `psicologos.activo`, `psicologos_centros.activo` y al menos una franja en ese centro, el que tenga el hueco más próximo (desempate por nombre). Opcional `tipo_consulta` para filtrar por `tipos_consulta`; si no viene, no filtra.
- Usa el cliente admin de Supabase (service role) porque Dante no tiene sesión.
- **Modo comprobar [mi decisión, tras la revisión]:** el mismo endpoint acepta `{ tipo: "comprobar", psicologo_id, centro_id, fecha, hora, excluir_accion_id? }` y responde `{ ok: true }` o `{ ok: false, motivo }` aplicando las reglas completas (franja del centro, no ocupado, no bloqueado, no pasado, +2 h, centro activo) sin el límite de 14 días ni de 10 huecos. Así "lo que Dante puede agendar" no queda limitado a la lista que se le ofreció.
- **Respuesta con motivo [mi decisión, tras la revisión]:** cuando `huecos` sale vacío, la respuesta lleva `motivo` (`sin_horario_en_centro` | `centro_inactivo` | `sin_huecos` | `psicologo_inactivo`) y, si el psicólogo tiene franjas en otros centros con hueco, `centros_alternativos: [{ centro_id, nombre, primer_hueco }]`. El prompt de Dante se amplía: si hay alternativas, las ofrece antes de registrar "Sin disponibilidad".
- n8n: la herramienta `BuscarDisponibilidad` cambia la URL al endpoint de la app y añade la cabecera. `ejecutar-accion.js`, antes de enviar a Make un "Agendar cita" o "Cambiar cita", llama al modo `comprobar` y rechaza (`ok: false`, con el `motivo` traducido a texto para el paciente) si no pasa. Así Dante no puede inventar horas. `ListarPsicologos` filtra además `centro_activo=eq.true`.
- Se regenera el workflow con `n8n/tools/build-workflow.mjs`; Sonia importa; se prueba en copia antes.

## Textos de interfaz (español, tono de la app)

- Casilla: "Citar fuera de horario"
- Avisos: "quedan menos de 2 horas para esa cita", "{nombre} no recibe citas nuevas en {centro}", "{nombre} no tiene horario definido"
- Error duro: "Esa hora ya ha pasado. Elige otra."
- Ficha: "Recibe citas nuevas", "Sin horario: no se le pueden dar citas"
- Mensaje para psicólogo/call center sin horario: "{nombre} no tiene horario: pídele a un agente que lo defina en Psicólogos."

## Lo que queda al builder

- Forma exacta del PATCH de centros con activo, y si `revisar` es columna o se deduce de fechas.
- Dónde vive el helper de "ahora en Madrid" (nuevo `lib/fechas.ts` o ampliar `eventos-activos.ts`).
- Si el endpoint de disponibilidad comparte un módulo `lib/disponibilidad-servidor.ts` con `cargarDatosDisponibilidad` (cliente) o duplica las consultas con el cliente admin. Preferible compartir la construcción de datos y que solo cambie el cliente de Supabase.
- Orden de las tareas del plan: migración y módulo puro primero; después ficha, formulario, API, Dante.
- Manual (`docs/manual-somos`): sección 5 "Horarios y disponibilidad" y ficha de Psicólogos se actualizan al final del bloque.

## Comprobación de aceptación (pruebas manuales al final)

1. Jaime con franja L 10–14 en Moratalaz y L 16–20 en San Blas: a las 10 solo se le puede citar en Moratalaz; a las 16 solo en San Blas; a las 15 nadie salvo un agente con la casilla marcada y aviso.
2. Intentar guardar L 10–14 Moratalaz y L 13–17 San Blas: la ficha rechaza por solape. L 10–14 Moratalaz y L 10–14 Online: la ficha lo admite; a las 11 se le puede citar en Moratalaz o en Online, pero no en los dos.
3. Apagar San Blas: el call center no ve a Jaime al elegir San Blas; sí en Moratalaz. El agente lo ve con sufijo y aviso.
4. Psicóloga sin horario: call center y psicóloga no pueden citar; agente sí con casilla; la lista de Psicólogos la marca en rojo.
5. Hoy a las 12:00: nadie puede citar a las 11:00; a las 13:00 solo el agente, con aviso; a las 14:30 todos.
6. Dante: pide huecos a la app y solo recibe horas dentro de franja, del centro correcto y con más de 2 h. Si el modelo intenta agendar una hora inventada, `EjecutarAccion` la rechaza.
