/**
 * Supabase client factory for Edge Functions.
 * Environment variables SUPABASE_URL, SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY are automatically injected by Supabase.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

let _admin: SupabaseClient | null = null;

/** Admin client — uses service_role key, bypasses RLS. */
export function getAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
  }
  return _admin;
}
