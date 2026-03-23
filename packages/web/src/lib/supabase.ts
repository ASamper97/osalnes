import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Supabase browser client for the public web.
 * Uses anon key — all queries respect RLS policies.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
