# Make — bloque B6 (bloqueos): «Baja laboral» pasa a «Baja médica»

Escenario: **Formulario Citas Psicologos**. Blueprint de referencia: `Make blueprints/Formulario Citas Psicologos.blueprint.json`
(exportado el 22-10-2026). Plan: `docs/superpowers/plans/2026-10-27-b6-bloqueos.md`.

## Estado

- **App: hecho** en la rama `b6-bloqueos` (31-10-2026). El menú nuevo de Citas no cambia nada de lo que llega a Make
  salvo el nombre de la baja: `datosProcesados.accion` pasa de `"Baja laboral"` a `"Baja médica"`. El resto de
  acciones (`Vacaciones`, `Asuntos propios`, `Modificar bloqueo personal`, `Bloquear agenda`, `Desbloquear agenda`)
  llegan con el mismo texto que siempre.
- **Supabase: migración `020_baja_medica.sql`** (renombra la etiqueta en cualquier enum que la tenga y actualiza las
  filas antiguas de `acciones_psicologos.motivo_bloqueo`, `acciones_historial` y `formulario_citas_psicologos`).
  `Aplicada el: 31-10-2026 (Sonia)`
- **Make:** `Hecho el: 31-10-2026 (Sonia)`

## Qué hay que tocar en Make (tres módulos, en la ruta de la baja)

| Módulo | Qué es | Hoy | Cambiar a |
|---|---|---|---|
| **106** «Crear bloqueo Google Calendar» | Filtro de la ruta (se llama «Baja laboral») | `1.datosProcesados.accion` *igual a* `Baja laboral` | Nombre del filtro `Baja médica`; condición `1.datosProcesados.accion` *igual a* `Baja médica` **O** *igual a* `Baja laboral` (ver nota) |
| **107** «Registrar acción · Bloquear agenda» (upsert en `acciones_psicologos`) | Campo `motivo_bloqueo` | `Baja laboral` (elegido del desplegable) | `Baja médica`, **elegido del desplegable después de pulsar *Refresh*** en el módulo (ver nota) |
| **113** Telegram al equipo | Texto | `… {{63.result.mensaje}} por baja laboral.` | `… {{63.result.mensaje}} por baja médica.` |

`accion` en el módulo 107 sigue siendo `Bloquear agenda`: no se toca.

**Nota sobre el filtro del 106.** Con las dos condiciones (unidas con *O*, es decir, en dos filas de la lista de
condiciones de Make), la ruta funciona tanto con la app de ahora como con la nueva, y no importa en qué orden se
despliegue. Sin la segunda condición, entre el cambio de Make y el despliegue de la app una baja no crearía nada (no
daría error: simplemente ninguna ruta se ejecutaría). Cuando la app nueva lleve unos días en producción se puede
quitar la condición `Baja laboral`.

**Nota sobre el 107.** Make trata `motivo_bloqueo` como una lista cerrada (enum) con los valores que leyó de la
base. Hasta pulsar *Refresh* tras la migración, esa lista sigue diciendo «Baja laboral» y puede rechazar «Baja médica»
escrito a mano. Si el 107 falla, el 106 ya habrá creado el evento «BLOQUEADO» en Google Calendar sin fila en la base ni
Telegram: por eso, Refresh y elegir del desplegable.

Los demás módulos que salen con «Baja laboral» en el blueprint (98, 101, 105, 207, 226, 241, 244, 247) solo lo
tienen en la lista de opciones que Make guarda del desplegable `motivo_bloqueo`; no envían ese valor y no hay que
tocarlos. Tras la migración, *Refresh* en cualquiera de ellos actualiza la lista.

## Orden de la madrugada (4–5 h)

- [x] 1. SQL Editor: ejecutar `Supabase/migrations/020_baja_medica.sql` tal cual. La consulta final debe dar **0** en
      todas las filas. Anotar la fecha arriba y en la cabecera de la migración.
- [x] 2. Make, **justo después del paso 1** (entre los dos, una baja de la app de ahora crearía el evento y fallaría
      al guardar): módulos 106, 107 y 113 como en la tabla. Guardar el escenario.
- [ ] 3. Merge de `b6-bloqueos` a `main` y despliegue de la app. No desplegar antes de la migración: la app nueva
      busca los bloqueos con «Baja médica» y, sin la migración, «Modificar un bloqueo» saldría vacío. Al revés pasa lo
      mismo con pestañas abiertas de la app vieja: pedir al equipo que recargue la página por la mañana.
- [ ] 4. Prueba con un agente en Citas: psicólogo de prueba → `Bloquear / Desbloquear agenda` → `Baja médica` → un día.
      Comprobar: el evento «BLOQUEADO» en su Google Calendar, la fila en `acciones_psicologos` con
      `motivo_bloqueo = Baja médica`, el Telegram «… por baja médica.» y que en Estadísticas cuenta como Baja médica.
      Después, `Desbloquear` (o borrar el bloqueo) para dejarlo como estaba.
- [ ] 5. Avisar a Elias: el calendario (somos.eltodi.net) recibe la fila de `acciones_historial` con `motivo_bloqueo`,
      que a partir de ahora dirá «Baja médica». Si su código busca el texto «Baja laboral», tiene que cambiarlo.
