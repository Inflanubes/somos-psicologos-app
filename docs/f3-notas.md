# F3 — Pacientes, comunicaciones y usuarios (feedback v2, 05-11-2026)

Rama `f3-pacientes-comunicaciones` · carpeta `somos-app-f3` · migración **026**.
Tablero: `docs/backlog-2026-11-05-feedback-v2.md` (se actualiza en `main` al fusionar, no desde aquí).

## Estado de las tareas

| # | Tarea | Estado en la rama | Qué falta |
|---|---|---|---|
| 14 | Pacientes: subpestañas Parejas y Menores | hecha | pruebas de aceptación |
| 15 | Botones «Marcar "firmado en papel"» y «Desmarcar "firmado"» | hecha | — |
| 16 | Comunicaciones no muestra los pacientes de las solicitudes | parte de la app hecha; **la causa está en Make** (F4, tarea 19) | que Jaime repita la 3.6 |
| 17 | Botón para eliminar usuarios | hecha | **aplicar la migración 026** y pruebas |
| 18 | Pie de mensajes con el contacto de Dante | espera cliente | el número de Dante |

## 14 · Parejas y Menores

- Pacientes (solo agentes e inspección) tiene tres pestañas: **Todos** (la tabla de siempre), **Parejas** y **Menores**.
- **Parejas**: dos fichas enlazadas por `pareja_de` (en cualquier sentido) son una pareja. Una ficha con psicólogo de pareja y sin enlace sale sola, con «Segunda persona sin registrar en la app». Cada tarjeta: nombres, psicólogo de pareja, centro, el consentimiento de cada persona y el de la pareja (completo / faltan firmas / sin firmar). Con una sola persona registrada nunca sale «completo».
- **Menores**: cada menor con su tutor o tutores (`asociados_menores`), la firma de cada tutor (`T1_consentimiento`, `T2_consentimiento`) y el estado del consentimiento del menor. Si el tutor también es paciente, lo dice.
- El buscador de arriba también filtra estas pestañas (nombre o teléfono de cualquiera de las personas). El filtro de estado solo está en Todos.
- Solo lectura: reenviar y marcar se hace en Todos (así no hay dos sitios que actualizar).
- Código: `lib/entidades.ts` (+ tests), `app/dashboard/pacientes/EntidadesVista.tsx`; `page.tsx` carga `asociados_menores` solo para agentes.
- Comprobado con los datos reales del 05-11 (solo lectura): 4 parejas (una sin segunda persona) y 1 menor con dos tutores.

## 15 · Textos de los botones

`ConsentimientoAcciones.tsx`: `Marcar «firmado en papel»` y `Desmarcar «firmado»`; la confirmación dice «¿Marcar el consentimiento de X como firmado en papel?».

## 16 · Comunicaciones — diagnóstico

- La app **no** filtra por días: la pestaña muestra a todos los pacientes que están en el estado (el texto «más de 1 día» era solo descriptivo y engañaba; corregido).
- El estado lo pone **Make** (rutas 6, 7 y 8: `Sin disponibilidad`, `Psicólogo`, `Cambio solicitado`), no la app.
- Datos (solo lectura): las tres solicitudes de Jaime del **01-11 a las 13:35** (registro `formulario_citas_psicologos`, psicólogo «Prueba de Psicólogo», Moratalaz) **no cambiaron el estado de ningún paciente** (no hay fila en `historial_estados`). La del **02-11 08:51** (Cambio solicitado, `pepitogrillo`) **sí** lo cambió y el paciente está ahora en Comunicaciones › En espera › Cambio de psicólogo. Encaja con el arreglo de los módulos 76/71/65 del 01-11 (memoria «Upsert de Make y CHECK»): la prueba de Jaime pudo ser anterior al arreglo.
- **Para F4 (tarea 19):** revisar en Make las ejecuciones del 01-11 hacia las 13:35 de las rutas 6, 7 y 8 y comprobar que hoy, después del upsert, llega el Telegram. Si las rutas ya funcionan, basta con que Jaime repita la prueba 3.6.
- Cambio en la app para que se encuentre lo que se busca: las pestañas se llaman como los botones del call center (`Hablar con el psicólogo`, `Sin cita disponible`), el apartado «Cambio solicitado» de En espera se llama `Cambio de psicólogo`, y arriba hay una línea que dice dónde aparece cada solicitud (y que «Otros» solo avisa por Telegram).

