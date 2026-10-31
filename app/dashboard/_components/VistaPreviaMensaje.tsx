import { conPie } from '@/lib/mensajes-pie'

// Muestra, en solo lectura, el texto tal y como le llegará al paciente (con el pie
// informativo que añade /api/webhook/mensajes).
export default function VistaPreviaMensaje({ texto }: { texto: string }) {
  return (
    <div style={{
      marginTop: 8,
      background: '#f7f9f9',
      border: '1px solid rgba(47,90,174,0.12)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12.5,
      color: '#4a5870',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#667799', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Así llegará el mensaje:
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{conPie(texto)}</div>
    </div>
  )
}
