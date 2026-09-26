# Manual de la app para los dueños de Somos Psicólogos (artifact vivo)

Fecha: 2026-09-27

## Problema

Al terminar el proyecto hay que presentar a los dueños de Somos Psicólogos cómo funciona su
sistema: qué hace la app, qué ve cada rol, qué mensajes aparecen y por qué, qué pasa por
detrás (Make, Dante, Google Calendar, WhatsApp) y qué queda pendiente o por decidir. Hoy esa
información está repartida entre specs técnicos, documentos de revisión, blueprints y el
propio código; nada de eso es legible para alguien de negocio.

Además, la app sigue creciendo. Cada funcionalidad nueva añade pantallas, reglas y mensajes,
y los dueños deben poder ver esos cambios sin que haya que rehacer la presentación.

Se quiere:

1. Un **manual publicado como artifact** (una URL estable) que los dueños abran cuando quieran.
2. Que sea un **documento vivo**: cuando se añada algo a la app, se amplía y se republica al
   mismo enlace, con un bloque "Novedades" que diga qué cambió y cuándo.
3. Estética **Be Banana**, como la web bebanana.io, distinta de las pizarras de Moncho y Sara.

## Decisiones tomadas con Sonia (26 y 27-09-2026)

- **Alcance: todo el sistema.** No solo lo visible en pantalla: también roles, reglas de
  negocio, y lo que hacen Make, Dante y las integraciones, al estilo "quién hace qué".
- **Estética híbrida.** Portada y sección "Cómo está montado" en oscuro (fiel a bebanana.io);
  el resto del manual en claro para lectura larga.
- **Una sola página larga** con navegación fija, secciones plegables y bloque "Novedades".
  Descartadas las pestañas (Ctrl+F no cruza pestañas, imprime peor) y los artifacts múltiples
  (varios enlaces que mantener).
- **Estados de paciente que hoy nadie asigna** (Revisar recomendado, Psicólogo sin
  disponibilidad, Inactivo; Dudoso solo se lee) se documentan marcados como **"decisión
  pendiente"**, con la pregunta abierta: ¿los usará el call center? ¿se activan?
- **Solo en español.** Sin conmutador de idioma.
- **Lector de negocio.** Sin nombres de tablas, módulos de Make, claves ni URLs internas.

## Público y tono

- Lo leen los dueños de la clínica y, después, el equipo que gestiona la app. No son técnicos.
- Tono de Be Banana: directo, sin humo, sin jerga. "Personas", no "usuarios" cuando se habla
  de pacientes; "usuario" solo para las cuentas de acceso de la app.
- Los textos que la app muestra de verdad van **literales y entre comillas**, en monoespaciada,
  para que se distingan de la explicación. Ningún texto literal se inventa: cada uno se
  comprueba contra el código antes de escribirlo.

## Estructura del manual

### Portada (oscura)

- Título, para quién es, "Preparado por Be Banana para Somos Psicólogos", fecha de versión.
- Índice con enlaces a las ocho secciones.
- **Novedades**: lista con fecha descendente. Cada entrada: fecha, una frase, enlace a la
  ficha afectada. La primera entrada es la creación del manual.

### 1. Cómo está montado (oscura)

Mapa de piezas, cada una con color, nombre y una frase:

- **La app** (app.somospsicologos.es): lo que usa el equipo con su usuario y contraseña.
- **Make**: recibe cada acción de la app y de Dante, crea o mueve la cita en Google Calendar,
  cambia el estado del paciente y manda los avisos.
- **Dante**: asistente de Telegram para pacientes. Da de alta, ofrece huecos, agenda, cambia y
  anula citas; deriva a una persona cuando hace falta.
- **Google Calendar**: un calendario por psicólogo. Es lo que ve el psicólogo en su móvil.
- **Telegram**: hoy, canal de confirmaciones a pacientes y de avisos al equipo.
- **WhatsApp Business**: mensajes desde Comunicaciones y Mensajes. Paso completo pendiente.
- **Consentimiento informado**: formulario de la web; al llegar el correo, Make marca la firma.
- **Proveedor externo de calendario**: recibe un aviso automático con cada cita agendada,
  cambiada, anulada o bloqueo (se nombra como "proveedor externo", sin URL).

Debajo, el flujo resumido en una línea: acción en la app o Dante → Make → Calendar + estado +
aviso.

### 2. Quién entra y qué ve (claro)

- Los tres roles: **Agente** (equipo interno, acceso total), **Psicólogo** (su agenda, sus
  pacientes, sus mensajes), **Call center** (Calendario, su actividad, Citas).
- Página de inicio de cada rol y qué pasa si entra en una ruta que no le toca (se le
  redirige a su inicio).
- Tabla pantalla × rol (la de roles-y-permisos.md, traducida a nombres visibles).
- Altas, desactivación y restablecimiento de contraseña: "Enviar acceso" frente a "Generar
  contraseña". Regla: desactivar no borra ni bloquea el login; conviene una cuenta por
  persona en call center porque todo queda firmado con su nombre.

