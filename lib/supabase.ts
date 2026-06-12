import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Cookie-based browser client so the session is SHARED with the login page
// (createBrowserClient) and the middleware (createServerClient). With the old
// `createClient` (localStorage) the app could not see the logged-in user, so
// `auth.getUser()` returned null and created_by_id / roles never worked.
// Only client components import this; server components use lib/supabase-server.
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
