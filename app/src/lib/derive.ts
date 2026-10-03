import { classify, type Classification } from './classify';
import { LOOKBACK_DAYS } from './constants';
import { addDays, dayOfWeek, daysBetween, dayMonth, endOfWeek, startOfMonth, startOfWeek } from './dates';
import { money0, plural } from './format';
import { tr } from './i18n';
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
  const weeksLeft = weeklySave > 0 ? Math.ceil((target - saved) / weeklySave) : 0;
  if (!goal) eta = '';
  else if (reached) eta = tr('Reached', 'Tercapai');
  else if (weeklySave <= 0) eta = tr('No end date yet. Add money to see one.', 'Belum ada perkiraan. Tambah uang untuk melihatnya.');
  else eta = tr(`About ${dayMonth(addDays(now, Math.ceil(((target - saved) / weeklySave) * 7)))}`,
    `Sekitar ${dayMonth(addDays(now, Math.ceil(((target - saved) / weeklySave) * 7)))}`);
  /** "About 6 weeks to go", the short line on Home. */
  const etaShort = !goal || reached || weeklySave <= 0 ? eta
    : weeksLeft <= 1 ? tr('About a week to go', 'Sekitar seminggu lagi')
    : tr(`About ${weeksLeft} weeks to go`, `Sekitar ${weeksLeft} minggu lagi`);
  return { goal, saved, target, pct, weeklySave, reached, eta, etaShort, hasRate: weeklySave > 0 };
}

export function parkingStats(data: Data, now: number) {
  const month = startOfMonth(now);
  const pending = data.parking.filter(k => k.outcome === 'pending');
  const decided = data.parking
    .filter((k): k is Parked & { decidedAt: number } => k.outcome !== 'pending' && (k.decidedAt ?? 0) >= month)
    .sort((a, b) => b.decidedAt - a.decidedAt);
  const skipped = decided.filter(k => k.outcome === 'skipped');
  const kept = skipped.reduce((a, k) => a + k.price, 0);
  const saverLine = !decided.length
    ? tr('Nothing decided yet this month.', 'Belum ada yang diputuskan bulan ini.')
    : skipped.length === decided.length
      ? tr(`You skipped ${plural(skipped.length, 'thing')} this month and kept ${money0(kept)}.`,
        `Bulan ini kamu melewatkan ${skipped.length} barang dan menyimpan ${money0(kept)}.`)
      : tr(`You skipped ${skipped.length} of ${decided.length} parked items this month and kept ${money0(kept)}.`,
        `Bulan ini kamu melewatkan ${skipped.length} dari ${decided.length} barang yang diparkir dan menyimpan ${money0(kept)}.`);
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
