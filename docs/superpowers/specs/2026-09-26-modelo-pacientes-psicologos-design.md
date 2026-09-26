# Especificación: paciente con varios psicólogos y una sola ficha por psicólogo

Fecha: 2026-09-26. Estado: **APROBADA EN CONVERSACIÓN, PENDIENTE DE REVISIÓN DEL DOCUMENTO.
NO IMPLEMENTAR HASTA QUE SONIA LO INDIQUE.**

Documento hermano: `2026-09-26-modelo-pacientes-psicologos-riesgos.md` (estudio de riesgo).

## 0. Guía para retomar el trabajo en otra sesión

- Todo lo decidido está en este documento; no hay decisiones fuera de él.
- Orden de trabajo cuando Sonia dé luz verde: §8 "Plan de ejecución". Cada paso deja el
  sistema funcionando por separado.
- La migración 014 **borra pacientes, citas e historial** (datos de prueba) y las fichas de
  psicólogo sin calendario. **Conserva** los psicólogos reales (los que tienen `calendar_id`),
  fusionando sus fichas por centro en una sola, y también agentes, perfiles, centros y
  horarios. Las cuentas de acceso no se tocan.
- Make y el agente Dante (n8n) se paran durante la migración y se reactivan al final.
- Elias (`somos.eltodi.net`) recibe aviso de que llega `centro_id` en cada aviso y la tabla
  `migracion_014_ids` con las fichas fusionadas (`id_antiguo → id_nuevo`); el resto de ids de
  psicólogo no cambia.
- Contexto de arquitectura previo: memoria del proyecto y `docs/make-cambios-2026-09-25.md`.

## 1. Objetivo

1. Un paciente puede tener hasta tres psicólogos, uno por tipo de consulta: adultos, pareja,
   infantil.
2. Un psicólogo es **una sola ficha** aunque pase consulta en varios centros y de varios tipos.
3. El alta de paciente distingue por fecha de nacimiento y tipo de consulta, y detecta duplicados
   con criterio en vez de bloquear por teléfono.
4. Un tutor de un menor puede ser un paciente que ya existe.
5. Cada cita guarda el centro donde se atiende.

## 2. Decisiones cerradas (con Sonia, 26-09-2026)

| Tema | Decisión |
|---|---|
| Tipos de consulta | Tres valores en todo el sistema: `adulto`, `pareja`, `menor` (los de `tipo_cita`). "Infantil" = `menor`. |
| Psicólogo | Una fila en `psicologos`. Centros en tabla `psicologos_centros`. Tipos en `psicologos.tipos_consulta text[]`. Un solo `calendar_id`. Nombre sin sufijo de tipo ("Marta", no "MARTA - PAREJAS"). |
| Horarios | Por psicólogo, no por centro. `horarios_psicologos` no cambia. |
| Centro de la cita | Nueva columna `centro_id` en `acciones_psicologos` y `acciones_historial`. Lo envían app y Dante; lo escribe Make. El calendario filtra por él. |
| Paciente | Tres columnas: `psicologo_adultos_id`, `psicologo_pareja_id`, `psicologo_infantil_id`. `psicologo_id` se elimina. `centro_id` se conserva como "centro del alta". |
| Pareja | Cada miembro tiene su ficha. La cita de pareja se agenda sobre uno de los dos con `tipo_cita = pareja`. Sin vínculo entre fichas. |
| Menor | Sin teléfono propio: el campo muestra "El contacto será el teléfono del tutor 1" y `pacientes.telefono` se rellena con el del tutor 1. Tutores como hasta ahora. |
| Tutor existente | Se copian nombre, teléfono y correo a T1/T2 de `asociados_menores` y además se guarda `T1_paciente_id` / `T2_paciente_id`. |
| Duplicados | Ver §5. Cuando el usuario confirma "es la misma persona", se **vincula** la ficha existente (se rellena la columna del tipo), no se crea otra. |
| `pacientes.telefono` | Sigue siendo teléfono (app) o chat id de Telegram (Dante, fase de pruebas). Sin columna nueva. |
| Make, módulo 3 | Busca el psicólogo por `id` (`datosProcesados.psicologo_id`, nuevo en el envío). |
| Dante | Filtra psicólogos con la vista `psicologos_por_centro`; agenda en el `centro_id` de la ficha del paciente; solo pregunta el centro si ese psicólogo no está en él. |
| Datos | Se borran pacientes, citas e historial de prueba y las fichas de psicólogo sin calendario. Los psicólogos reales y los agentes se conservan; las fichas duplicadas por centro se fusionan en una (sobrevive la que apunta el perfil) y sus centros pasan a `psicologos_centros`. |

