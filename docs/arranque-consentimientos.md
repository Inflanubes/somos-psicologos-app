# Arranque con base de datos nueva: consentimientos (tarea 57)

Qué hacer el día de la entrega para que los pacientes que ya estaban en las clínicas no se queden
con el consentimiento «Pendiente» sin motivo. Va con el bloque B10 (salida a producción).

## Por qué pasa

La app arranca con una base de datos nueva. Las fichas de los pacientes actuales se cargan sin la marca
de consentimiento firmado (`pacientes.consentimiento` vacío), así que en Pacientes salen todas como
**Pendiente**, aunque muchos ya firmaron en papel o en el formulario antiguo.

## Qué tiene la app para resolverlo (bloque B4)

En **Pacientes**, en la columna Consentimiento de cada paciente:

- `Marcar firmado` (psicólogos y agentes): deja la ficha como firmada y guarda quién la marcó y cuándo.
  La columna pasa a mostrar «Firmado a mano por *Nombre* el *dd/mm/aaaa*». En menores marca también a sus tutores.
- `Reenviar` (psicólogos y agentes): manda de nuevo el enlace del consentimiento (adulto o menores) al paciente
  o a sus tutores, por el canal activo (Telegram hoy, WhatsApp cuando esté aprobado). Si el paciente no tiene
  teléfono, la app lo dice y no envía nada.
- `Desmarcar` (solo agentes): quita la marca si se puso por error.

Los agentes tienen además `Reenviar consentimiento` en cada paciente de **Comunicaciones**.

## Procedimiento del día de la entrega

1. **Antes de abrir la app a los psicólogos**, el equipo (agentes) saca de Pacientes la lista de fichas con
   consentimiento «Pendiente» (filtro de búsqueda o la columna) y la cruza con los consentimientos en papel o
   con el correo del formulario antiguo.
2. Las que ya estaban firmadas: `Marcar firmado`. Queda apuntado el nombre del agente y la fecha.
3. Las que no constan: `Reenviar`. El paciente recibe el enlace y, cuando firme, Make marcará la ficha como
   firmada igual que hasta ahora (sin «a mano»).
4. **Aviso a los psicólogos** (el mismo día, por el canal que use el equipo), texto sugerido:

   > Hola. Desde hoy la app tiene la base de datos nueva. Si en Pacientes ves pacientes tuyos con el
   > consentimiento «Pendiente» que ya lo han firmado (en papel o en la sesión), pulsa «Marcar firmado» en su
   > fila. Si no lo han firmado, pulsa «Reenviar» y les llegará el enlace. Si un paciente no tiene teléfono en
   > su ficha, avisa al equipo.

5. A partir de ahí, cada psicólogo va marcando o reenviando a los suyos según los vea.

## Qué no hace falta

- Importar consentimientos antiguos a mano en Supabase: con el botón basta y queda trazado.
- Tocar Make: la ruta «Reenviar consentimiento» tiene que estar creada antes (`make-cambios-2026-10-b4.md`).

## Comprobación

- Un paciente marcado a mano muestra «Firmado a mano por … el …» en Pacientes.
- Un paciente reenviado recibe el enlace correcto (adulto / menores) y, al firmar, pasa a «Firmado».
- El call center no ve ni la columna de consentimiento ni los botones.
