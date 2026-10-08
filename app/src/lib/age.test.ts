import { describe, expect, it } from 'vitest';
import * as server from '../../../supabase/functions/_shared/age';
import { ageOn, isMinorOn, parseBirthDate, todayJakarta } from './age';

describe('age from the full date', () => {
  it('turns 18 on the birthday, not on 1 January', () => {
    expect(isMinorOn('2008-01-15', '2026-01-14')).toBe(true);
    expect(isMinorOn('2008-01-15', '2026-01-15')).toBe(false);
    expect(isMinorOn('2008-12-20', '2026-10-08')).toBe(true);
    expect(isMinorOn('2008-12-20', '2026-12-19')).toBe(true);
    expect(isMinorOn('2008-12-20', '2026-12-20')).toBe(false);
  });

  it('counts a 29 February birthday from 1 March in years without a 29 Feb', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
    expect(ageOn('2008-02-29', '2028-02-29')).toBe(20);
  });

  it('treats a missing date as under 18', () => {
    expect(isMinorOn(null, '2026-10-08')).toBe(true);
  });

  it('uses the date in Jakarta, which is ahead of UTC', () => {
    // 17:30 UTC on 14 Jan is already 00:30 on 15 Jan in Jakarta.
    expect(todayJakarta(new Date('2026-01-14T17:30:00Z'))).toBe('2026-01-15');
    expect(todayJakarta(new Date('2026-01-14T16:30:00Z'))).toBe('2026-01-14');
  });

  it('the app and server copies agree on every day of two years for several birthdays', () => {
    const births = ['2008-01-01', '2008-02-29', '2008-10-08', '2008-12-31', '2007-06-15', '1990-03-03'];
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 86_400_000) {
      const today = new Date(t).toISOString().slice(0, 10);
      for (const b of births) expect(isMinorOn(b, today), `${b} on ${today}`).toBe(server.isMinorOn(b, today));
    }
    expect(todayJakarta(new Date('2026-06-01T20:00:00Z'))).toBe(server.todayJakarta(new Date('2026-06-01T20:00:00Z')));
  });
});

describe('parseBirthDate', () => {
  const today = '2026-10-08';
  it('accepts a real date and pads it', () => {
    expect(parseBirthDate('5', '3', '2008', today)).toEqual({ ok: true, iso: '2008-03-05' });
  });
  it('rejects dates that do not exist', () => {
    expect(parseBirthDate('31', '4', '2008', today).ok).toBe(false);
    expect(parseBirthDate('29', '2', '2009', today).ok).toBe(false);
    expect(parseBirthDate('29', '2', '2008', today).ok).toBe(true);
    expect(parseBirthDate('0', '1', '2008', today).ok).toBe(false);
    expect(parseBirthDate('1', '13', '2008', today).ok).toBe(false);
  });
  it('rejects the future, very old dates and non-numbers', () => {
    expect(parseBirthDate('9', '10', '2026', today).ok).toBe(false);
    expect(parseBirthDate('8', '10', '2026', today).ok).toBe(true);
    expect(parseBirthDate('1', '1', '1890', today).ok).toBe(false);
    expect(parseBirthDate('1', '1', '1900', '2026-10-08').ok).toBe(false);
    expect(parseBirthDate('a', '1', '2008', today).ok).toBe(false);
    expect(parseBirthDate('', '', '', today).ok).toBe(false);
    expect(parseBirthDate('1', '1', '08', today).ok).toBe(false);
  });
});