## 3. Modelo de datos (migración 014)

### 3.1 `psicologos`

| Columna | Cambio |
|---|---|
| `centro_id`, `centro` | **Se eliminan** (pasan a `psicologos_centros`). |
| `tipos_consulta text[] NOT NULL DEFAULT '{}'` | Nueva. Valores permitidos: `adulto`, `pareja`, `menor` (CHECK). |
| resto (`nombre`, `email`, `telefono`, `calendar_id`, `activo`, `puede_bloquear`, `citas_media_hora`, `auth_user_id`, `google_review_url`) | Sin cambios. |

### 3.2 `psicologos_centros` (nueva)

```
psicologo_id uuid NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE
centro_id    uuid NOT NULL REFERENCES centros(id)
PRIMARY KEY (psicologo_id, centro_id)
```

### 3.3 Vista `psicologos_por_centro` (nueva)

Una fila por psicólogo × centro, con las columnas que hoy tiene la tabla `psicologos`:
`id` (= `psicologos.id`), `nombre`, `email`, `telefono`, `calendar_id`, `activo`,
`tipos_consulta`, `centro_id`, `centro` (nombre del centro). Para Dante (`ListarPsicologos`) y
como red de seguridad para Make si en algún momento hiciera falta buscar por nombre + centro.

### 3.4 `pacientes`

| Columna | Cambio |
|---|---|
| `psicologo_id` | **Se elimina.** |
| `psicologo_adultos_id uuid REFERENCES psicologos(id)` | Nueva. |
| `psicologo_pareja_id uuid REFERENCES psicologos(id)` | Nueva. |
| `psicologo_infantil_id uuid REFERENCES psicologos(id)` | Nueva. |
| `centro_id` | Se mantiene: centro del alta. No decide nada. |
| `telefono` | Se mantiene. En menores = teléfono del tutor 1. |

Restricción: al menos una de las tres columnas de psicólogo rellena (CHECK).

### 3.5 `asociados_menores`

| Columna | Cambio |
|---|---|
| `T1_paciente_id uuid REFERENCES pacientes(id)` | Nueva, opcional. |
| `T2_paciente_id uuid REFERENCES pacientes(id)` | Nueva, opcional. |

### 3.6 `acciones_psicologos` y `acciones_historial`

| Columna | Cambio |
|---|---|
| `centro_id uuid REFERENCES centros(id)` | Nueva en ambas. El trigger `registrar_historial_accion` la copia. El aviso a Elias la incluye automáticamente (`to_jsonb`). |

### 3.7 Borrado y fusión de datos

Se vacían `acciones_historial`, `acciones_psicologos`, `acciones_call_center`,
`asociados_menores`, `historial_estados`, `formulario_citas_psicologos` y `pacientes`.
Se borran las fichas de `psicologos` sin calendario real (`calendar_id` nulo, vacío o
`test`), con su perfil y sus horarios; sus cuentas de Auth se borran a mano.
Los psicólogos reales se conservan: sus fichas por centro se fusionan en una (mismo email;
sobrevive la que apunta un perfil, si no la más antigua, y hereda de las otras teléfono,
calendario, email, permisos y horario si los tenía vacíos), los centros pasan a
`psicologos_centros`, `tipos_consulta` se deduce del sufijo del nombre ("- PAREJAS" →
`pareja`) y el nombre se limpia. La tabla `migracion_014_ids` guarda `id_antiguo → id_nuevo`
de las fichas fusionadas para Elias. `agentes`, `centros`, `perfiles` de agentes y los
horarios de los psicólogos reales no se tocan.

### 3.8 Tipos TypeScript

`types/database.ts`: `Psicologo` (sin `centro_id`/`centro`, con `tipos_consulta`),
`PsicologoCentro`, `Paciente` (tres columnas), `AsociadoMenor` (`T1_paciente_id`,
`T2_paciente_id`), `AccionPsicologo` y `AccionHistorial` (`centro_id`).

## 4. App

### 4.1 Usuarios (`/dashboard/usuarios`, `app/api/usuarios`)

- Alta de psicólogo: nombre (sin sufijo), email, teléfono, `calendar_id`, **centros** (checkboxes,
  ≥ 1), **tipos de consulta** (checkboxes, ≥ 1), permisos como hasta ahora. Inserta **una** fila
  en `psicologos`, N filas en `psicologos_centros`, la cuenta Auth y el perfil.
- Edición: mismos campos; los centros y tipos se sincronizan (borrar/insertar en
  `psicologos_centros`).
- Horarios: sin cambios (por psicólogo).

