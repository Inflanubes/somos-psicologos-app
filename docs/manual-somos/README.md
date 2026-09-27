# Manual Somos (artifact para los dueños)

Manual vivo de la app para el equipo de dirección de Somos Psicólogos, en estética Be Banana.

- Publicado en: https://claude.ai/artifact/FWj2hP27NkTXLFMUQvBuqi (privado hasta que se comparta desde su menú Compartir)
- Fuente: `index.html` (esta carpeta). Nunca se edita el artifact a mano.
- Spec: `../superpowers/specs/2026-09-27-manual-somos-duenos-design.md`

## Regla de actualización

Cada cambio de la app que afecte a lo que ve alguien (pantalla, mensaje, regla, decisión tomada):

1. Actualizar su ficha en `index.html`. Los textos que muestra la app van en `<code class="ui">`, copiados del código; las partes variables, en `<var>`.
2. Añadir una línea arriba en Novedades con la fecha y un enlace a la ficha.
3. Cambiar la fecha de versión en la portada y en el pie.
4. `node docs/manual-somos/check-manual.mjs` debe dar OK (anclas, textos literales contra el código, secretos, tablas).
5. Republicar al mismo enlace: Artifact publish con `url` = el enlace de arriba y `files` = `{"bebanana-icon.png": "docs/manual-somos/bebanana-icon.png"}`.

Nunca entran claves, tokens, URLs de webhooks ni de la API del proveedor externo, ids de escenarios, nombres de tablas ni números de módulo de Make.
