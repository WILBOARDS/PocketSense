// "Ask": questions about your own logged money, answered by an AI model on the server
// (supabase/functions/ask). This file decides what the AI gets to see and checks what comes back.
// Pure, like sync.ts: the request itself is in screens/Ask.tsx.
//
// Only a summary of the last 4 weeks goes out: amounts, categories, classes, moods, wallets and
// times. No email, birth year or account details. The numbers the answer card shows ("Left this week",
// "After buying") are worked out here from the same data, never taken from the AI.
import { catName, purchaseName } from './constants';
import { addDays, shortDate, clock } from './dates';
import { classifier, goalStats, parkingStats, weekStats } from './derive';
import { getCurrency } from './format';
import type { Data } from './types';

export interface Answer {
  headline: string;
  body: string;
  /** Set when the question was about buying one thing with a price. */
  price: number | null;
  item: string | null;
}

/** One question and what came back. History sent with the next question for follow-ups. */
export interface Turn {
  q: string;
  a?: Answer;
}

const MAX_PURCHASES = 60;

export function askContext(data: Data, now: number) {
  const week = weekStats(data, now);
  const g = goalStats(data, now);
  const pk = parkingStats(data, now);
  const cls = classifier(data);
  const since = addDays(now, -28);
  return {
    currency: getCurrency(),
    today: `${shortDate(now)} ${clock(now)}`,
    week: {
      money: week.weekMoney, spent: week.spent, left: week.left,
      day: week.day, daysLeftIncludingToday: 8 - week.day, purchases: week.purchases.length,
    },
    cooldownLinePercent: data.settings.threshold,
    goal: g.goal ? { name: g.goal.name, target: g.target, saved: g.saved, savedPerWeekLately: Math.round(g.weeklySave) } : null,
    purchases: data.purchases
      .filter(p => p.at >= since)
      .slice(0, MAX_PURCHASES)
      .map(p => ({
        when: `${shortDate(p.at)} ${clock(p.at)}`, name: purchaseName(p), category: catName(p.cat),
        class: cls(p).cls, amount: p.amt, mood: p.mood, wallet: p.wallet,
      })),
    parked: pk.waiting.concat(pk.ready).map(k => ({
      name: k.name, price: k.price, ready: k.endsAt <= now, promo: !!k.promo,
    })),
    skippedThisMonth: pk.skipped.length,
    keptThisMonth: pk.kept,
  };
}

/** Accepts only the shape the server promises, with sane lengths. */
export function isAnswer(v: unknown): v is Answer {
  const a = v as Answer;
  return !!a && typeof a.headline === 'string' && typeof a.body === 'string'
    && a.headline.length <= 200 && a.body.length <= 2000
    && (a.price === null || (typeof a.price === 'number' && isFinite(a.price) && a.price > 0))
    && (a.item === null || typeof a.item === 'string');
}
