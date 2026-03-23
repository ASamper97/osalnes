import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase admin client — uses service_role key for full DB access.
 * Only use server-side (API). Never expose to the browser.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

/**
 * Supabase public client — uses anon key, respects RLS.
 * Used for public read queries.
 */
export const supabasePublic = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false },
});
