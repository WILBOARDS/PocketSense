// Helpers shared by the Pocket Sense Edge Functions.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

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

/** Same rule as public.is_minor() in the database. */
export const isMinor = (birthYear: number | null) => birthYear == null || new Date().getUTCFullYear() - birthYear <= 18;

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Sends a plain email through Resend. `paragraphs` are escaped; `button` becomes one link.
 * Throws if Resend refuses, so the caller can tell the user it didn't send.
 */
export async function sendEmail(to: string, subject: string, paragraphs: string[], button?: { label: string; url: string }) {
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">',
    '<p style="font-size:18px;font-weight:800;margin:0 0 16px">Pocket Sense</p>',
    ...paragraphs.map(p => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`),
    button
      ? `<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
      : '',
    '</div>',
  ].join('');
  const text = [...paragraphs, button ? `${button.label}: ${button.url}` : ''].filter(Boolean).join('\n\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM'), to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
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

/** Formats a date like the app does: "Sat 3 Oct". */
export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
}
