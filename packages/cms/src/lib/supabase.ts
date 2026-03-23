import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Supabase client for the CMS admin panel.
 * Uses anon key + Supabase Auth for authenticated admin operations.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
