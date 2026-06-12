import { supabase } from '@/lib/supabase'
import type { Perfil } from '@/types/database'

/**
 * Returns the profile (role + identity) of the logged-in user, or null if there
 * is no session or no profile row. Used to stamp "who did what" and to gate the
 * UI by role.
 */
export async function getPerfilActual(): Promise<Perfil | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()

  return (data as Perfil | null) ?? null
}
