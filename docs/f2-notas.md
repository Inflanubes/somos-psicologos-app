# F2 Call center — notas del bloque

Rama `f2-call-center` · carpeta `somos-app-f2` · migración reservada 025 (**no se ha usado**: F2 no necesita cambios en la base de datos).
Fuente: `docs/Feedback IA v2.docx` (raíz del proyecto), puntos 3.3, 3.4 y 4.7. Tablero: `docs/backlog-2026-11-05-feedback-v2.md`, tareas 10–12.

## Decisiones

- **Tarea 11 solo para el call center.** El documento de Jaime lo dice así: 3.3 habla del «panel callcenter» y 3.4 de «evitar errores por parte del call center». Agentes y psicólogos siguen con el formulario de antes.
- **Supuesto 1 o 2**: se mira si el paciente tiene alguna cita **no anulada**, pasada o futura (`acciones_psicologos`, `accion = 'Agendar cita'`, `activo = true`). Si todas sus citas se anularon, cuenta como supuesto 2 (nunca llegó a tener cita).
- **Psicólogo y centro fijados**: los de su próxima cita activa o, si no tiene, los de su ficha (lo que ya hacía «Usar en el formulario»). Si no se pueden fijar (por ejemplo, la ficha no tiene psicólogo o el psicólogo está desactivado), sale el aviso de siempre y los campos quedan libres para elegirlos a mano.
- **Persona nueva (supuesto 3)**: el botón solo aparece cuando el teléfono está completo (9 dígitos o más), para no dar de alta con un trozo de número. Si hay resultados pero ninguno es la persona que llama (otro familiar con el mismo teléfono), está «No es ninguno: es una persona nueva».
- **Operador (tarea 10)**: se vacía después de **cada** acción que sale bien (alta, cita, cambio, anulación, solicitud o aviso). Deja de recordarse en el navegador: varios operadores usan el mismo usuario a la vez. Al abrir la página se borra el nombre que se hubiera guardado antes.
- Después de cada acción el call center vuelve al primer paso: buscador vacío y formulario oculto. Si cambia el número del buscador, el formulario también se oculta.
- Un clic en el calendario o un enlace desde Calendario solo rellena el formulario si el call center ya ha buscado al paciente y es el mismo psicólogo, centro y paciente. Si no, sale un aviso que explica por qué.

## Qué ve el call center

| Paso | Qué se ve | Opciones de «¿Qué necesitas hoy?» |
|---|---|---|
| 0 | Solo el buscador por teléfono y una nota: «Empieza por el teléfono…» | — |
| Supuesto 1: ya ha tenido cita | Centro, psicólogo y paciente bloqueados | Agendar cita · Cambiar cita · Cancelar cita · Hablar con el psicólogo · Cambio de psicólogo · Otros (aviso al equipo) |
| Supuesto 2: ficha sin citas | Centro, psicólogo y paciente bloqueados | Agendar cita · Cambio de psicólogo o centro · Otros (aviso al equipo) |
| Supuesto 3: persona nueva | Centro y psicólogo libres | Añadir nuevo paciente (con el teléfono ya puesto; si es menor, también como teléfono del tutor 1) · Otros (aviso al equipo) (sin centro, psicólogo ni paciente) |

Tarea 12, para todos los roles: en el alta, «Nombre completo de la persona citada (si es menor, el nombre del menor)» y «Fecha de nacimiento de la persona citada».

## Cambio necesario en Make (avisar a F4 / Sonia)

**«Otros» de una persona que aún no es paciente.** La app envía `accion = 'Otro'` con `paciente_id = null`, `paciente_iniciales = null`, `psicologo_id` y `centro_id` vacíos, y dos campos nuevos en `datosProcesados`:

- `telefono`: el número que buscó el operador.
- `sin_ficha`: `true`.

Hoy la ruta «Otro» (router 5, ruta 9, en el blueprint *Formulario Citas Psicologos*) empieza con **[87] Buscar paciente** por `paciente_id`. Sin paciente, esa búsqueda no devuelve filas y **no llega el Telegram**. Cambio propuesto:

