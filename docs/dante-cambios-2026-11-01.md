# Dante — 01-11-2026: arreglo de la consulta de huecos y pregunta «¿quién trabaja?»

Fecha: 01-11-2026. Sin rama: todos los cambios están en `n8n/`, que está fuera del repo y sin git. En la app (`somos-app`) no cambia nada. Importado en n8n y probado por Telegram el mismo día.

## Qué cambia para el equipo

- **Dante vuelve a consultar los huecos.** Desde que BuscarDisponibilidad se conectó a la app (B1, 29-10), todas las consultas de disponibilidad de Dante fallaban, y Dante acababa derivando con el motivo «la consulta de disponibilidad en tiempo real ha fallado». Así lo detectamos: una derivación de Jaime del 01-11 a las 12:45. Ahora Dante recibe los huecos reales.
- **«¿Qué profesionales hay / quién trabaja mañana en [centro]?»** Antes Dante derivaba al equipo. Ahora da los nombres de los psicólogos activos de ese centro, aclara que no sabe qué días trabaja cada uno y ofrece mirar las horas libres de ese día. No inventa horarios.

## 1. Consulta de huecos: la app contestaba «No autorizado» (401)

**Síntoma:** en la ejecución 617645 (01-11, 12:45), BuscarDisponibilidad recibió dos veces `HTTP 401 {"error":"No autorizado"}` de `POST https://app.somospsicologos.es/api/disponibilidad`. La app funcionaba bien: con los mismos datos y el token de `somos-app/.env.local` respondía 200 en 1–2 s.

**Causa:** `n8n/tools/build-workflow.mjs` escribía la cabecera `Authorization` en el formato del nodo HTTP normal (`headerParameters.parameters`). BuscarDisponibilidad es una **tool HTTP del agente** (`@n8n/n8n-nodes-langchain.toolHttpRequest` v1.1), que usa otro formato: `parametersHeaders.values` con `valueProvider`. Al importar, n8n descartaba el campo que no reconocía y dejaba `parametersHeaders.values = [{}]`. Esa fila vacía tenía dos efectos:
- La petición salía **sin token**, y la app contestaba 401.
- Aparecía un parámetro **sin nombre** que el modelo rellenaba con texto suelto: en la ejecución se ve `"": "Moratalaz"`.

Los otros nodos que llaman a la app (EjecutarAccion, ContactarAgente, RegistrarPaciente y Comando agente) son nodos Code que mandan la cabecera desde el código, y llevaban el token correcto.

**Arreglo** en `build-workflow.mjs`:

```js
delete node('BuscarDisponibilidad').parameters.headerParameters;
Object.assign(node('BuscarDisponibilidad').parameters, {
  // ...
  parametersHeaders: { values: [{ name: 'Authorization', valueProvider: 'fieldValue', value: 'Bearer ' + DANTE_API_TOKEN }] },
```

El `delete` es necesario porque el script lee y reescribe el mismo JSON: sin él, la clave antigua se quedaría.

**Comprobado:** tras importar, el nodo en n8n lleva la cabecera con el mismo token que la app, y en las conversaciones siguientes BuscarDisponibilidad devolvió huecos reales (p. ej. Prueba Psicologo, lunes 2/11 a las 9:00, 11:00, 12:00…).

> **Regla para el futuro:** en las tools HTTP del agente (`toolHttpRequest`), las cabeceras van en `parametersHeaders.values` con `valueProvider: 'fieldValue'`. Las tools de lectura que van a Supabase siguen con la apikey en la URL.

## 2. Instrucciones: «¿quién trabaja tal día?»

**Antes:** a «qué profesionales trabajan mañana, lunes 2 de noviembre, en Moratalaz», Dante derivaba al equipo («Dante no gestiona ni puede consultar la agenda/turnos de los psicólogos»). Ninguna herramienta le dice quién trabaja un día concreto, y las instrucciones le mandaban derivar cuando no podía resolver algo con certeza.

**Opciones que se valoraron:** dejarlo como estaba, cambiar solo las instrucciones, o crear una herramienta nueva en la app (qué psicólogos tienen horario ese día en ese centro). Sonia eligió **cambiar solo las instrucciones**. Añaden unos 150 tokens por mensaje y una llamada a ListarPsicologos solo cuando alguien hace esta pregunta.

**Cambios en `n8n/prompts/somos-system-prompt.md`:**
- En «Qué NO haces», una frase más: preguntar qué profesionales hay en un centro o quién trabaja un día **no** es gestionar la agenda, así que Dante lo responde él (apartado CONSULTAR DISPONIBILIDAD).
- En CONSULTAR DISPONIBILIDAD, la regla nueva: no derivar; llamar a [ListarPsicologos] con el centro y decir los nombres (filtrando por tipo de consulta si lo sabe); no afirmar ni inventar qué días trabaja cada uno; ofrecer «Si quieres, miro qué horas libres hay ese día» y, si el paciente acepta, llamar a [BuscarDisponibilidad] con `fecha_deseada` = ese día.

**Comprobado** (ejecución 617772): Dante llamó a ConsultarCentros y ListarPsicologos y contestó: «En Moratalaz atienden consultas de adultos: Jaime, Vega Marcos, Prueba de Psicólogo, Prueba Psicólogo. No puedo confirmar quién trabaja mañana solo con el listado, pero sí puedo mirar qué profesionales tienen horas libres. ¿Quieres que lo consulte?». No derivó.

## Archivos que cambian (fuera del repo, sin git)

| Archivo | Copia de antes |
|---|---|
| `n8n/tools/build-workflow.mjs` | `n8n/tools/_backups/2026-11-01-pre-cabecera-build-workflow.mjs` |
| `n8n/prompts/somos-system-prompt.md` | `n8n/prompts/_backups/2026-11-01-pre-profesionales-somos-system-prompt.md` |
| `n8n/workflows/somos-main-agent.json` (regenerado, 28 nodos) | `n8n/workflows/_backups/2026-11-01-pre-cabecera-somos-main-agent.json` |

Para regenerar el JSON: `DANTE_API_TOKEN=<valor de somos-app/.env.local> node n8n/tools/build-workflow.mjs`. En cada paso se comprobó que solo cambiaba el nodo previsto: BuscarDisponibilidad en el primer cambio y AI Agent en el segundo.

## Cómo revisar Dante la próxima vez

- **Clave de la API de n8n:** la que funciona es `N8N_API_KEY` del `.env` de la **carpeta raíz**. La de `somos-app/.env.local` está caducada y da 401.
- **Ver qué recibió y devolvió cada herramienta en una conversación:** `GET https://n8n.letsbebanana.com/api/v1/executions?workflowId=6nzKwBire02c9qx3&limit=10` para la lista, y `GET /api/v1/executions/<id>?includeData=true` para el detalle (en `data.resultData.runData`, cada tool con su entrada y su salida).
- **Después de cada importación**, comprobar que n8n tiene de verdad las instrucciones nuevas: `GET /api/v1/workflows/6nzKwBire02c9qx3` y comparar el `systemMessage` del nodo AI Agent con el JSON local. El 01-11 se importó primero una copia antigua y no se notó hasta comprobarlo.
