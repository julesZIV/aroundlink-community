import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options?: Record<string, any> }[]) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

/** Service-role client — server-only, bypasses RLS. Never expose to client. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('[createAdminClient] SUPABASE_SERVICE_ROLE_KEY is not set')
  return createSupabaseClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