## 17 · Eliminar usuarios

Decisiones de Sonia (05-11-2026):
1. Psicólogo con pacientes que no tienen otro psicólogo → **no se borra**; la app lista esos pacientes para reasignarlos en Pacientes › Editar.
2. Psicólogo con citas futuras → **se avisa y se deja borrar**: la confirmación dice cuántas tiene y que seguirán en su Google Calendar (no se avisa a los pacientes).
3. Agente / call center / inspección → se borra la cuenta; **lo que registraron se conserva** con su nombre.

- Accesos: botón rojo `Eliminar` en cada fila de las cuatro pestañas. Confirmación con el texto de Jaime: «¿Estás seguro de que quieres eliminar este usuario? Ten en cuenta que se eliminará todo su histórico de citas.» (en agentes, en su lugar: «Las citas y altas que registró se conservan con su nombre»). Nadie puede borrar su propia cuenta.
- API `app/api/usuarios/[id]/route.ts`: `GET ?tipo=psicologo` (pacientes que lo impiden + citas futuras) y `DELETE`.
- Psicólogo: función `eliminar_psicologo` (migración 026), todo en una transacción; después la API borra su cuenta de acceso. Lo que borra: citas y bloqueos (`acciones_psicologos`, `acciones_historial`, `acciones_call_center`), horarios y centros (en cascada), perfil y ficha. Lo que conserva: los pacientes (se le quita de su columna), su historial de estados (`psicologo_id` a null).
- Sin la 026 aplicada, borrar un psicólogo da «Falta aplicar la migración 026 en Supabase…»; borrar agentes funciona ya.
- Ningún trigger salta al borrar (los de 011 son AFTER INSERT/UPDATE): no se avisa a Make ni al calendario de Elias.

### Migración 026 (pendiente de aplicar)

`Supabase/migrations/026_eliminar_psicologo.sql`. Idempotente. Solo crea la función y le quita el permiso a `anon` y `authenticated`; no toca datos al aplicarla. Aplicar en el SQL Editor (de madrugada o con Make y Dante parados, regla del proyecto) y anotar aquí la fecha.

- [ ] 026 aplicada en producción (fecha: …)

## Make / Dante

- Nada cambia en lo que se envía a Make ni en `/api/disponibilidad`.
- Tarea 16 depende de F4 (tarea 19), ver arriba.

## Pruebas de aceptación

1. **Parejas** (agente): Pacientes › Parejas. Sale «parejaprueba3 y MujerdeParejaPrueba3» con el consentimiento de cada una. «pacientepruebapareja2…» sale sola con «Segunda persona sin registrar». Buscar por el teléfono de una de las dos personas encuentra la pareja.
2. **Menores**: Pacientes › Menores. «hijopacientepruebapareja» con Tutor 1 y Tutor 2 y «también es paciente». Marcar firmado en papel al menor en Todos → al recargar, en Menores salen firmados los tutores y «Consentimiento completo».
3. **Psicólogo**: entra un psicólogo en Pacientes → no ve las pestañas, solo su tabla.
4. **Botones**: en Pacientes › Todos, un pendiente dice `Marcar «firmado en papel»`; un firmado (agente) dice `Desmarcar «firmado»`.
5. **Comunicaciones**: desde el call center, «Hablar con el psicólogo», «Cambio de psicólogo» (y como agente «Sin cita disponible») sobre pacientes de prueba → a los pocos segundos salen en su pestaña / apartado. Si no salen, es Make (F4).
6. **Eliminar agente**: crear un agente de prueba en Accesos, `Eliminar` → confirma → desaparece y ya no puede entrar.
7. **Eliminar psicólogo bloqueado**: `Eliminar` a un psicólogo con un paciente que solo le tiene a él → mensaje con el nombre del paciente; no se borra nada.
8. **Eliminar psicólogo** (con la 026): psicólogo de prueba con una cita futura → la confirmación dice «1 cita futura…Google Calendar»; tras borrar, desaparece de Accesos, Psicólogos, Calendario y Citas, y no puede entrar.
9. **Uno mismo**: intentar borrar tu propia cuenta de agente → «No puedes eliminar tu propia cuenta».

## Manual (al fusionar en main)

- Pacientes: pestañas Todos / Parejas / Menores.
- Consentimiento: nuevos literales de los botones.
- Comunicaciones: nombres de pestañas y línea de ayuda.
- Accesos: botón Eliminar y sus reglas.
