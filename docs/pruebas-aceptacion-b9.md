# Pruebas de aceptación — Accesos, Agentes, pie de los mensajes y estados (bloque B9)

Para el equipo de Somos Psicólogos. Cada prueba dice quién la hace, qué pasos seguir y qué tiene que verse.
Marcad cada una con ✅ o ❌ y, si falla, anotad qué se vio en lugar de lo esperado.

Antes de empezar:

- Hacen falta un usuario agente y un psicólogo.
- Para las pruebas de mensajes, usad un **paciente de prueba cuyo contacto sea vuestro propio chat**, para que los
  mensajes os lleguen a vosotros y no a un paciente real.
- Al terminar, dejad el teléfono del agente de prueba como estaba.

## A. Accesos y Agentes

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| A1 | Agente | Mirar el menú lateral | Sale **Accesos** donde antes estaba «Usuarios» |
| A2 | Agente | Entrar en **Accesos** | El título dice «Accesos». Se pueden dar de alta personas y siguen los botones **Enviar acceso** y **Generar contraseña** en cada fila |
| A3 | Agente | Entrar en **Agentes** | Ya no salen **Enviar acceso** ni **Generar contraseña**. En cada fila están **Editar teléfono** y **Activar** / **Desactivar** |
| A4 | Agente | En un agente, pulsar **Editar teléfono**, escribir un número nuevo y pulsar **Guardar** | Sale «Teléfono guardado.» y la fila muestra el número nuevo |
| A5 | Agente | Recargar la página. Después, ir a **Accesos**, pestaña **Agentes** | El número nuevo sigue en Agentes y es el mismo que sale en Accesos |
| A6 | Agente | Pulsar **Editar teléfono**, cambiar el número y pulsar **Cancelar** | No cambia nada: se queda el número anterior |
| A7 | Agente | Pulsar **Editar teléfono**, borrar el número y pulsar **Guardar** | Sale «Teléfono guardado.» y la fila muestra «—». Volved a poner el número original |

## B. Alta de paciente sin «Nueva recomendación»

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| B1 | Agente y psicólogo | En **Citas**, elegir **Añadir nuevo paciente** | Ya no aparece la casilla «Nueva recomendación». El resto del formulario está igual |
| B2 | Agente | Dar de alta un paciente de prueba y buscarlo en **Pacientes** | Su estado es «Nuevo paciente» |
| B3 | Agente | Abrir **Comunicaciones**, pestaña **Recomendaciones** | Siguen saliendo los pacientes antiguos que estaban pendientes de revisar (si había alguno) y se pueden resolver como siempre |

## C. Pie de los mensajes

El pie que tiene que llegar es exactamente:
«Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: 91 166 50 47»

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| C1 | Agente | En **Comunicaciones**, pestaña **En Espera**, mirar el mensaje estándar de cada estado | Debajo del texto de siempre, separado por una línea en blanco, se ve el pie |
| C2 | Agente | Enviar el mensaje de En Espera al paciente de prueba | El mensaje llega con el pie **una sola vez** al final |
| C3 | Agente | En la pestaña **Dudosos**, escribir un mensaje a un paciente de prueba | Debajo del cuadro aparece «Así llegará el mensaje:» con vuestro texto y el pie. Al enviarlo, llega igual |
| C4 | Agente | En la pestaña **Sin disponibilidad**, mirar el mensaje del paciente de prueba y pulsar **Mover a En espera** | El mensaje que se ve lleva el pie; el que llega, también |
| C5 | Psicólogo | En **Mensajes**, elegir el paciente de prueba y enviar **Solicitar reseña** | La vista previa y el mensaje que llega llevan el enlace de reseñas y, al final, el pie |
| C6 | Psicólogo | En **Mensajes**, escribir un **Mensaje libre** y enviarlo | Aparece «Así llegará el mensaje:» con el texto y el pie; llega igual |
| C7 | Agente | En la pestaña **Hablar con Psicólogo**, pulsar **Notificar psicólogo** con un psicólogo de prueba | El aviso le llega **al psicólogo** y **sin** el pie (es un aviso interno, no va a un paciente) |
| C8 | Agente | Enviar dos veces seguidas un mensaje al paciente de prueba (por ejemplo, Enviar a todos dos veces en En Espera) | Cada mensaje lleva el pie una sola vez, nunca repetido |

## D. Manual

| # | Quién | Pasos | Qué tiene que pasar |
|---|---|---|---|
| D1 | Cualquiera | Abrir el manual, apartado **El viaje de una cita › Estados del paciente** | La tabla tiene cuatro columnas: Estado, Quién lo pone, Cuándo y Qué pasa después. Solo «Psicólogo», «Dudoso» y «Psicólogo sin disponibilidad» siguen marcados como «decisión pendiente» |
| D2 | Cualquiera | Leer **Novedades** | La primera entrada del 31-10-2026 cuenta el cambio a Accesos, el teléfono en Agentes, el pie de los mensajes y que la casilla de recomendación ya no se muestra |

## Pendiente para la salida a producción

El texto del pie se queda así mientras los mensajes salgan por el chat de Dante. Al pasar a WhatsApp se revisará
el texto y el contacto (tarea 37b), porque «no recibimos respuestas» solo será exacto con un número que no conteste.