### 3. Las pantallas, una a una (claro)

Una ficha por pantalla, siempre con la misma estructura: **Para qué sirve · Quién la ve ·
Qué se puede hacer · Mensajes que puede mostrar** (bloque plegable "Ver mensajes").

Pantallas: Calendario, Panel General (agente y "Mi actividad" de call center), Estadísticas,
Pacientes, Psicólogos, Agentes, Usuarios, Citas, Comunicaciones, Mensajes (psicólogo).

El bloque de mensajes que pegó Sonia se reparte así:

- **Citas**: aviso ámbar de agentes ("⚠️ Aviso: … Puedes agendar igualmente." y sus cinco
  motivos), sufijos del desplegable de hora ("· ocupada", "· fuera de horario", "· media hora
  no activa"), mensajes de psicólogos y call center bajo el selector, mensajes comunes de
  carga y error.
- **Usuarios**: columna Horarios, estado "✓ Citas a y media" / "Solo en punto", botones
  "Horario" y "30'", editor de horario con sus textos y errores, errores de la API.
- **Calendario**: subtítulo, filtros, botones de semana y día, avisos con psicólogo filtrado,
  mensaje sin datos, error, formato de cada cita y bloqueo.

El aviso "Falta ejecutar la migración 012…" se documenta como "ya no debería aparecer; si
sale, avisar a Be Banana".

### 4. El viaje de una cita (claro)

- **Por dónde entra un paciente**: acción "Añadir nuevo paciente" en la app (cualquier rol) o
  Dante. Qué se pide (nombre, teléfono, email opcional, fecha de nacimiento; tutores si es
  menor), las iniciales automáticas, la casilla "Nueva recomendación".
- **Duplicados por teléfono**: los dos mensajes de la app y el aviso "Posible duplicado" al
  equipo, con la marca de posible fraude si venía como recomendación.
- **Estados del paciente**: tabla con estado, quién lo pone y cuándo. Los que nadie asigna hoy
  llevan el badge "decisión pendiente" y la pregunta abierta.
- **Acciones**: Agendar, Cambiar, Cancelar, Añadir paciente, Bloquear, Desbloquear, Modificar
  bloqueo personal, Asuntos propios, Vacaciones, Baja laboral. Quién tiene cada una (call
  center solo las cuatro primeras; Bloquear/Desbloquear solo con permiso).
- **Qué pasa detrás con cada acción**: tabla acción → Google Calendar → estado del paciente →
  mensaje (a quién y texto resumido). Incluye que Cambiar mueve la misma cita y Cancelar la
  deja anulada, y que Make busca al psicólogo por nombre y centro.
- **Consentimiento**: adulto y menor (dos tutores), qué marca la app ("Consentimiento firmado"
  / "pendiente"), enlace que se envía al añadir paciente.
- **Tipo de cita**: Adulto, Pareja, Menor; preselección según edad.

### 5. Horarios y disponibilidad (claro)

Reglas exactas de la fase 1 del spec de horarios, en lenguaje llano:

- Horario semanal por psicólogo y centro; lo editan los agentes en Usuarios.
- Sin horario definido = sin restricción (solo se ocultan las ocupadas).
- Toda cita dura 60 minutos. Horas en punto de 08:00 a 21:00; con "30'", también las medias
  hasta 21:30.
- Qué se comprueba: bloqueo del día, dentro del tramo y cabe entera, no solapa con otra cita
  de la misma persona en cualquiera de sus centros, media hora solo con permiso.
- **Psicólogo y call center: bloquea** (solo huecos libres, sin fechas pasadas).
  **Agente: solo avisa** (ve todo, aviso ámbar).
- Límites: si dos personas agendan el mismo hueco a la vez, la app no lo impide; lo apuntado
  a mano en Google Calendar no aparece en la app; Dante usa hoy otra fuente de disponibilidad
  y puede ofrecer huecos distintos (marcado como pendiente de unificar).

### 6. Dante (claro)

- Qué hace: alta de pacientes, huecos, agendar, cambiar, anular (con confirmación), registrar
  "Sin disponibilidad" y "Cambio solicitado". Entiende texto y audio; no imágenes.
- Qué no hace: bloqueos; identificadores nunca visibles; una sola cita activa por paciente;
  horas solo en punto o y media entre 08:00 y 21:30.
- Derivaciones: general (Marta → Sonia → Jaime), marketing (Jaime → Sonia → Marta), emergencia
  (Bea → Marta → Sonia → Jaime, más 112 y 024). Responder "atendido" cierra la derivación.
  Recordatorio cada 15 minutos si nadie la atiende.
- Doble confirmación al paciente (Dante y Make) marcada como decisión pendiente.

### 7. Pendientes y decisiones abiertas (claro)

Lista en lenguaje de negocio, agrupada en **Decisiones que tomar** y **Cosas por construir**:

- Estados de paciente sin uso: ¿los usa el call center? ¿se activan?
- Paso de Dante y recordatorios de consentimiento a WhatsApp.
- Evitar la doble confirmación al paciente cuando actúa Dante.
- Unificar la disponibilidad de Dante con la de la app.
- Título del evento de calendario sin tipo de cita.
- Renombrar "Barrio Salamanca" a "Salamanca" para que Make encuentre a esos psicólogos.
- Activar "30'" a quien lo necesite (al desplegar, nadie lo tiene).
- Protección de datos a nivel de base de datos pendiente de cerrar (sin detalle técnico).
- Rediseño "paciente con varios psicólogos": no se hace hasta que Sonia lo indique.
- Guía de pruebas antigua desactualizada.

### 8. Glosario (claro)

Centro (Online es uno más), ficha de psicólogo, psicólogo multi-centro, tipo de cita, menor
(hasta 15 años), iniciales, consentimiento, recomendado, bloqueo y sus motivos, permiso de
bloqueo, "30'", origen, cita activa, derivación, Dante, proveedor externo de calendario.

## Diseño visual

### Color

Dos temas dentro de la misma página, fijados por sección (clase `.oscura` / `.clara`). El
documento **ignora la preferencia de modo oscuro del sistema**: el híbrido es deliberado.

| Token | Oscuro | Claro |
|---|---|---|
| fondo | `#04060a` | `#faf9f5` |
| superficie | `#0a1018` | `#ffffff` |
| texto | `#e8eef5` | `#1c1c1c` |
| texto secundario | `#7a8fa8` | `#5f5f5f` |
| borde | `rgba(245,200,0,.12)` | `#e6e3db` |
| acento | `#f5c800` | `#f5c800` (fondos) / `#8a7000` (texto sobre claro) |

Colores de rol, iguales en todo el manual: agente amarillo `#f5c800`, psicólogo teal
`#2dd4bf`, call center azul `#4a7dd4`, Dante violeta `#8b6fd6`. Badges de estado: "en
producción" teal, "pendiente" ámbar, "decisión pendiente" violeta, "ya no debería salir" gris.

### Tipografía

Google Fonts: **Syne** (titulares, 700/800), **DM Sans** (texto, 400/500/600), **DM Mono**
(textos literales de la app y datos). Cuerpo 16px, interlineado 1.55, ancho máximo 1080px.

### Componentes

- Navegación superior fija con las ocho secciones; en móvil, un `<select>` que salta a la sección.
- Fichas rectas, esquinas 16px, borde fino, sin sombra en oscuro y sombra suave en claro.
- Chips de rol, badges de estado, tablas con cabecera pegajosa y scroll horizontal en móvil.
- `<details>` para "Ver mensajes" y "Paso a paso". Todos abiertos al imprimir.
- Textos literales: `<code class="ui">…</code>` en DM Mono con fondo tenue.
- Impresión: `@media print` fuerza todo a claro, oculta la navegación y abre los plegables.
- Identidad: icono de Be Banana en portada y pie; pie con "Preparado por Be Banana" y fecha.

### Accesibilidad y móvil

Contraste mínimo AA en ambos temas (el amarillo nunca se usa como texto sobre claro; en su
lugar `#8a7000`). Gutter lateral de 16px, sin scroll horizontal de página, botones de al menos
40px de alto en móvil.

## Archivos y mantenimiento

- Este spec: `somos-app/docs/superpowers/specs/2026-09-27-manual-somos-duenos-design.md`.
- Fuente del manual: `somos-app/docs/manual-somos/index.html` (HTML único, CSS y JS inline,
  fuentes desde Google Fonts, icono `bebanana-icon.png` al lado y publicado como archivo de
  apoyo).
- `somos-app/docs/manual-somos/README.md`: qué es, URL del artifact publicado, regla de
  actualización.
- **Regla de actualización**: cada cambio de la app que afecte a lo que ve el usuario (pantalla
  nueva, mensaje nuevo, regla nueva, decisión tomada) se refleja en su ficha, se añade una línea
  en Novedades con la fecha, se actualiza la fecha de versión y se republica al mismo enlace.
  Se guarda una memoria de proyecto con esta regla y la URL.
- Se publica **sin** capacidades de runtime: es una página estática. Nada de estado compartido.

## Lo que no entra

Claves, tokens, URLs de webhooks y de la API del proveedor externo, ids de escenarios y
workflows, nombres de tablas y columnas, números de módulo de Make, la incidencia puntual del
26-09 con la cola de Make (es operativa, no estructural).

## Verificación antes de entregar

1. Cada texto literal del manual existe en el código de `somos-app` (grep por cada uno).
2. Abrir el HTML a 390px y a 1280px: sin scroll horizontal, navegación usable, tablas con
   scroll propio.
3. Todos los enlaces del índice y de Novedades llevan a un `id` existente.
4. Vista previa de impresión: todo en claro, plegables abiertos, sin navegación.
5. Sin secretos: grep del HTML por `supabase`, `webhook`, `token`, `eltodi`, `hook.eu`.
6. Publicar, abrir la URL, y guardar URL en README y en memoria.
