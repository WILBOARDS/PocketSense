import { classify, type Classification } from './classify';
import { LOOKBACK_DAYS } from './constants';
import { addDays, dayOfWeek, daysBetween, dayMonth, endOfWeek, startOfMonth, startOfWeek } from './dates';
import { money0 } from './format';
import type { CatId, Data, Parked, Purchase } from './types';

const inRange = (t: number, from: number, to: number) => t >= from && t < to;

export const classifier = (data: Data) => {
  const cache = new Map<string, Classification>();
  const ctx = { all: data.purchases, rules: data.rules, lessons: data.lessons };
  return (p: Purchase) => {
    let c = cache.get(p.id);
    if (!c) {
      c = classify(p, ctx);
      cache.set(p.id, c);
    }
    return c;
  };
};

export function weekStats(data: Data, now: number) {
  const from = startOfWeek(now), to = endOfWeek(now);
  const purchases = data.purchases.filter(p => inRange(p.at, from, to));
  const extraIncome = data.incomes.filter(i => inRange(i.at, from, to)).reduce((a, i) => a + i.amt, 0);
  const weekMoney = data.settings.weekMoney + extraIncome;
  const spent = purchases.reduce((a, p) => a + p.amt, 0);
  const left = weekMoney - spent;
  const day = dayOfWeek(now);
  // Daily pace so far, projected over the days still to come (today counts as spent-in).
  const pace = spent / day;
  const sunday = left - pace * (7 - day);
  return { purchases, weekMoney, spent, left, day, sunday };
}

export function goalStats(data: Data, now: number) {
  const goal = data.goal;
  const saved = data.contribs.reduce((a, c) => a + c.amt, 0);
  const target = goal?.target ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const recent = data.contribs.filter(c => c.at >= addDays(now, -28)).reduce((a, c) => a + c.amt, 0);
  const weeklySave = recent / 4;
  const reached = !!goal && saved >= target;
  let eta: string;
  if (!goal) eta = '';
  else if (reached) eta = 'Reached';
  else if (weeklySave <= 0) eta = 'No end date yet. Add money to see one.';
  else eta = `About ${dayMonth(addDays(now, Math.ceil(((target - saved) / weeklySave) * 7)))}`;
  return { goal, saved, target, pct, weeklySave, reached, eta, hasRate: weeklySave > 0 };
}

export function parkingStats(data: Data, now: number) {
  const month = startOfMonth(now);
  const pending = data.parking.filter(k => k.outcome === 'pending');
  const decided = data.parking
    .filter((k): k is Parked & { decidedAt: number } => k.outcome !== 'pending' && (k.decidedAt ?? 0) >= month)
    .sort((a, b) => b.decidedAt - a.decidedAt);
  const skipped = decided.filter(k => k.outcome === 'skipped');
  const kept = skipped.reduce((a, k) => a + k.price, 0);
  const saverLine = decided.length
    ? `You skipped ${skipped.length} of ${decided.length} parked items this month and kept ${money0(kept)}.`
    : 'Nothing decided yet this month.';
  return {
    ready: pending.filter(k => k.endsAt <= now).sort((a, b) => a.endsAt - b.endsAt),
    waiting: pending.filter(k => k.endsAt > now).sort((a, b) => a.endsAt - b.endsAt),
    decided,
    skipped,
    kept,
    saverLine,
  };
}

/** Purchases over the cooldown line that are old enough for a "was it worth it?" check-in. */
export function pendingLookbacks(data: Data, now: number) {
  const cls = classifier(data);
  const line = (data.settings.weekMoney * data.settings.threshold) / 100;
  const done = new Set(data.lookbacks.map(l => l.purchaseId));
  return data.purchases
    .filter(p => {
      const age = daysBetween(p.at, now);
      const c = cls(p).cls;
      return !done.has(p.id) && age >= LOOKBACK_DAYS && age <= 60 && p.amt >= line && (c === 'useful' || c === 'want');
    })
    .sort((a, b) => a.at - b.at);
}

/** Purchases bought at least twice with the same name and amount in the last 4 weeks. */
export function repeatCandidates(data: Data, now: number, max = 2) {
  const since = addDays(now, -28);
  const groups = new Map<string, { name: string; cat: CatId; amt: number; count: number; last: number }>();
  for (const p of data.purchases) {
    if (p.at < since) continue;
    const key = `${p.name.toLowerCase()}|${p.cat}|${p.amt}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      g.last = Math.max(g.last, p.at);
    } else groups.set(key, { name: p.name, cat: p.cat, amt: p.amt, count: 1, last: p.at });
  }
  return [...groups.values()]
    .filter(g => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, max);
}