### 4.2 Selector de centro (`lib/centro-activo.ts`, formulario de Citas)

- Un psicólogo con varios centros elige **centro**, no ficha. Se guarda `centroId` en
  localStorage como ahora; `psicologoId` es siempre el único id. Si tiene un solo centro, no se
  pregunta.
- `lib/disponibilidad-datos.ts`: horarios y citas por `psicologo_id` (una sola ficha). Desaparece
  la búsqueda de fichas por email.

### 4.3 Citas (`/dashboard/psicologos`)

- Desplegable de pacientes: pacientes con `psicologo_adultos_id`, `psicologo_pareja_id` o
  `psicologo_infantil_id` = psicólogo elegido.
- Tipo de cita: solo los valores de `tipos_consulta` del psicólogo. Si el paciente es menor, solo
  `menor`. Preselección: el único tipo posible, o `adulto`.
- Envío a Make (`datosProcesados`): se añaden `psicologo_id` y `centro_id` (el centro activo).
  `psicologo_nombre` y `Selecciona tu centro` se mantienen para los textos de Telegram.
- Selector de cita (`lib/eventos-activos.ts`): sin cambios.

### 4.4 Alta de paciente (`/dashboard/psicologos`, acción "Añadir nuevo paciente")

Flujo:

1. Nombre, fecha de nacimiento (obligatoria), correo.
2. Si la fecha da **menor** (≤ 15): el campo teléfono se sustituye por el texto "El contacto será
   el teléfono del tutor 1"; sección de tutores como hoy; tipo = `menor` implícito.
   Para cada tutor, botón "Ya es paciente" → buscador (nombre o teléfono) → elegir ficha →
   se rellenan nombre, teléfono y correo (editables) y se guarda `Tn_paciente_id`.
3. Si es **adulto**: campo teléfono obligatorio; selector "Tipo de consulta" (`adulto`
   preseleccionado, `pareja` como alternativa) en el lugar donde hoy está "es menor". Solo se
   ofrecen los tipos que el psicólogo tiene.
4. Comprobación de duplicados (§5).
5. Insert en `pacientes` con la columna de psicólogo del tipo elegido, `centro_id` = centro
   activo, `telefono` = del paciente o del tutor 1.
6. Aviso a Make como hasta ahora (`Añadir nuevo paciente`), con `psicologo_id`, `centro_id` y
   `tipo_consulta` añadidos.

### 4.5 Mis pacientes (`/dashboard/pacientes`), dashboard, mensajes a pacientes

- Filtrar por las tres columnas en vez de `psicologo_id`.
- Columna "Tipo" en la tabla de pacientes (adultos / pareja / infantil) cuando el psicólogo
  atiende más de un tipo.

### 4.6 Calendario (`/dashboard/calendario`)

- El centro de cada cita sale de `acciones_psicologos.centro_id`. Los bloqueos no tienen centro
  (afectan a todos); se muestran en todos los filtros de centro.

### 4.7 Estadísticas

- Sin agrupación por nombre: una ficha = una persona. Se elimina el código de "personas".

## 5. Duplicados en el alta

Comprobación previa al insert, en la app (y replicada en Dante):

| Situación | Comportamiento |
|---|---|
| Menor: existe paciente con mismo nombre (normalizado) y misma fecha de nacimiento | Bloqueo: "Este menor ya existe (con X). Revisa los datos y vuelve a crearlo; el equipo está avisado; si sigue fallando y es correcto, contacta con nosotros." Aviso a Make (`Paciente duplicado`). No se crea. |
| Adulto: mismo teléfono **y** mismo nombre | Bloqueo con el mismo texto. Aviso a Make. No se crea. |
| Adulto, tipo `pareja`: mismo teléfono, distinto nombre o distinto psicólogo | Aviso suave: "Este teléfono es de X, en adultos con Y. ¿Es la misma persona?" → **Sí**: se rellena `psicologo_pareja_id` en la ficha de X con este psicólogo; no se crea ficha. **No**: se crea ficha nueva. |
| Adulto, tipo `adulto`: mismo teléfono | Aviso fuerte: "Este teléfono ya es de X con Y. ¿Seguro que es para adultos?" → misma mecánica: vincular (`psicologo_adultos_id`) o crear. |
| Vincular cuando la columna del tipo ya está ocupada por otro psicólogo | Aviso: "X ya tiene psicólogo de <tipo>: Z. ¿Cambiarlo por ti?" → Sí: se sustituye. No: se cancela. |

Normalización de nombre: minúsculas, sin tildes, espacios colapsados.

## 6. Make (escenario "Formulario Citas Psicólogos v2 Telegram")

