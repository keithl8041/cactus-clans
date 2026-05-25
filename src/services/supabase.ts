import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Real Supabase client, or null if env vars are unset. When null, the
 * services in this folder fall back to a localStorage-backed mock so the
 * full app still works end-to-end (no leaderboard sync between players).
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const usingRealBackend = supabase !== null;
