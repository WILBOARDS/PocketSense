import { ART, CLS, WANT_MOODS, catById } from './constants';
import { dayKey } from './dates';
import { ord } from './format';
import type { CatId, Cls, Lesson, Purchase } from './types';

export interface Classification {
  cls: Cls;
  /** Up to two plain-language reasons, strongest first. */
  reasons: string[];
}

export interface ClassifyContext {
  all: Purchase[];
  rules: Partial<Record<CatId, Cls>>;
  lessons: Lesson[];
}

/**
 * Scores a purchase against each class and returns the winner with its top two reasons.
 * The category's usual class starts at 0.5; each Want signal adds a smaller weight,
 * so two or three signals together can tip a Need or Useful purchase into Want.
 */
export function classify(p: Purchase, ctx: ClassifyContext): Classification {
  const cat = catById(p.cat);
  if (p.override) return { cls: p.override, reasons: ['You picked this yourself'] };
  const rule = ctx.rules[p.cat];
  if (rule) return { cls: rule, reasons: [`You chose to always treat ${cat.name} as ${CLS[rule].label}`] };

  const score: Record<Cls, number> = { need: 0, useful: 0, want: 0, invest: 0 };
  const why: Record<Cls, [number, string][]> = { need: [], useful: [], want: [], invest: [] };
  const add = (k: Cls, v: number, text: string) => {
    score[k] += v;
    why[k].push([v, text]);
  };
  const short = (cat.short ?? cat.name).toLowerCase();
  const hour = new Date(p.at).getHours();

  add(cat.cls, 0.5, `${cat.name} is usually ${ART[cat.cls]}`);
  if (p.mood && WANT_MOODS.includes(p.mood)) add('want', cat.id === 'clothing' ? 0.4 : 0.2, `Tagged ${p.mood}`);
  if (hour >= 22 || hour < 3) add('want', 0.1, 'Bought after 10pm');
  if (cat.id === 'meals' && /deliver/i.test(p.name)) add('want', 0.4, 'Delivery instead of cooking or buying in');

  const lesson = ctx.lessons.find(l => l.cat === p.cat && (l.mood === null || l.mood === p.mood));
  if (lesson) add('want', 0.35, lesson.mood ? `You regretted a ${short} buy tagged ${lesson.mood}` : `You regretted a similar ${short} buy`);

  const day = dayKey(p.at);
  const earlierToday = ctx.all.filter(q => q.id !== p.id && q.cat === p.cat && dayKey(q.at) === day && q.at < p.at).length;
  if (earlierToday >= 2) add('want', 0.2, `${ord(earlierToday + 1)} ${short} buy today`);

  const others = ctx.all.filter(q => q.cat === p.cat && q.id !== p.id).map(q => q.amt).sort((a, b) => a - b);
  if (others.length >= 2) {
    const median = others[Math.floor(others.length / 2)];
    if (p.amt > 2 * median) add('want', 0.15, `More than 2x your usual ${short}`);
  }

  const cls = (Object.keys(score) as Cls[]).sort((a, b) => score[b] - score[a])[0];
  return { cls, reasons: why[cls].sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]) };
}
