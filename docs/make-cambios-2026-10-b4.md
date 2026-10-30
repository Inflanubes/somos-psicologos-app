# Make — bloque B4 (consentimiento informado): ruta «Reenviar consentimiento»

Escenario: **Formulario Citas Psicologos** (el mismo de `make-cambios-2026-10-22.md` y
`make-cambios-2026-10-b3.md`). Blueprint de referencia: `Make blueprints/Formulario Citas Psicologos.blueprint.json`
(exportado el 22-10-2026).

## Estado

- **App: hecho** en la rama `b4-consentimiento` (30-10-2026).
- **Supabase: migración `018_consentimiento_manual.sql`** (`pacientes`: `consentimiento_origen`,
  `consentimiento_marcado_por`, `consentimiento_marcado_en`, `pareja_de`). La aplica Sonia de madrugada.
  `Aplicada el: ______`
  **Aplicar la migración antes de desplegar la app.** Si la app sale antes, las pantallas cargan igual (leen con
  `select('*')`), pero «Marcar firmado», «Desmarcar» y el alta de pareja con segunda persona fallan al guardar
  con un error visible hasta que esté la migración.
- **Make: pendiente de Sonia.** `Hecha el: ______`

## Qué manda la app

Botón `Reenviar` en Pacientes (agentes y psicólogos) y `Reenviar consentimiento` en Comunicaciones (agentes).
El call center no tiene estos botones. Llega al mismo webhook que todas las acciones de Citas, con:

```
mensaje:              "Formulario Web Psicólogos"
respuestasFormulario: { "¿Qué necesitas hoy?": "Reenviar consentimiento" }
datosProcesados:
  psicologo_id      uuid del psicólogo de referencia del paciente (el primero que tenga: adultos, pareja, infantil)
                    ← imprescindible: el módulo 3 busca el psicólogo por este id antes del router, y el router
                      solo enruta si lo encuentra. Sin él no se ejecutaría ninguna ruta.
  psicologo_nombre  texto o null
  centro_id         uuid o null
  accion:           "Reenviar consentimiento"      ← texto exacto, filtrar por este campo (como la ruta 14)
  paciente_id       uuid
  paciente_nombre   texto
  telefono          texto o null (adulto: su móvil; menor: el del tutor 1)
  es_menor          true / false
  enlace            "https://www.somospsicologos.es/consentimiento/"
                    o "https://www.somospsicologos.es/consentimiento-menores/"  (ya elegido según es_menor)
  tutor1_nombre, tutor1_telefono   texto o null (solo menores)
  tutor2_nombre, tutor2_telefono   texto o null (solo menores con dos tutores)
  created_by, created_by_id, origen   quién lo pidió ("agente" / "psicologo")
```

La app **no** envía nada si el paciente no tiene teléfono (ni él ni sus tutores): avisa en pantalla y no llama al
webhook. Así que a Make siempre llega al menos un teléfono.

Si el paciente no tuviera ningún psicólogo (no debería: la base lo exige), `psicologo_id` llegaría a null y la
ejecución se quedaría en el módulo 3 como cualquier otra acción sin psicólogo.

No se escribe nada en `pacientes` ni en `acciones_psicologos`: es solo un envío.

## Qué hay que crear en Make

Una **ruta nueva en el router principal** (hermana de la ruta 14 «Añadir paciente», que filtra con
`{{1.datosProcesados.accion}}` = `Añadir nuevo paciente`):

| Paso | Módulo | Detalle |
|---|---|---|
| Filtro de la ruta | — | `{{1.datosProcesados.accion}}` **text:equal** `Reenviar consentimiento` |
| 1 | Router | Dos ramas: **Adulto** (`{{1.datosProcesados.es_menor}}` = `false`) y **Menor** (`= true`) |
| 2a | Telegram → Send a Reply Message (conexión «Dante Bot SPs», como el módulo 254) | Chat ID `{{1.datosProcesados.telefono}}`. Texto: el del módulo 254 cambiando la URL fija por `{{1.datosProcesados.enlace}}` |
| 2b | Telegram → Send a Reply Message (como el módulo 250) | Chat ID `{{1.datosProcesados.tutor1_telefono}}`. Texto: el del módulo 250 con `{{1.datosProcesados.enlace}}` |
| 2c | Telegram → Send a Reply Message (como el módulo 251), con filtro «Si hay T2»: `{{1.datosProcesados.tutor2_telefono}}` **exists** | Chat ID `{{1.datosProcesados.tutor2_telefono}}`. Texto: el del módulo 251 con `{{1.datosProcesados.enlace}}` |

Texto sugerido (es el de hoy, con el enlace variable):

```
{{1.datosProcesados.paciente_nombre}} le recordamos que para poder asistir a su cita es necesario que
rellene el consentimiento que encontrará en el siguiente enlace {{1.datosProcesados.enlace}}

Es requisito indispensable para asistir a la misma.

Te esperamos pronto!
```

(Para tutores, empezar por `{{1.datosProcesados.tutor1_nombre}}` / `{{1.datosProcesados.tutor2_nombre}}` y
«… por su o sus tutores», como en 250/251.)

Notas:
- **Canal:** hoy Telegram (solo llega si ese «teléfono» es un chat de Dante). Cuando Meta apruebe la cuenta, esta
  ruta pasa a WhatsApp igual que la 14; la app no cambia.
- **Dante (B5, tarea 6)** reutilizará esta misma acción con el mismo payload: no hace falta otra ruta.
- Opcional: un aviso a los agentes por Telegram («Consentimiento reenviado a X por Y») con `created_by`.
- Si se quiere apuntar el reenvío en `acciones_psicologos`, hacerlo con `accion = Reenviar consentimiento`,
  `paciente_id` y `created_by`; la app no lo necesita.

## Alta de pareja con segunda persona (sin cambios en Make)

Al dar de alta una pareja con «Segunda persona (opcional)», si la segunda persona no existía la app crea su
ficha y manda **otra** acción `Añadir nuevo paciente` (ruta 14 de siempre) con sus datos: `tipo_consulta =
pareja`, `es_menor = false`, `email`, `fecha_nacimiento` y `edad` a `null`, y un campo extra `pareja_de` (id de la
primera persona) que Make puede ignorar. La ruta 14 ya le manda el consentimiento de adulto a su teléfono.
Si la segunda persona ya era paciente, no se manda nada a Make (solo se le vincula en Supabase).

Comprobar que la ruta 14 **no falla con `fecha_nacimiento` y `edad` a null**. Según el blueprint del 22-10
la ruta 14 **no escribe en `pacientes`** (el módulo 213 busca en `agentes`, el 214 avisa al equipo y los
250/251/254 mandan el enlace), así que no hay riesgo de upserts cruzados entre dos personas con el mismo móvil;
solo hay que confirmar que ningún módulo de esa rama exige esos dos campos.
