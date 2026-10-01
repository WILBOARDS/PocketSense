import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Read before the client starts: it clears the URL hash while signing in from an email link.
const hash = new URLSearchParams(window.location.hash.slice(1));
/** How this page was opened: from a password-reset link, or from a link that failed (expired, used). */
export const urlAuth = {
  recovery: hash.get('type') === 'recovery',
  error: hash.get('error_description')?.replace(/\+/g, ' ') ?? null,
};

/**
 * Null when the app was built without Supabase settings (see .env.example).
 * Then every account feature stays hidden and the app works on this phone only, as before.
 */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
