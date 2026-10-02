import { WANT_MOODS, art, catById, catName, catShort, cls as clsStyle, moodLabel } from './constants';
import { dayKey } from './dates';
import { ord } from './format';
import { tr } from './i18n';
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
  const name = catName(p.cat);
  if (p.override) return { cls: p.override, reasons: [tr('You picked this yourself', 'Kamu sendiri yang memilih ini')] };
  const rule = ctx.rules[p.cat];
  if (rule) {
    const label = clsStyle(rule).label;
    return { cls: rule, reasons: [tr(`You chose to always treat ${name} as ${label}`, `Kamu memilih ${name} selalu dianggap ${label}`)] };
  }

  const score: Record<Cls, number> = { need: 0, useful: 0, want: 0, invest: 0 };
  const why: Record<Cls, [number, string][]> = { need: [], useful: [], want: [], invest: [] };
  const add = (k: Cls, v: number, text: string) => {
    score[k] += v;
    why[k].push([v, text]);
  };
  const short = catShort(p.cat).toLowerCase();
  const hour = new Date(p.at).getHours();

  add(cat.cls, 0.5, tr(`${name} is usually ${art(cat.cls)}`, `${name} biasanya ${art(cat.cls)}`));
  if (p.mood && WANT_MOODS.includes(p.mood)) {
    add('want', cat.id === 'clothing' ? 0.4 : 0.2, tr(`Tagged ${p.mood}`, `Ditandai ${moodLabel(p.mood)}`));
  }
  if (hour >= 22 || hour < 3) add('want', 0.1, tr('Bought after 10pm', 'Dibeli di atas jam 10 malam'));
  if (cat.id === 'meals' && /deliver|gofood|grabfood|shopeefood|pesan antar/i.test(p.name)) {
    add('want', 0.4, tr('Delivery instead of cooking or buying in', 'Pesan antar, bukan masak atau beli langsung'));
  }

  const lesson = ctx.lessons.find(l => l.cat === p.cat && (l.mood === null || l.mood === p.mood));
  if (lesson) {
    add('want', 0.35, lesson.mood
      ? tr(`You regretted a ${short} buy tagged ${lesson.mood}`, `Kamu menyesali pembelian ${short} yang ditandai ${moodLabel(lesson.mood)}`)
      : tr(`You regretted a similar ${short} buy`, `Kamu menyesali pembelian ${short} yang mirip`));
  }

  const day = dayKey(p.at);
  const earlierToday = ctx.all.filter(q => q.id !== p.id && q.cat === p.cat && dayKey(q.at) === day && q.at < p.at).length;
  if (earlierToday >= 2) {
    add('want', 0.2, tr(`${ord(earlierToday + 1)} ${short} buy today`, `Pembelian ${short} ke-${earlierToday + 1} hari ini`));
  }

  const others = ctx.all.filter(q => q.cat === p.cat && q.id !== p.id).map(q => q.amt).sort((a, b) => a - b);
  if (others.length >= 2) {
    const median = others[Math.floor(others.length / 2)];
    if (p.amt > 2 * median) add('want', 0.15, tr(`More than 2x your usual ${short}`, `Lebih dari 2x ${short} biasanya`));
  }

  const cls = (Object.keys(score) as Cls[]).sort((a, b) => score[b] - score[a])[0];
  return { cls, reasons: why[cls].sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]) };
}
