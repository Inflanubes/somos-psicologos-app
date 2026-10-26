# Método de trabajo entre chats

Para que cualquier chat (o agente) pueda retomar el trabajo donde lo dejó el anterior, sin releer transcripciones ni repetir análisis, y gastando el mínimo de contexto.

## Las tres piezas

1. **Tablero**: `docs/backlog-2026-10-21.md`. Una fila por tarea con estado, bloque y notas. Es el único sitio donde vive el estado. Se actualiza al cerrar cada chat.
2. **Un plan por bloque**: `docs/superpowers/plans/YYYY-MM-DD-bN-<tema>.md`. Pasos con casillas (`- [ ]`) que se marcan al hacerlos. Se escribe cuando el bloque va a empezar, no antes (el código cambia y un plan viejo engaña).
3. **Memoria de Claude**: una nota apunta al tablero (`project_reunion_cliente_2026_10_21.md` en la memoria del proyecto). Así Claude lo encuentra aunque no se le diga.

## Cómo se abre un chat

Sonia escribe una de estas dos frases (basta con eso):

- **Para planificar un bloque:** `Planifica el bloque B3 según docs/metodo-trabajo.md`
- **Para ejecutar un bloque ya planificado:** `Continúa con el bloque B1 según docs/metodo-trabajo.md`

El chat entonces, en este orden y sin leer nada más hasta que haga falta:

1. Lee `docs/metodo-trabajo.md` (este archivo).
2. Lee en `docs/backlog-2026-10-21.md` **solo la sección del bloque** y la tabla de orden (para ver dependencias y estado).
3. Si es planificar: lee el código que toca ese bloque, hace las preguntas que necesite a Sonia, y escribe el plan con la skill `superpowers:writing-plans`. Deja en el tablero el enlace al plan. Termina ahí: no implementa.
4. Si es ejecutar: lee el plan del bloque, busca la primera casilla sin marcar y sigue desde ahí con `superpowers:executing-plans` o `superpowers:subagent-driven-development`. No reanaliza lo que ya está en el plan.

Un chat = un bloque. Si un bloque es grande, se puede partir en dos chats: el plan tiene las casillas y el segundo chat sigue donde se quedó el primero.

## Cómo se cierra un chat (obligatorio, aunque se cierre a medias)

Antes de terminar, el chat deja escrito:

1. En el plan: casillas marcadas hasta donde llegó. Si una tarea quedó a medias, una línea debajo con "**Quedó así:** …" (qué archivo, qué falta, qué está sin probar).
2. En el tablero: estado de las tareas tocadas (`en curso` / `hecha` / `verificar`) y, si descubrió algo, una nota corta en la columna Notas.
3. Commit en la rama del bloque con mensaje en español (`git commit`), aunque sea trabajo parcial. Sin commit no hay continuidad: el siguiente chat parte de lo que hay en git.
4. Si cambió algo que el cliente ve: entrada en el manual (`docs/manual-somos`) o nota en el tablero de que falta hacerla.

Si el chat se corta de golpe sin poder cerrar, el siguiente empieza por `git status` y `git log -3` en la rama del bloque y compara con las casillas del plan.

## Reglas fijas del proyecto (valen para todos los bloques)

- Rama por bloque: `b1-horarios-por-centro`, `b2-calendario-propio`, … creada desde `main`. Al terminar el bloque, merge a `main`.
- Cada tarea termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde.
- Lógica de decisión en módulos puros de `lib/` con tests Vitest; las pantallas solo los llaman.
- Fechas: `Europe/Madrid`, `YYYY-MM-DD` como texto, nunca `new Date('YYYY-MM-DD')`.
- Textos de interfaz en español, tono cálido y profesional.
- Migraciones de Supabase: numeradas en `Supabase/migrations/`, idempotentes, con comentario de contexto arriba. Se aplican a mano en el SQL Editor y se anota la fecha en el plan.
- Cambios en Make: Sonia los hace a mano. El plan deja un apartado "Make" con qué módulo tocar y qué campos, como en `docs/make-cambios-2026-10-22.md`.
- Cambios en Dante: editar `n8n/prompts/` y `n8n/tools/`, regenerar con `n8n/tools/build-workflow.mjs`, y Sonia importa el JSON. Dante está en producción: probar en un workflow copia antes de importar.
- **Subidas a producción solo de madrugada (4–5 h)** o con Dante y Make parados: el 20-10 una subida a las 22:05 dejó a Dante sin base de datos mientras el cliente probaba.
- No se hace nada en Supabase de producción ni en Make sin que Sonia lo autorice en ese chat.

## Qué NO hacer (consume contexto y no aporta)

- No releer la transcripción del PDF: la lista ya está en el tablero. Solo si una tarea del tablero no se entiende.
- No leer planes de otros bloques salvo que el tablero diga que hay dependencia.
- No escribir planes de bloques que no van a empezar en ese chat.
- No resumir al final del chat lo que ya está en el plan y el tablero: con marcar casillas y actualizar estado basta.
