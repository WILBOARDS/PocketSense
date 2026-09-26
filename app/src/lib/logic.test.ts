import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { dayLabel, dayOfWeek, startOfWeek, timeLeft, weekRange } from './dates';
import { goalStats, parkingStats, pendingLookbacks, repeatCandidates, weekStats } from './derive';
import { cleanAmount, money, money0, ord } from './format';
import { insights } from './insights';
import { emptyData } from './store';
import type { CatId, Data, Purchase } from './types';

// Sat 26 Sep 2026, 14:00 local
const NOW = new Date(2026, 8, 26, 14, 0).getTime();
const at = (day: number, hour: number, min = 0, month = 8) => new Date(2026, month, day, hour, min).getTime();

let seq = 0;
const buy = (name: string, cat: CatId, amt: number, t: number, mood: string | null = null): Purchase =>
  ({ id: `p${seq++}`, name, cat, amt, wallet: 'Cash', mood, at: t });

const base = (): Data => emptyData({ weekMoney: 120, incomeSources: ['Allowance'], wallets: ['Cash', 'E-wallet'], threshold: 15 }, { name: 'Headphones', target: 180 });
const ctx = (d: Data) => ({ all: d.purchases, rules: d.rules, lessons: d.lessons });

describe('format', () => {
  it('formats money', () => {
    expect(money(4.5)).toBe('$4.50');
    expect(money(-3)).toBe('-$3.00');
    expect(money0(120)).toBe('$120');
    expect(money0(12.5)).toBe('$12.50');
    expect(money0(1170)).toBe('$1,170');
    expect(money(1234.5)).toBe('$1,234.50');
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ord)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
  it('cleans typed amounts', () => {
    expect(cleanAmount('$12.345')).toBe('12.34');
    expect(cleanAmount('1.2.3')).toBe('1.23');
    expect(cleanAmount('abc')).toBe('');
  });
});

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(new Date(startOfWeek(NOW)).getDate()).toBe(21);
    expect(dayOfWeek(NOW)).toBe(6);
    expect(dayOfWeek(at(27, 9))).toBe(7);
    expect(dayOfWeek(at(21, 9))).toBe(1);
  });
  it('labels days and weeks like the design', () => {
    expect(dayLabel(at(26, 8), NOW)).toBe('Today · Sat 26 Sep');
    expect(dayLabel(at(25, 8), NOW)).toBe('Yesterday · Fri 25 Sep');
    expect(dayLabel(at(24, 8), NOW)).toBe('Thu 24 Sep');
    expect(weekRange(NOW)).toBe('21–27 Sep');
    expect(weekRange(at(1, 12, 0, 9))).toBe('28 Sep–4 Oct');
  });
  it('time left', () => {
    expect(timeLeft((3 * 60 + 12) * 60000)).toBe('3h 12m left');
    expect(timeLeft(40 * 60000)).toBe('40m left');
    expect(timeLeft(3 * 1440 * 60000)).toBe('3d 0h left');
  });
});

describe('classify', () => {
  it('uses the category default', () => {
    const d = base();
    d.purchases = [buy('Campus bus', 'transport', 1.25, at(26, 8))];
    expect(classify(d.purchases[0], ctx(d))).toEqual({ cls: 'need', reasons: ['Transport is usually a Need'] });
  });
  it('keeps the category class on a tie, tips to Want with one more signal', () => {
    const d = base();
    const top = buy('Flash-sale top', 'clothing', 14, at(25, 23, 20), 'Bored');
    d.purchases = [top];
    expect(classify(top, ctx(d)).cls).toBe('useful');
    d.purchases = [top, buy('Socks', 'clothing', 4, at(10, 9)), buy('Tee', 'clothing', 6, at(11, 9))];
    const c = classify(top, ctx(d));
    expect(c.cls).toBe('want');
    expect(c.reasons).toEqual(['Tagged Bored', 'More than 2x your usual clothing']);
  });
  it('flags delivery meals', () => {
    const d = base();
    d.purchases = [buy('Delivery lunch', 'meals', 11.8, at(26, 12, 35), 'Stressed')];
    expect(classify(d.purchases[0], ctx(d)).cls).toBe('want');
  });
  it('counts repeat buys in a day', () => {
    const d = base();
    d.purchases = [buy('Snacks', 'snacks', 2, at(26, 8)), buy('Snacks', 'snacks', 2, at(26, 10)), buy('Snacks', 'snacks', 2, at(26, 12))];
    const c = classify(d.purchases[2], ctx(d));
    expect(c.reasons).toEqual(['Snacks & drinks is usually a Want', '3rd snacks buy today']);
  });
  it('overrides and rules win', () => {
    const d = base();
    const p = buy('Top', 'clothing', 14, at(25, 9));
    d.purchases = [{ ...p, override: 'invest' }];
    expect(classify(d.purchases[0], ctx(d)).cls).toBe('invest');
    d.purchases = [p];
    d.rules = { clothing: 'need' };
    expect(classify(p, ctx(d))).toEqual({ cls: 'need', reasons: ['You chose to always treat Clothing as Need'] });
  });
  it('learns from a regretted check-in', () => {
    const d = base();
    const p = buy('Jacket', 'clothing', 38, at(26, 9), 'Treating myself');
    d.purchases = [p];
    d.lessons = [{ cat: 'clothing', mood: null }];
    expect(classify(p, ctx(d)).cls).toBe('want');
  });
});

