// Pure helpers for syncing the app data with the account. No network or storage here, so they can be tested.
import type { Data } from './types';

/** No purchases, income, savings, parked items or look-backs yet: just onboarding answers at most. */
export function isFresh(d: Data | null): boolean {
  return !d || (!d.purchases.length && !d.incomes.length && !d.contribs.length && !d.parking.length && !d.lookbacks.length);
}

/** True when a value from the server looks like app data this version can use. */
export function isValidData(v: unknown): v is Data {
  const d = v as Data;
  return !!d && typeof d === 'object' && d.version === 1 && !!d.settings
    && [d.purchases, d.incomes, d.contribs, d.parking, d.lookbacks, d.lessons].every(Array.isArray);
}

function unionBy<T>(local: T[], server: T[], key: (x: T) => string): T[] {
  const out = new Map<string, T>();
  for (const x of server) out.set(key(x), x);
  for (const x of local) out.set(key(x), x);
  return [...out.values()];
}

/**
 * Combines this phone's copy with the account's copy when both changed.
 * Nothing in the app is ever deleted, so every purchase, income, saving, parked item and look-back
 * from either side is kept. When both sides have the same item, or for settings, goal and rules,
 * this phone's version wins, because it holds the edits that haven't synced yet.
 */
export function merge(local: Data, server: Data): Data {
  const lessonKey = (l: Data['lessons'][number]) => `${l.cat}|${l.mood ?? ''}`;
  return {
    ...local,
    purchases: unionBy(local.purchases, server.purchases, p => p.id).sort((a, b) => b.at - a.at),
    incomes: unionBy(local.incomes, server.incomes, i => i.id).sort((a, b) => b.at - a.at),
    contribs: unionBy(local.contribs, server.contribs, c => c.id).sort((a, b) => a.at - b.at),
    parking: unionBy(local.parking, server.parking, k => k.id).sort((a, b) => b.createdAt - a.createdAt),
    lookbacks: unionBy(local.lookbacks, server.lookbacks, l => l.purchaseId).sort((a, b) => a.at - b.at),
    lessons: unionBy(local.lessons, server.lessons, lessonKey),
  };
}

export interface SyncView {
  label: string;
  /** Colour of the small square before the label. */
  dot: string;
  fg: string;
}

export type AccountStatus = 'off' | 'out' | 'in' | 'pendingConsent';

/** The status line under the date on Home and in Settings. Empty label when signed out. */
export function syncView(status: AccountStatus, online: boolean, pending: number, syncing: boolean): SyncView {
  const ink = 'var(--color-text)', grey = 'var(--color-neutral-500)';
  if (status === 'pendingConsent') return { label: 'Sync waits for parent', dot: grey, fg: ink };
  if (status !== 'in') return { label: '', dot: ink, fg: ink };
  if (!online) {
    return {
      label: pending ? `Offline · ${pending} change${pending > 1 ? 's' : ''} waiting` : 'Offline',
      dot: 'var(--color-accent)', fg: 'var(--color-accent-700)',
    };
  }
  if (syncing || pending) return { label: 'Syncing…', dot: grey, fg: ink };
  return { label: 'Synced', dot: ink, fg: ink };
}

/** Turns Supabase auth errors into sentences for the sign-in screen. */
export function authMessage(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const m = (err?.message ?? '').toLowerCase();
  const code = err?.code ?? '';
  if (code === 'invalid_credentials' || m.includes('invalid login')) return 'Wrong email or password.';
  if (code === 'user_already_exists' || m.includes('already registered')) return "There's already an account with this email. Sign in instead.";
  if (code === 'email_not_confirmed' || m.includes('not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (code === 'weak_password' || m.includes('password should')) return 'Pick a stronger password: at least 8 characters, not a common one.';
  if (code === 'same_password') return 'Use a different password from your old one.';
  if (err?.status === 429 || m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network') || err?.status === 0) return "Can't reach the server. Check your connection.";
  return err?.message || 'Something went wrong. Try again.';
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
