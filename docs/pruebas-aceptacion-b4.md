# Pruebas de aceptación — Consentimiento informado (bloque B4)

Para el equipo de Somos Psicólogos. Cada prueba dice quién la hace, qué pasos seguir y qué tiene que verse.
Marcad cada una con ✅ o ❌ y, si falla, anotad qué se vio en lugar de lo esperado.

Antes de empezar: hace falta un paciente adulto de prueba, un paciente menor de prueba con dos tutores y otro
menor con un solo tutor, todos con teléfonos que sean chats de Dante en Telegram (si no, el enlace no llega).

## A. Reenviar el consentimiento (Pacientes)

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| A1 | Psicólogo | En **Pacientes**, en un paciente adulto con consentimiento «Pendiente», pulsar **Reenviar** y aceptar la pregunta «¿Enviar de nuevo el consentimiento a …?» | Aparece «Consentimiento reenviado.» y el paciente recibe por Telegram el enlace del consentimiento **de adultos** |
| A2 | Psicólogo | Lo mismo en un paciente **menor con dos tutores** | Los **dos tutores** reciben el enlace del consentimiento **de menores** |
| A3 | Psicólogo | Lo mismo en un menor **con un solo tutor** | Solo el tutor 1 recibe el enlace |
| A4 | Agente | **Reenviar** en un paciente que ya consta como **Firmado** | La pregunta cambia a «El consentimiento de … ya está firmado. ¿Enviarlo de nuevo igualmente?». Si se acepta, se envía igual |
| A5 | Agente | **Reenviar** en un paciente sin teléfono (ni él ni sus tutores) | Sale «Este paciente no tiene teléfono al que enviar el consentimiento.» y no se envía nada |
| A6 | Agente | En **Comunicaciones**, en cualquier pestaña | Cada paciente muestra su estado (Firmado / Pendiente) y el botón **Reenviar consentimiento**, que hace lo mismo que en Pacientes |

## B. Marcar firmado a mano y desmarcar

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| B1 | Psicólogo | En **Pacientes**, en un adulto «Pendiente», pulsar **Marcar firmado** y aceptar | La columna pasa a «Firmado a mano por *tu nombre* el *fecha de hoy*» |
| B2 | Agente | **Marcar firmado** en un menor con dos tutores | Igual que B1; además los dos tutores quedan como firmados |
| B3 | Psicólogo | Mirar un paciente marcado como firmado | **No** aparece el botón **Desmarcar** (solo lo tienen los agentes) |
| B4 | Agente | **Desmarcar** en un **adulto** firmado y aceptar | Vuelve a «Pendiente» y reaparece **Marcar firmado** |
| B5 | Agente | **Desmarcar** en un **menor** firmado | Pregunta «¿De qué tutor quitas la firma?» con el nombre de cada tutor y **Los dos**. Al elegir uno, el menor vuelve a «Pendiente» |
| B6 | Paciente de prueba | Tras un **Reenviar**, firmar el formulario de la web con el enlace recibido | Al cabo de unos minutos el paciente pasa a «Firmado» en Pacientes (sin «a mano») |

## C. Alta de pareja con segunda persona (Citas → Añadir nuevo paciente → tipo Pareja)

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| C1 | Agente o psicólogo | Alta de pareja **sin** rellenar «Segunda persona (opcional)» | Funciona exactamente como hasta ahora; se crea solo la primera persona |
| C2 | Agente o psicólogo | Alta de pareja con una segunda persona **nueva** (nombre y teléfono que no existen) | Sale «Pareja registrada: se ha creado la ficha de la segunda persona y se le ha enviado el consentimiento.» En **Pacientes** aparecen las dos como «Pareja: *psicólogo*» y la segunda recibe el enlace de adultos |
| C3 | Agente o psicólogo | Alta de pareja con una segunda persona que **ya era paciente** (mismo nombre y teléfono que su ficha) | Sale «Pareja registrada: la segunda persona ya era paciente y se ha vinculado a este psicólogo (no se le reenvía el consentimiento).» No se crea ficha nueva y no le llega ningún mensaje |
| C4 | Agente o psicólogo | Segunda persona que ya es paciente **de pareja de otro psicólogo** | La app avisa de que ya es paciente de pareja de *ese psicólogo* y no lo cambia; la primera persona sí queda creada |
| C5 | Agente o psicólogo | Rellenar solo el nombre **o** solo el teléfono de la segunda persona | «Indica nombre y teléfono de la segunda persona.» y no se crea nada |
| C6 | Agente o psicólogo | Segunda persona con el **mismo nombre y teléfono** que la primera | «La segunda persona no puede ser la misma que la primera.» y no se crea nada |
| C7 | Agente o psicólogo | Segunda persona con el **mismo teléfono** que la primera pero **otro nombre** (pareja que comparte móvil) | Se registra con normalidad (C2 o C3 según exista o no) |

## D. Menores y teléfonos compartidos

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| D1 | Psicólogo | Dar de alta a un **adulto** con el mismo teléfono que un **menor** ya registrado (su hijo) | No se bloquea ni avisa de repetido |
| D2 | Psicólogo | Dar de alta a un **menor** cuyo tutor 1 tiene el teléfono de un **adulto** ya registrado (su padre o madre) | No se bloquea ni avisa de repetido |

## E. Call center

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| E1 | Call center | Recorrer sus pantallas (Calendario, Panel, Citas) | En ninguna aparece el estado del consentimiento ni los botones Reenviar / Marcar firmado / Desmarcar. Pacientes y Comunicaciones no le aparecen en el menú |
| E2 | Call center | Alta de pareja en Citas | Sí ve el bloque «Segunda persona (opcional)» y funciona como en C1–C7 |

## F. Teléfonos que no son un chat de Telegram

Hasta que lleguen los mensajes por WhatsApp, el consentimiento solo llega a teléfonos que ya han escrito a Dante en Telegram. A un móvil normal no le llega nada, y es lo esperado. Lo que hay que comprobar es que ese envío fallido **no deja parado** el sistema de avisos.

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| F1 | Agente o psicólogo | Dar de alta en **Citas → Añadir nuevo paciente** a un adulto de prueba con un **móvil normal** (que no haya escrito nunca a Dante) | El alta se guarda y el psicólogo recibe su aviso de paciente nuevo por Telegram. Al paciente no le llega el consentimiento (normal hasta WhatsApp) |
| F2 | Agente | En **Pacientes**, **Reenviar** el consentimiento a ese mismo paciente | Aparece «Consentimiento reenviado.» No le llega nada (normal hasta WhatsApp) |
| F3 | Agente | Justo después, **Reenviar** el consentimiento al paciente adulto de prueba que **sí** es chat de Dante | Le llega el enlace. Si llega, los envíos fallidos de F1 y F2 no han parado nada |
| F4 | Be Banana | En Make, mirar las ejecuciones de F1 y F2 | El escenario sigue activo y los módulos de envío al paciente no lo han detenido |

