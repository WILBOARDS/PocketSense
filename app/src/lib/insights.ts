import { CLS_KEYS, LEARNING_DAYS } from './constants';
import { addDays, daysBetween } from './dates';
import { classifier, parkingStats, weekStats } from './derive';
import { capitalize, money0, plural } from './format';
import type { Cls, Data } from './types';

/*
 * The design showed fixed sample figures. These are the formulas behind the real numbers.
 * They are simple on purpose and should be tuned once there is real usage:
 * - Impulse score: share of this week's purchases made after 10pm or tagged Bored/Stressed/Treating myself.
 * - Leak score: what the repeat buy costs per year as a share of a year of weekly money, x4, capped at 100.
 * - Bored vs Needed it: average spend per purchase tagged Bored ÷ tagged Needed it, last 4 weeks, min 3 of each.
 * - Regret rate: check-ins answered "Regret it" ÷ all check-ins, min 3 check-ins.
 */

const NEED_CATS = new Set(['meals', 'transport', 'school', 'savings']);

export interface Impulse {
  score: number;
  line: string;
  basis: string;
  lateNight: number;
}

export interface Leak {
  score: number;
  line: string;
  basis: string;
  name: string;
}

export function insights(data: Data, now: number) {
  const cls = classifier(data);
  const week = weekStats(data, now);
  const W = week.purchases;

  const totals = CLS_KEYS.map(k => ({ k, v: W.filter(p => cls(p).cls === k).reduce((a, p) => a + p.amt, 0) }));

  const first = data.purchases.reduce((m, p) => Math.min(m, p.at), Infinity);
  const learning = !isFinite(first) || daysBetween(first, now) < LEARNING_DAYS;

  // Impulse spike
  const isLate = (t: number) => {
    const h = new Date(t).getHours();
    return h >= 22 || h < 3;
  };
  const lateNight = W.filter(p => isLate(p.at)).length;
  const boredStressed = W.filter(p => p.mood === 'Bored' || p.mood === 'Stressed').length;
  const impulsive = W.filter(p => isLate(p.at) || (p.mood && ['Bored', 'Stressed', 'Treating myself'].includes(p.mood))).length;
  let impulse: Impulse | null = null;
  if (W.length && impulsive >= 2) {
    const parts = [
      lateNight ? plural(lateNight, 'late-night buy') : '',
      boredStressed ? `${plural(boredStressed, 'purchase')} tagged Bored or Stressed` : '',
    ].filter(Boolean);
    const line = parts.length
      ? `This week had ${parts.join(', and ')}.`
      : `This week had ${plural(impulsive, 'purchase')} tagged Treating myself.`;
    impulse = { score: Math.round((impulsive / W.length) * 100), line, basis: `Based on ${plural(W.length, 'purchase')}`, lateNight };
  }

  // Leak: the most expensive small repeat buy over the last 4 weeks
  const since = addDays(now, -28);
  const groups = new Map<string, { name: string; count: number; total: number }>();
  for (const p of data.purchases) {
    if (p.at < since || NEED_CATS.has(p.cat)) continue;
    const key = p.name.toLowerCase();
    const g = groups.get(key) ?? { name: p.name, count: 0, total: 0 };
    g.count++;
    g.total += p.amt;
    groups.set(key, g);
  }
  let leak: Leak | null = null;
  const top = [...groups.values()].filter(g => g.count >= 4).sort((a, b) => b.total - a.total)[0];
  if (top) {
    const perWeek = top.count / 4;
    const yearly = (top.total / top.count) * perWeek * 52;
    const yearlyStr = money0(Math.round(yearly / 10) * 10);
    let line = `${capitalize(top.name)}, about ${Math.round(perWeek)} a week, adds up to about ${yearlyStr} a year.`;
    if (data.goal && data.goal.target > 0) {
      const times = Math.floor(yearly / data.goal.target);
      line += times >= 2
        ? ` That's your ${data.goal.name.toLowerCase()} ${times} times over.`
        : times === 1
          ? ` That's more than your ${data.goal.name.toLowerCase()}.`
          : ` That's ${Math.round((yearly / data.goal.target) * 100)}% of your ${data.goal.name.toLowerCase()}.`;
    }
    const share = yearly / Math.max(1, data.settings.weekMoney * 52);
    leak = { score: Math.min(100, Math.round(share * 400)), line, basis: `Based on ${plural(top.count, 'buy')} in 4 weeks`, name: top.name };
  }

  const parking = parkingStats(data, now);

  // Bored vs Needed it
  const recent = data.purchases.filter(p => p.at >= since);
  const bored = recent.filter(p => p.mood === 'Bored');
  const needed = recent.filter(p => p.mood === 'Needed it');
  const avg = (xs: typeof recent) => xs.reduce((a, p) => a + p.amt, 0) / xs.length;
  let boredVs: { value: string; line: string } | null = null;
  if (bored.length >= 3 && needed.length >= 3) {
    const r = avg(bored) / avg(needed);
    boredVs = r >= 1
      ? { value: `${r.toFixed(1)}x`, line: 'more per purchase when Bored' }
      : { value: `${(1 / r).toFixed(1)}x`, line: 'less per purchase when Bored' };
  }
  const boredBasis = `${bored.length} Bored, ${needed.length} Needed it`;

  // Regret rate
  const n = data.lookbacks.length;
  const regrets = data.lookbacks.filter(l => l.feeling === 'regret').length;
  let regret: string | null = null;
  if (n >= 3) regret = regrets === 0 ? `0 of ${n}` : regrets / n > 0.5 ? `${regrets} of ${n}` : `1 in ${Math.round(n / regrets)}`;

  // This week's one thing
  const oneThing = impulse
    ? impulse.lateNight
      ? "If I'm bored after 10pm, I'll park it instead of buying."
      : "If I'm bored or stressed, I'll park it instead of buying."
    : leak
      ? `I'll skip one ${leak.name.toLowerCase()} this week${data.goal ? ' and add it to my goal' : ''}.`
      : `I'll check anything over my ${data.settings.threshold}% line before buying.`;

  return {
    week,
    totals: totals as { k: Cls; v: number }[],
    learning,
    impulse,
    leak,
    saver: parking.decided.length ? parking.saverLine : null,
    boredVs,
    boredBasis,
    regret,
    regretBasis: `Based on ${plural(n, 'check-in')}`,
    oneThing,
  };
}
