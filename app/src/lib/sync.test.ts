import { describe, expect, it } from 'vitest';
import { emptyData } from './store';
import { authMessage, isFresh, isValidData, merge, syncView } from './sync';
import type { Data, Purchase } from './types';

const base = (): Data => emptyData({ weekMoney: 120, incomeSources: [], wallets: ['Cash'], threshold: 15 }, { name: 'Headphones', target: 180 });
const buy = (id: string, at: number, extra: Partial<Purchase> = {}): Purchase =>
  ({ id, name: 'Lunch', cat: 'meals', amt: 5, wallet: 'Cash', mood: null, at, ...extra });

describe('isFresh', () => {
  it('treats onboarding-only data as fresh', () => {
    expect(isFresh(null)).toBe(true);
    expect(isFresh(base())).toBe(true);
    expect(isFresh({ ...base(), purchases: [buy('a', 1)] })).toBe(false);
    expect(isFresh({ ...base(), contribs: [{ id: 'c', label: 'Added', amt: 5, at: 1 }] })).toBe(false);
  });
});

describe('isValidData', () => {
  it('accepts app data and rejects anything else', () => {
    expect(isValidData(base())).toBe(true);
    expect(isValidData(null)).toBe(false);
    expect(isValidData({ ...base(), version: 2 })).toBe(false);
    expect(isValidData({ ...base(), purchases: 'nope' })).toBe(false);
  });
});

describe('merge', () => {
  it('keeps purchases from both sides, newest first', () => {
    const local = { ...base(), purchases: [buy('phone', 30)] };
    const server = { ...base(), purchases: [buy('pc', 20), buy('old', 10)] };
    expect(merge(local, server).purchases.map(p => p.id)).toEqual(['phone', 'pc', 'old']);
  });

  it("prefers this phone's copy of an item both sides have", () => {
    const local = { ...base(), purchases: [buy('a', 1, { mood: 'Bored' })] };
    const server = { ...base(), purchases: [buy('a', 1, { mood: null })] };
    const out = merge(local, server);
    expect(out.purchases).toHaveLength(1);
    expect(out.purchases[0].mood).toBe('Bored');
  });

  it("uses this phone's settings, goal and rules", () => {
    const local = { ...base(), goal: { name: 'Bike', target: 300 }, rules: { games: 'want' as const } };
    const server = { ...base(), goal: { name: 'Shoes', target: 90 }, rules: { snacks: 'need' as const } };
    const out = merge(local, server);
    expect(out.goal?.name).toBe('Bike');
    expect(out.rules).toEqual({ games: 'want' });
  });

  it('unions savings, parked items, look-backs and lessons without duplicates', () => {
    const local: Data = {
      ...base(),
      contribs: [{ id: 'c2', label: 'Added', amt: 5, at: 20 }],
      parking: [{ id: 'k1', name: 'Jacket', price: 40, createdAt: 5, endsAt: 10, outcome: 'skipped' }],
      lookbacks: [{ purchaseId: 'a', feeling: 'regret', usage: 'none', at: 9 }],
      lessons: [{ cat: 'games', mood: null }],
    };
    const server: Data = {
      ...base(),
      contribs: [{ id: 'c1', label: 'Added', amt: 10, at: 10 }],
      parking: [{ id: 'k1', name: 'Jacket', price: 40, createdAt: 5, endsAt: 10, outcome: 'pending' }],
      lookbacks: [{ purchaseId: 'a', feeling: 'worth', usage: 'lots', at: 8 }],
      lessons: [{ cat: 'games', mood: null }, { cat: 'snacks', mood: 'Bored' }],
    };
    const out = merge(local, server);
    expect(out.contribs.map(c => c.id)).toEqual(['c1', 'c2']);
    expect(out.parking).toEqual(local.parking);
    expect(out.lookbacks).toEqual(local.lookbacks);
    expect(out.lessons).toHaveLength(2);
  });

  it('is a no-op when both sides are the same', () => {
    const d = { ...base(), purchases: [buy('a', 2), buy('b', 1)] };
    expect(merge(d, d)).toEqual(d);
  });
});

describe('syncView', () => {
  it('matches the design labels', () => {
    expect(syncView('out', true, 0, false).label).toBe('');
    expect(syncView('in', true, 0, false).label).toBe('Synced');
    expect(syncView('in', true, 0, true).label).toBe('Syncing…');
    expect(syncView('in', false, 0, false).label).toBe('Offline');
    expect(syncView('in', false, 1, false).label).toBe('Offline · 1 change waiting');
    expect(syncView('in', false, 3, false).label).toBe('Offline · 3 changes waiting');
  });
});

describe('authMessage', () => {
  it('turns Supabase errors into plain sentences', () => {
    expect(authMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Wrong email or password.');
    expect(authMessage({ message: 'User already registered' })).toMatch(/already an account/);
    expect(authMessage({ status: 429, message: 'x' })).toMatch(/Too many tries/);
    expect(authMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/connection/);
  });
});