1. Detrás del filtro «Otro», poner un **router** con dos rutas:
   - **Con ficha**, filtro `1.datosProcesados.paciente_id` *existe*: los módulos de ahora ([87] Buscar paciente → [68] Busca agente → [69] Telegram), sin cambios.
   - **Sin ficha**, filtro `1.datosProcesados.paciente_id` *no existe*: [Busca agente] (copia del 68) → Telegram (copia del 69) con este texto:

   ```
   Hola {{68.nombre}}!

   Una persona que aún no es paciente (teléfono {{1.datosProcesados.telefono}}) ha llamado al call center: {{1.datosProcesados.comentario}}{{if(1.datosProcesados.operador; " Operador: " + 1.datosProcesados.operador; "")}}
   ```

   (En la copia, `68` pasa a ser el número del nuevo módulo «Busca agente».)
2. Volver a aprender el webhook (o añadir `telefono` y `sin_ficha` a la estructura) para que Make vea los campos nuevos.

**Hecho por Sonia el 05-11-2026** y revisado en el blueprint exportado: el If-else [304] va justo detrás del filtro «Otro». La rama «Es paciente» (`paciente_id` *exists*) lleva [87] → [68] → [69]; la rama Else lleva [295] → [296] con el texto del teléfono. No hizo falta volver a aprender el webhook: Make lee `telefono` al ejecutarse aunque no esté en la estructura. Falta la prueba real (prueba 5 de abajo), que confirmará también que un `paciente_id` vacío va por la rama Else.

No cambia nada más de lo que se envía a Make: las demás acciones mandan los mismos valores que antes.

## Pruebas de aceptación (usuario call center)

1. Al entrar en Citas solo se ve el buscador y la nota. No se ve el formulario.
2. Escribir el teléfono de un paciente que ya ha tenido cita → «Usar en el formulario». Centro, psicólogo y paciente salen rellenos y grises (no se pueden cambiar). El menú tiene las 6 opciones del supuesto 1.
3. Paciente con ficha pero sin ninguna cita → mismo bloqueo; menú con Agendar cita, «Cambio de psicólogo o centro» y Otros.
4. Teléfono que no existe (número completo) → «Continuar: es una persona nueva». Menú con «Añadir nuevo paciente» y Otros. En «Añadir nuevo paciente» el teléfono ya está puesto; con una fecha de nacimiento de menor, el teléfono del tutor 1 sale relleno con ese número.
5. En el supuesto 3, «Otros» sin centro ni psicólogo: escribir el comentario y enviar. Sale «Solicitud enviada al equipo» y llega a los agentes el Telegram «Una persona que aún no es paciente (teléfono …)». Un «Otros» de un paciente existente sigue llegando con su nombre.
6. Con 4–8 dígitos no aparece el botón de persona nueva; aparece «Escribe el teléfono completo…».
7. Con resultados, «No es ninguno: es una persona nueva» lleva al supuesto 3.
8. Escribir el operador, agendar una cita: al terminar, el operador está vacío, el buscador vacío y el formulario oculto. Recargar la página: el operador sigue vacío.
9. Con un paciente elegido, cambiar el número del buscador: el formulario se oculta.
10. Sin haber buscado, clic en un hueco libre del calendario: aviso «Busca primero el teléfono del paciente». Con un paciente elegido, clic en un hueco de otro psicólogo: aviso de que va con su psicólogo.
11. Agente: el formulario es el de siempre (centro y psicólogo libres, todas las opciones). En el alta, los textos nuevos de nombre y fecha de nacimiento.

## Para el manual (al fusionar en main)

- Call center: formulario por pasos (los tres supuestos de la tabla), el operador se vacía tras cada acción, y «Otros» para personas que aún no son pacientes.
- Todos: textos nuevos del alta (nombre y fecha de nacimiento de la persona citada).
