# Prompt para el agente que implemente el modelo de pacientes y psicólogos

Copiar el bloque siguiente tal cual como primer mensaje de una sesión nueva de Claude Code
abierta en `z:\Claude\Somos Psicológos` (o en `somos-app`).

---

Vas a implementar el rediseño "paciente con varios psicólogos y una sola ficha por psicólogo" de la app Somos Psicología. Todo el trabajo está especificado y planificado; tu tarea es ejecutarlo sin reinterpretar las decisiones.

Lee, en este orden, antes de tocar nada:
1. `somos-app/docs/superpowers/specs/2026-09-26-modelo-pacientes-psicologos-design.md` (especificación aprobada; el §2 tiene las decisiones cerradas y el §0 la guía para retomar).
2. `somos-app/docs/superpowers/plans/2026-09-26-modelo-pacientes-psicologos.md` (plan de implementación: 10 tareas con archivos, código, tests y commits).
3. `somos-app/docs/superpowers/specs/2026-09-26-modelo-pacientes-psicologos-riesgos.md` (por qué se decidió cada cosa; consúltalo solo si dudas).
4. `docs/make-cambios-2026-09-25.md` (estado actual del escenario de Make; los números de módulo del plan son los de ahí).

Contexto imprescindible:
- Los datos actuales de Supabase son de prueba y la migración 014 los borra. Es intencionado.
- Antes de ejecutar la migración: el escenario de Make "Formulario Citas Psicólogos v2 Telegram" debe estar desactivado con la cola del webhook vacía, y el workflow de n8n "Dante" inactivo. Esto lo hace Sonia; pídeselo y espera confirmación antes de la Tarea 1.
- El aviso a Elias (`somos.eltodi.net`) sale de un trigger de Supabase; tras recrear los psicólogos hay que pasarle la tabla de ids nuevos (Tarea 10).
- Valores de tipo de consulta en datos: exactamente `adulto`, `pareja`, `menor`. Columnas nuevas de `pacientes`: `psicologo_adultos_id`, `psicologo_pareja_id`, `psicologo_infantil_id`. Tabla `psicologos_centros`, vista `psicologos_por_centro`, `psicologos.tipos_consulta`, `centro_id` en `acciones_psicologos` y `acciones_historial`.
- `pacientes.telefono` guarda un teléfono (app) o el chat id de Telegram (Dante). No crees columna nueva para eso.
- Producción despliega desde `main`. Trabaja en la rama `modelo-pacientes-psicologos` y no hagas merge hasta la Tarea 10.
- Cada tarea termina con `npx tsc --noEmit -p tsconfig.json` limpio y `npm test` en verde antes del commit. Sigue TDD donde el plan lo indica (Tarea 3).
- Usa la skill `superpowers:executing-plans` (o `subagent-driven-development` si tienes subagentes) y marca los pasos del plan a medida que los completas.
- Las tareas 8 (Make) y 9 (Dante) son manuales en herramientas externas: prepara los documentos y las instrucciones exactas, y pide a Sonia que las aplique; verifica después con el blueprint exportado y con consultas a Supabase.
- No tienes acceso al escenario vivo de Make desde el MCP (está en la zona us2); trabaja con el blueprint exportado en `Make blueprints/Formulario Citas Psicologos.blueprint.json`.
- Si algo del plan choca con el código real (líneas movidas, nombres distintos), adapta la ubicación pero no el diseño. Si encuentras una decisión de diseño no cubierta por la especificación, para y pregunta a Sonia; no la resuelvas por tu cuenta.

Empieza confirmando con Sonia que Make y Dante están parados y que la migración 014 puede ejecutarse. Después sigue el plan tarea por tarea, con un mensaje corto al terminar cada una (qué se hizo, qué se verificó, commit).

---