| Módulo | Cambio |
|---|---|
| 3 (Buscar psicólogo) | Search criteria: `id` Equals `{{1.datosProcesados.psicologo_id}}`. |
| 14, 42, 98, 101, 105, 107, 226 (upserts de acciones) | Añadir `centro_id = {{1.datosProcesados.centro_id}}`. |
| 41, 201, 204 (upserts de pacientes) | **Quitar** `psicologo_id` y `centro_id`. |
| Textos de Telegram que usan `3.centro` | Usar `{{1.respuestasFormulario.Selecciona tu centro}}`. |
| Módulo 1 (webhook) | Reaprender estructura con los campos nuevos (`psicologo_id`, `centro_id`, `tipo_consulta`, `paciente_id`). |

Escenario "Cto general": sin cambios.

## 7. Dante (n8n, `somos-main-agent.json`)

| Herramienta | Cambio |
|---|---|
| `ListarPsicologos` | Consultar `psicologos_por_centro?centro_id=eq.X&activo=eq.true`. |
| `ConsultarPsicologo` | Consultar `psicologos` (sin `centro`); si hace falta el centro, `psicologos_centros`. |
| `ConsultarPaciente` | Devolver las tres columnas de psicólogo. |
| `RegistrarPaciente` | Reglas de §5; escribir la columna del tipo; `centro_id` del alta; enviar `psicologo_id`, `centro_id`, `tipo_consulta` a Make. |
| `EjecutarAccion` | Elegir psicólogo por tipo desde la ficha del paciente; `centro_id` = el de la ficha del paciente si el psicólogo está en ese centro, si no preguntar; enviar `psicologo_id` y `centro_id`. |
| Prompt | Explicar los tres tipos y el centro. |

El workflow no está en git: exportar antes de tocar y guardar en `n8n/workflows/_backups/`.

## 8. Plan de ejecución (cuando Sonia lo autorice)

1. **Parar** Make (escenario OFF, cola vacía) y Dante (workflow inactivo). Avisar a Elias.
2. **Migración 014** en Supabase (borrado + modelo nuevo + vista + trigger de historial con
   `centro_id`). Verificar con `select` que las tablas están vacías y las columnas existen.
3. **App**: tipos, API de usuarios, selector de centro, disponibilidad, Citas, alta de paciente,
   Mis pacientes, calendario, estadísticas. Tests de `lib/` actualizados. `npm run build` limpio.
   Commit y despliegue.
4. **Revisar los psicólogos reales** en `/dashboard/usuarios` (tipos de consulta que hayan
   quedado vacíos, centros). Pasar a Elias la tabla `migracion_014_ids`.
5. **Make**: cambios de §6. Reaprender el webhook con un envío desde la app. Activar.
6. **Dante**: cambios de §7. Activar.
7. **Pruebas de aceptación** (§9).

## 9. Pruebas de aceptación

1. Alta de psicólogo con dos centros y dos tipos → una fila en `psicologos`, dos en
   `psicologos_centros`, perfil y cuenta creados; aparece en la vista con dos filas.
2. Alta de paciente adulto tipo adultos → `psicologo_adultos_id` relleno; Telegram de alta.
3. Alta de paciente adulto tipo pareja con el teléfono del anterior y otro psicólogo → aviso
   "¿es la misma persona?" → Sí → la misma ficha tiene `psicologo_pareja_id`; no hay ficha nueva.
4. Alta de menor con tutor 1 "ya es paciente" → `asociados_menores` con `T1_paciente_id` y datos
   copiados; `pacientes.telefono` = teléfono del tutor 1.
5. Alta de menor duplicado (mismo nombre y fecha) → bloqueo con el texto nuevo; Telegram al
   equipo; sin fila nueva.
6. Cita de tipo pareja desde el psicólogo de pareja, en un centro concreto → `acciones_psicologos`
   con `psicologo_id`, `paciente_id`, `tipo_cita = pareja`, `centro_id`; historial y aviso a
   Elias con `centro_id`; evento en el calendario del psicólogo.
7. Calendario filtrado por ese centro muestra la cita; filtrado por otro centro no.
8. Cambiar y anular la cita → fila actualizada en sitio (como en septiembre).
9. Dante: listar psicólogos de un centro, registrar paciente, agendar → mismos resultados.
10. Mis pacientes de un psicólogo con dos tipos muestra a ambos pacientes con su tipo.

## 10. Fuera de alcance

- Vínculo entre las dos fichas de una pareja.
- Columna propia para el chat id de Telegram.
- Horarios por centro.
- Migración de datos históricos (no hay).