describe('week, goal, parking', () => {
  it('computes money left and Sunday pace', () => {
    const d = base();
    d.purchases = [buy('A', 'meals', 30, at(22, 9)), buy('B', 'meals', 30, at(25, 9)), buy('Old', 'meals', 50, at(19, 9))];
    d.incomes = [{ id: 'i', src: 'Gift', amt: 10, at: at(24, 9) }];
    const w = weekStats(d, NOW);
    expect(w.weekMoney).toBe(130);
    expect(w.spent).toBe(60);
    expect(w.left).toBe(70);
    expect(w.sunday).toBeCloseTo(70 - 10);
  });
  it('goal progress and eta from the last 4 weeks', () => {
    const d = base();
    d.contribs = [{ id: 'c', label: 'Added', amt: 40, at: at(20, 9) }];
    const g = goalStats(d, NOW);
    expect(g.pct).toBe(22);
    expect(g.weeklySave).toBe(10);
    expect(g.eta).toMatch(/^About \d+ \w{3}$/);
    d.contribs = [];
    expect(goalStats(d, NOW).hasRate).toBe(false);
  });
  it('splits parked items into ready, waiting and decided', () => {
    const d = base();
    d.parking = [
      { id: 'a', name: 'speaker', price: 34, createdAt: NOW - 1, endsAt: NOW + 60000, outcome: 'pending' },
      { id: 'b', name: 'hoodie', price: 28, createdAt: NOW - 1, endsAt: NOW - 60000, outcome: 'pending' },
      { id: 'c', name: 'sneakers', price: 42, createdAt: NOW - 1, endsAt: NOW - 1, outcome: 'skipped', decidedAt: at(14, 9) },
      { id: 'd', name: 'novel', price: 9, createdAt: NOW - 1, endsAt: NOW - 1, outcome: 'bought', decidedAt: at(6, 9) },
      { id: 'e', name: 'august', price: 9, createdAt: NOW - 1, endsAt: NOW - 1, outcome: 'skipped', decidedAt: at(20, 9, 0, 7) },
    ];
    const pk = parkingStats(d, NOW);
    expect(pk.ready.map(k => k.id)).toEqual(['b']);
    expect(pk.waiting.map(k => k.id)).toEqual(['a']);
    expect(pk.decided.map(k => k.id)).toEqual(['c', 'd']);
    expect(pk.saverLine).toBe('You skipped 1 of 2 parked items this month and kept $42.');
  });
  it('offers a look-back 14 days after a bigger non-essential buy', () => {
    const d = base();
    const jacket = buy('Denim jacket', 'clothing', 38, at(12, 15));
    d.purchases = [jacket, buy('Bus', 'transport', 38, at(12, 9)), buy('Cheap top', 'clothing', 5, at(12, 9)), buy('New top', 'clothing', 38, at(20, 9))];
    expect(pendingLookbacks(d, NOW).map(p => p.id)).toEqual([jacket.id]);
    d.lookbacks = [{ purchaseId: jacket.id, feeling: 'worth', usage: 'lots', at: NOW }];
    expect(pendingLookbacks(d, NOW)).toEqual([]);
  });
  it('suggests repeat chips for things bought twice', () => {
    const d = base();
    d.purchases = [buy('Iced coffee', 'snacks', 4.5, at(24, 8)), buy('Iced coffee', 'snacks', 4.5, at(26, 8)), buy('Crisps', 'snacks', 2.1, at(23, 15))];
    expect(repeatCandidates(d, NOW).map(r => r.name)).toEqual(['Iced coffee']);
  });
});

describe('insights', () => {
  it('stays in learning mode for the first 2 weeks', () => {
    const d = base();
    d.purchases = [buy('A', 'snacks', 3, at(25, 9))];
    expect(insights(d, NOW).learning).toBe(true);
  });
  it('finds an impulse spike and a leak', () => {
    const d = base();
    const coffees = Array.from({ length: 19 }, (_, i) => buy('Iced coffee', 'snacks', 4.5, NOW - i * 1.4 * 86_400_000));
    d.purchases = [
      buy('Old', 'meals', 5, at(1, 9)),
      buy('Top', 'clothing', 14, at(25, 23), 'Bored'),
      buy('Game', 'games', 5, at(24, 23, 30)),
      buy('Snack', 'snacks', 3, at(23, 15), 'Stressed'),
      ...coffees,
    ];
    const ins = insights(d, NOW);
    expect(ins.learning).toBe(false);
    expect(ins.impulse?.line).toBe('This week had 2 late-night buys, and 2 purchases tagged Bored or Stressed.');
    expect(ins.leak?.name).toBe('Iced coffee');
    expect(ins.leak?.line).toMatch(/^Iced coffee, about 5 a week, adds up to about \$1,?\d+ a year\. That's your headphones \d times over\.$/);
    expect(ins.oneThing).toBe("If I'm bored after 10pm, I'll park it instead of buying.");
  });
  it('needs enough data for the ratio stats', () => {
    const d = base();
    d.purchases = [buy('A', 'snacks', 3, at(25, 9), 'Bored')];
    const ins = insights(d, NOW);
    expect(ins.boredVs).toBeNull();
    expect(ins.regret).toBeNull();
    d.lookbacks = ['regret', 'worth', 'worth', 'meh', 'worth'].map((f, i) => ({ purchaseId: String(i), feeling: f as 'regret', usage: 'lots' as const, at: NOW }));
    expect(insights(d, NOW).regret).toBe('1 in 5');
  });
});
