import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Paciente, Psicologo, Centro } from '@/types/database'
import PacientesClient from './PacientesClient'
import type { PacienteTableRow } from './PacientesClient'

export default async function PacientesPage() {
  const supabase = await createSupabaseServerClient()

  // Un psicólogo solo ve sus propios pacientes; un agente los ve todos.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: perfil } = user
    ? await supabase.from('perfiles').select('rol, psicologo_id').eq('id', user.id).maybeSingle()
    : { data: null }
  const esPsicologo = perfil?.rol === 'psicologo'

  const [{ data: psicologos }, { data: centros }] = await Promise.all([
    supabase.from('psicologos').select('*'),
    supabase.from('centros').select('*'),
  ])
  const psi = (psicologos ?? []) as Psicologo[]
  const cen = (centros ?? []) as Centro[]

  // Multi-centro: la misma persona puede tener una fila de psicólogo por centro
  // (mismo email). Reunimos todas sus filas para no ocultar pacientes de un centro.
  let misPsicologoIds: string[] = []
  if (esPsicologo) {
    const porEmail = user?.email
      ? psi.filter((p) => p.email === user.email).map((p) => p.id)
      : []
    misPsicologoIds = porEmail.length
      ? porEmail
      : perfil?.psicologo_id
        ? [perfil.psicologo_id]
        : []
  }

  let pacientesQuery = supabase
    .from('pacientes')
    .select('*')
    .order('fecha_incorporacion', { ascending: false })
  if (esPsicologo) {
    pacientesQuery = pacientesQuery.in('psicologo_id', misPsicologoIds)
  }
  const { data: pacientes } = await pacientesQuery

  const pac = (pacientes ?? []) as Paciente[]

  const psicologoMap = Object.fromEntries(psi.map((p) => [p.id, p.nombre]))
  const centroMap = Object.fromEntries(cen.map((c) => [c.id, c.nombre]))

  const rows: PacienteTableRow[] = pac.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono,
    email: p.email,
    centro_nombre: centroMap[p.centro_id] ?? '—',
    psicologo_nombre: psicologoMap[p.psicologo_id] ?? 'Sin asignar',
    estado: p.estado,
    fecha_cita: p.fecha_cita,
    hora_cita: p.hora_cita,
    es_menor: p.es_menor,
    edad: p.edad,
    consentimiento: p.consentimiento,
    fecha_incorporacion: p.fecha_incorporacion,
  }))

  return (
    <div className="page-pad" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-lora, "Lora", Georgia, serif)',
            fontSize: 26,
            fontWeight: 600,
            color: '#1a2e2e',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Pacientes
        </h1>
        <p style={{ fontSize: 13.5, color: '#7a9090', margin: 0 }}>
          {esPsicologo
            ? `${rows.length} paciente${rows.length !== 1 ? 's' : ''} asignado${rows.length !== 1 ? 's' : ''} a ti`
            : `${rows.length} paciente${rows.length !== 1 ? 's' : ''} registrado${rows.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '24px',
          border: '1px solid rgba(58,140,140,0.13)',
          boxShadow: '0 2px 8px rgba(58,140,140,0.06)',
        }}
      >
        <PacientesClient pacientes={rows} />
      </div>
    </div>
  )
}
