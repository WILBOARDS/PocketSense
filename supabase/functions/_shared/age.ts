// The server's copy of the age rule. It must match public.is_minor() in the database
// (supabase/migrations/20261008000000_date_of_birth.sql) and app/src/lib/age.ts; age.test.ts checks the two TypeScript copies.
// Under 18 is decided from the full date of birth and today's date in Jakarta. No date of birth counts as under 18.

const ADULT_AGE = 18;
const MIN_ACCOUNT_AGE = 13;

export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function isMinorOn(dob: string | null, today: string = todayJakarta()): boolean {
  return dob == null || ageOn(dob, today) < ADULT_AGE;
}

/** Under the minimum age for an account. No date is not "too young": it is "not finished". */
export function isTooYoungOn(dob: string | null, today: string = todayJakarta()): boolean {
  return dob != null && ageOn(dob, today) < MIN_ACCOUNT_AGE;
}
