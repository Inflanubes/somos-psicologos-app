'use client'

// Subpestañas Parejas y Menores de Pacientes (feedback v2, tarea 14): quién forma
// cada entidad y el consentimiento de cada persona. Solo lectura: reenviar o
// marcar el consentimiento se hace en la pestaña Todos.

import { useMemo } from 'react'
import { textoEstadoConsentimiento } from '@/lib/consentimiento'
import {
  agruparMenores, agruparParejas, coincideBusqueda, estadoEntidad, TEXTO_ESTADO_ENTIDAD,
  type EstadoEntidad, type FilaTutores,
} from '@/lib/entidades'
import type { PacienteTableRow } from './PacientesClient'

const COLOR_ENTIDAD: Record<EstadoEntidad, React.CSSProperties> = {
  completo: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  parcial: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
  pendiente: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
}

function Insignia({ firmado, texto }: { firmado: boolean; texto: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
        background: firmado ? '#dcfce7' : '#fef3c7', color: firmado ? '#166534' : '#92400e',
        border: `1px solid ${firmado ? '#bbf7d0' : '#fde68a'}`,
      }}
    >
      {firmado ? '✓ ' : ''}{texto}
    </span>
  )
}

function Tarjeta({ titulo, subtitulo, estado, children }: {
  titulo: string; subtitulo?: string | null; estado: EstadoEntidad; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(58,140,140,0.15)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#272626' }}>{titulo}</div>
          {subtitulo && <div style={{ fontSize: 12, color: '#8899bb', marginTop: 2 }}>{subtitulo}</div>}
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...COLOR_ENTIDAD[estado] }}>
          {TEXTO_ESTADO_ENTIDAD[estado]}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  )
}

function Fila({ rol, nombre, telefono, children }: { rol: string; nombre: string; telefono: string | null; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', background: '#f7f4ef', borderRadius: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{rol}</div>
        <div style={{ fontSize: 13.5, color: '#272626', fontWeight: 500 }}>{nombre}</div>
        {telefono && <div style={{ fontSize: 12, color: '#8899bb' }}>📞 {telefono}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function EntidadesVista({
  tipo, pacientes, tutores, busqueda, nombrePsi,
}: {
  tipo: 'parejas' | 'menores'
  pacientes: PacienteTableRow[]
  tutores: FilaTutores[]
  busqueda: string
  nombrePsi: (id: string | null) => string | null
}) {
  const parejas = useMemo(
    () => agruparParejas(pacientes).filter((e) => coincideBusqueda(e.personas, busqueda)),
    [pacientes, busqueda],
  )
  const menores = useMemo(
    () => agruparMenores(pacientes, tutores).filter((e) => coincideBusqueda([e.menor, ...e.tutores], busqueda)),
    [pacientes, tutores, busqueda],
  )
  const total = tipo === 'parejas' ? parejas.length : menores.length
  const vacio = tipo === 'parejas' ? 'No hay parejas' : 'No hay menores'

  return (
    <div>
      <p style={{ fontSize: 13, color: '#667799', margin: '0 0 16px' }}>
        {tipo === 'parejas'
          ? 'Las dos personas de cada pareja y si ha firmado cada una.'
          : 'Cada menor con su tutor o tutores y si ha firmado cada uno.'}
        {' '}Para reenviar o marcar el consentimiento, usa la pestaña <strong>Todos</strong>.
        <span style={{ float: 'right', color: '#8899bb' }}>{total} {tipo === 'parejas' ? `pareja${total !== 1 ? 's' : ''}` : `menor${total !== 1 ? 'es' : ''}`}</span>
      </p>

      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8899bb', fontSize: 14 }}>{vacio}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {tipo === 'parejas'
            ? parejas.map(({ personas }) => {
                const psi = nombrePsi(personas.find((x) => x.psicologo_pareja_id)?.psicologo_pareja_id ?? null)
                const firmas = personas.map((x) => !!x.consentimiento)
                return (
                  <Tarjeta
                    key={personas.map((x) => x.id).join('-')}
                    titulo={personas.map((x) => x.nombre).join(' y ')}
                    subtitulo={[psi ? `Pareja: ${psi}` : null, personas[0].centro_nombre !== '—' ? personas[0].centro_nombre : null].filter(Boolean).join(' · ')}
                    // Con una sola ficha falta la otra persona: nunca está completo.
                    estado={personas.length < 2 && firmas[0] ? 'parcial' : estadoEntidad(firmas)}
                  >
                    {personas.map((x, i) => (
                      <Fila key={x.id} rol={`Persona ${i + 1}`} nombre={x.nombre} telefono={x.telefono || null}>
                        <Insignia firmado={!!x.consentimiento} texto={textoEstadoConsentimiento(x)} />
                      </Fila>
                    ))}
                    {personas.length < 2 && (
                      <div style={{ fontSize: 12.5, color: '#8899bb', fontStyle: 'italic', padding: '4px 10px' }}>
                        Segunda persona sin registrar en la app
                      </div>
                    )}
                  </Tarjeta>
                )
              })
            : menores.map(({ menor, tutores: ts }) => (
                <Tarjeta
                  key={menor.id}
                  titulo={menor.nombre}
                  subtitulo={[menor.edad != null ? `${menor.edad} años` : null, menor.centro_nombre !== '—' ? menor.centro_nombre : null].filter(Boolean).join(' · ')}
                  estado={ts.length > 0 ? estadoEntidad(ts.map((t) => t.firmado)) : estadoEntidad([!!menor.consentimiento])}
                >
                  <Fila rol="Menor" nombre={menor.nombre} telefono={menor.telefono || null}>
                    <Insignia firmado={!!menor.consentimiento} texto={textoEstadoConsentimiento(menor)} />
                  </Fila>
                  {ts.map((t) => (
                    <Fila
                      key={t.cual}
                      rol={`${t.cual === 'T1' ? 'Tutor 1' : 'Tutor 2'}${t.paciente_id ? ' · también es paciente' : ''}`}
                      nombre={t.nombre}
                      telefono={t.telefono}
                    >
                      <Insignia firmado={t.firmado} texto={t.firmado ? 'Firmado' : 'Pendiente'} />
                    </Fila>
                  ))}
                  {ts.length === 0 && (
                    <div style={{ fontSize: 12.5, color: '#8899bb', fontStyle: 'italic', padding: '4px 10px' }}>
                      Sin tutores registrados
                    </div>
                  )}
                </Tarjeta>
              ))}
        </div>
      )}
    </div>
  )
}
