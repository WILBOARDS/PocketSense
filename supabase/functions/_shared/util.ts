// Helpers shared by the Pocket Sense Edge Functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { sendBrevoEmail, type EmailButton } from './email.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Errors are sent as { error } with a message the app can show as-is. */
export const fail = (error: string, status = 400) => json({ error }, status);

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}`);
  return v;
}

/** Service-role client: bypasses row-level security, so only use it after checking who is asking. */
export function admin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user who called the function, or null. */
export async function caller(req: Request, db: SupabaseClient): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}

export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sends a plain email through Brevo. `paragraphs` are escaped; `button` becomes one link.
 * Throws if Brevo refuses, so the caller can tell the user it didn't send.
 * Secrets: BREVO_API_KEY, EMAIL_FROM_ADDRESS (a sender verified in Brevo), and optionally EMAIL_FROM_NAME and EMAIL_REPLY_TO.
 */
export function sendEmail(to: string, subject: string, paragraphs: string[], button?: EmailButton) {
  return sendBrevoEmail({
    apiKey: env('BREVO_API_KEY'),
    fromAddress: env('EMAIL_FROM_ADDRESS'),
    fromName: Deno.env.get('EMAIL_FROM_NAME') || 'Pocket Sense',
    replyTo: Deno.env.get('EMAIL_REPLY_TO') || undefined,
  }, to, subject, paragraphs, button);
}

/** The app's address with a query parameter, e.g. https://pocketsense.app/?consent=abc */
export function appLink(params: Record<string, string> = {}): string {
  const url = new URL(env('APP_URL'));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Wraps a handler with CORS preflight, POST-only and a catch-all error. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return fail('Use POST.', 405);
    try {
      return await handler(req);
    } catch (e) {
      console.error(e);
      return fail('Something went wrong on our side. Try again in a minute.', 500);
    }
  });
}

/** Formats a date like the app does: "Sat 3 Oct", in Jakarta time. */
export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).replace(',', '');
}
