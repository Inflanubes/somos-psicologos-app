import { createSupabaseServerClient } from '@/lib/supabase-server'

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }

/**
 * Permite la operación solo si hay sesión y el perfil es 'agente'. Si no hay
 * fila en `perfiles` se trata como agente (coherente con SidebarNav/RoleGate,
 * mantiene logins heredados). Un psicólogo o call_center recibe 403.
 */
export async function requireAgente(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil && perfil.rol !== 'agente') {
    return { ok: false, status: 403, error: 'Solo agentes pueden gestionar usuarios' }
  }
  return { ok: true, userId: user.id }
}
