# B9 — Pequeños cambios de interfaz (diseño)

Fecha: 27-10-2026. Bloque B9 del tablero (tareas 30, 33, 37, 27). No depende de nada; vale para un chat corto. Decisiones con Sonia el 27-10; **[mi decisión]** = lo decidió Claude.

## Cómo funciona hoy (verificado el 27-10)

- Menú lateral: entrada "Usuarios" (`/dashboard/usuarios`, cuentas y contraseñas) y entrada "Agentes" (`/dashboard/agentes`: lista con nombre, email, teléfono, estado y botones `Enviar acceso`, `Generar contraseña`, `Activar/Desactivar`). El teléfono no se puede editar desde Agentes (sí desde Usuarios, vía `PATCH /api/usuarios/[id]` con `telefono`).
- Alta de paciente en Citas: casilla "Nueva recomendación" (`npEsRecomendado`, `es_paciente_recomendado`, estado `Revisar recomendado`).
- Mensajes salientes: Comunicaciones (agentes, `app/dashboard/mensajes/page.tsx`: lista de espera, dudosos, mensaje libre) y Mensajes (psicólogos, `mensajes-psicologo/page.tsx`: reseña Google y libre). Todos pasan por `POST /api/webhook/mensajes`, que reenvía el cuerpo tal cual a Make (`MAKE_MENSAJES_WEBHOOK`), con el texto en el campo `mensaje`.
- Manual: tabla "Estados del paciente" con tres filas "decisión pendiente" (Psicólogo, Dudoso, Psicólogo sin disponibilidad), que dependen de la tarea 51 (B3, espera cliente).

## Objetivos

1. **Accesos (30).** "Usuarios" pasa a llamarse **Accesos** en el menú, el título de la página, los textos de ayuda ("créala desde Accesos") y el manual. La ruta `/dashboard/usuarios` no cambia **[mi decisión]** (evita romper enlaces y la memoria del equipo).
2. **Agentes (30).** Desaparecen `Enviar acceso` y `Generar contraseña` de la página Agentes (siguen en Accesos). Se añade **editar teléfono** en la fila (lápiz → campo de texto → Guardar / Cancelar), usando `PATCH /api/usuarios/[id]` con `{ tipo: 'agente', telefono }`. Se mantiene `Activar/Desactivar`.
3. **Nueva recomendación (33).** La casilla se oculta tras una constante `MOSTRAR_RECOMENDACION = false` en `lib/flags.ts`; el código, el estado `Revisar recomendado` y la pestaña Recomendaciones de Comunicaciones se quedan (los pacientes que ya están en ese estado se siguen gestionando). El manual lo anota.
4. **Pie de los mensajes (37).** Todo mensaje que sale por `/api/webhook/mensajes` lleva al final, separado por una línea en blanco: `Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: {contacto}`. El contacto vive en `lib/mensajes-pie.ts` como `CONTACTO_DANTE`; **hoy** es el enlace del bot de Telegram de Dante (Sonia lo da al ejecutar; si no lo tiene a mano se deja el teléfono de la clínica `91 166 50 47`) y **al pasar a WhatsApp** se cambia por el número de WhatsApp de Dante. Se añade en el servidor (la API) para que valga para Comunicaciones y Mensajes a la vez y para no depender de cada plantilla **[mi decisión]**; la vista previa de cada pantalla muestra también el pie para que quien envía vea lo que llega.
5. **Estados en el manual (27).** Reescribir la tabla "Estados del paciente" con tres columnas: *Quién lo pone*, *Cuándo* y *Qué pasa después* (de qué pestaña sale, qué mensaje se manda), con lo verificado en código y en los blueprints de Make. Las tres filas pendientes de la tarea 51 se dejan marcadas como `decisión pendiente` hasta que el cliente conteste (si B3 ya está hecho al ejecutar B9, se completan con lo decidido allí).

## No objetivos

- Cambiar la plantilla de reseña ni los mensajes de lista de espera (solo se añade el pie).
- Mover la gestión de contraseñas de sitio: sigue en Accesos.
- Borrar el código de recomendaciones.

## Módulos y pantallas

- `lib/flags.ts`: `export const MOSTRAR_RECOMENDACION = false`.
- `lib/mensajes-pie.ts`: `CONTACTO_DANTE: string`, `PIE_MENSAJE(contacto)` → texto, `conPie(mensaje: string): string` (añade `\n\n` + pie; si el mensaje ya termina con el pie, no lo duplica). Test en `lib/mensajes-pie.test.ts`.
- `app/api/webhook/mensajes/route.ts`: `body.mensaje = conPie(body.mensaje)` si `typeof body.mensaje === 'string'`.
- `app/dashboard/mensajes/page.tsx` y `mensajes-psicologo/page.tsx`: la vista previa (textarea / texto de la plantilla) muestra `conPie(...)` en gris debajo del área editable, sin tocar el texto editable.
- `app/dashboard/agentes/page.tsx`: fuera `restablecer` y sus botones; dentro `editandoTelefono` (id), `telefonoNuevo`, `guardarTelefono(a)`.
- `SidebarNav.tsx`: `label: 'Accesos'`. `usuarios/page.tsx`: título y textos. `agentes/page.tsx`: tooltips "créala desde Accesos".
- Manual: secciones Usuarios → Accesos, Agentes, Citas (nota de recomendación oculta), Comunicaciones y Mensajes (pie), tabla de estados; Novedades.

## Textos

`Accesos` · `Editar teléfono` · `Guardar` · `Cancelar` · `Teléfono guardado.` · `No se pudo guardar el teléfono.` · `Mensaje solo informativo, no recibimos respuestas. Para cualquier cosa, contacta con Dante: {contacto}` · `Así llegará el mensaje:` (cabecera de la vista previa).

## Comprobación de aceptación

1. Menú: "Accesos" donde estaba "Usuarios"; la página sigue en `/dashboard/usuarios` y funciona.
2. Agentes: sin botones de contraseña; editar teléfono guarda y se ve al recargar; Accesos muestra el mismo teléfono.
3. Alta de paciente: no se ve "Nueva recomendación"; un paciente antiguo en `Revisar recomendado` sigue apareciendo en Comunicaciones.
4. Enviar un mensaje de reseña y uno de lista de espera: ambos llegan con el pie, una sola vez.
5. Manual: tabla de estados con tres columnas y sin huecos salvo los de la tarea 51.
