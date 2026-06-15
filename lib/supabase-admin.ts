import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// SOLO SERVIDOR. Usa la service_role key (bypassa RLS y permite operaciones
// de Auth admin). NUNCA importar este módulo desde un componente cliente.
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
