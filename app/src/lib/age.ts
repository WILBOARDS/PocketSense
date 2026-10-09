// Is this person 18 yet? Decided from the full date of birth and today's date in Indonesia (Jakarta),
// so someone born in January 2008 counts as an adult from their birthday, not from next year.
//
// The server makes the real decision (public.is_minor in the database, and the same rule in
// supabase/functions/_shared/age.ts). This copy only shapes the form and what the app shows.
// age.test.ts checks that the two copies agree.

const ZONE = 'Asia/Jakarta';
const ADULT_AGE = 18;
const MIN_ACCOUNT_AGE = 13;
const OLDEST = 120;

/** Today in Jakarta as YYYY-MM-DD. */
export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole years between two YYYY-MM-DD dates (a birthday counts on the day itself; 29 Feb counts on 1 Mar in other years). */
export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Under 18 today. No date of birth counts as under 18, the safe side. */
export function isMinorOn(dob: string | null, today: string = todayJakarta()): boolean {
  return dob == null || ageOn(dob, today) < ADULT_AGE;
}

/** Under the minimum age for an account (13). No date is not "too young": it is "not finished". */
export function isTooYoungOn(dob: string | null, today: string = todayJakarta()): boolean {
  return dob != null && ageOn(dob, today) < MIN_ACCOUNT_AGE;
}

export type BirthDate = { ok: true; iso: string } | { ok: false };

/** Checks the three boxes of the form and returns the date as YYYY-MM-DD. */
export function parseBirthDate(day: string, month: string, year: string, today: string = todayJakarta()): BirthDate {
  if (![day, month, year].every(s => /^\d+$/.test(s.trim()))) return { ok: false };
  const d = Number(day), m = Number(month), y = Number(year);
  if (year.trim().length !== 4 || y < 1900) return { ok: false };
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return { ok: false };
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (iso > today || ageOn(iso, today) > OLDEST) return { ok: false };
  return { ok: true, iso };
}
