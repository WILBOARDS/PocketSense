import { tr } from './i18n';
import type { CatId, Cls, Currency } from './types';

export interface Category {
  id: CatId;
  name: string;
  short?: string;
  /** Indonesian name and short name. */
  nameId: string;
  shortId?: string;
  cls: Cls;
}

export const CATS: Category[] = [
  { id: 'meals', name: 'Meals', nameId: 'Makan', cls: 'need' },
  { id: 'snacks', name: 'Snacks & drinks', short: 'Snacks', nameId: 'Jajan & minuman', shortId: 'Jajan', cls: 'want' },
  { id: 'transport', name: 'Transport', nameId: 'Transport', cls: 'need' },
  { id: 'school', name: 'School & books', short: 'School', nameId: 'Kuliah & buku', shortId: 'Kuliah', cls: 'need' },
  { id: 'clothing', name: 'Clothing', nameId: 'Pakaian', cls: 'useful' },
  { id: 'subs', name: 'Subscriptions', short: 'Subs', nameId: 'Langganan', cls: 'useful' },
  { id: 'games', name: 'Games & in-app', short: 'Games', nameId: 'Game & in-app', shortId: 'Game', cls: 'want' },
  { id: 'savings', name: 'Savings transfer', short: 'Savings', nameId: 'Transfer tabungan', shortId: 'Tabungan', cls: 'invest' },
];
/** Purchases saved under a category the user named. Not offered in the list; "Custom…" creates them. */
const OTHER: Category = { id: 'other', name: 'Other', nameId: 'Lainnya', cls: 'useful' };

export const catById = (id: CatId): Category => CATS.find(c => c.id === id) ?? OTHER;
export const catName = (id: CatId) => {
  const c = catById(id);
  return tr(c.name, c.nameId);
};
export const catShort = (id: CatId) => {
  const c = catById(id);
  return tr(c.short ?? c.name, c.shortId ?? c.nameId);
};

export interface ClsStyle {
  label: string;
  bg: string;
  fg: string;
  bd: string;
}

const CLS_STYLE: Record<Cls, Omit<ClsStyle, 'label'> & { en: string; id: string }> = {
  need: { en: 'Need', id: 'Butuh', bg: 'var(--color-text)', fg: 'var(--color-bg)', bd: 'var(--color-text)' },
  useful: { en: 'Useful', id: 'Berguna', bg: 'transparent', fg: 'var(--color-text)', bd: 'var(--color-text)' },
  want: { en: 'Want', id: 'Ingin', bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)', bd: 'var(--color-accent-400)' },
  invest: { en: 'Invest', id: 'Investasi', bg: 'var(--color-accent-700)', fg: '#fff', bd: 'var(--color-accent-700)' },
};

/** A class's colours and its label in the current language. */
export const cls = (k: Cls): ClsStyle => {
  const s = CLS_STYLE[k];
  return { label: tr(s.en, s.id), bg: s.bg, fg: s.fg, bd: s.bd };
};

export const CLS_KEYS: Cls[] = ['need', 'useful', 'want', 'invest'];

/** "Meals is usually a Need" / "Clothing is usually Useful". */
export const art = (k: Cls) => tr({ need: 'a Need', useful: 'Useful', want: 'a Want', invest: 'Invest' }[k], cls(k).label);

// Moods, wallets and income sources are saved in English so data stays the same in both languages.
// These translate them for display.
const MOOD_ID: Record<string, string> = {
  'Needed it': 'Memang perlu', Bored: 'Bosan', Stressed: 'Stres', Celebrating: 'Merayakan',
  Hungry: 'Lapar', Tired: 'Capek', 'Social pressure': 'Ikut teman', 'Treating myself': 'Self-reward',
};
export const MOODS = Object.keys(MOOD_ID);
export const WANT_MOODS = ['Bored', 'Stressed', 'Treating myself'];
export const moodLabel = (m: string) => tr(m, MOOD_ID[m] ?? m);

const WORD_ID: Record<string, string> = {
  Cash: 'Tunai', 'Debit card': 'Kartu debit', "Parent's card": 'Kartu orang tua', Card: 'Kartu',
  Allowance: 'Uang saku', 'Part-time': 'Kerja paruh waktu', Gift: 'Hadiah', Other: 'Lainnya',
};
/** A wallet or income source name in the current language. Names the user typed stay as they are. */
export const wordLabel = (w: string) => tr(w, WORD_ID[w] ?? w);

export const INCOME_SRC = ['Allowance', 'Part-time', 'Gift', 'Freelance', 'Other'];
export const WALLET_CHOICES = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'Cash', 'Debit card', "Parent's card"];
export const defaultWallets = (c: Currency | undefined) => (c === 'IDR' ? ['GoPay', 'OVO', 'DANA', 'Cash'] : ['Cash', 'E-wallet', 'Card']);
export const THRESHOLDS = [10, 15, 25];

/** Quick amounts on the Goal screen's "Add money". */
export const addAmounts = (c: Currency | undefined) => (c === 'IDR' ? [10000, 25000, 50000] : [5, 10, 20]);

/** Categories for parked items: things people wait on, not everyday spending. */
export const PARK_CATS: { id: string; en: string; id_: string; buyCat?: CatId }[] = [
  { id: 'clothing', en: 'Clothing', id_: 'Pakaian', buyCat: 'clothing' },
  { id: 'gadgets', en: 'Gadgets', id_: 'Gadget' },
  { id: 'beauty', en: 'Beauty', id_: 'Kecantikan' },
  { id: 'food', en: 'Food delivery', id_: 'Pesan antar', buyCat: 'meals' },
  { id: 'games', en: 'Games', id_: 'Game', buyCat: 'games' },
  { id: 'hobby', en: 'Hobby', id_: 'Hobi' },
];
/** A parked item's category in the current language; a typed name stays as typed. */
export const parkCatLabel = (cat: string | undefined) => {
  const c = PARK_CATS.find(x => x.id === cat);
  return c ? tr(c.en, c.id_) : cat ?? '';
};

export const WAITS = {
  '1h': { en: '1 hour', id: '1 jam', minutes: 60 },
  '24h': { en: '24 hours', id: '24 jam', minutes: 1440 },
  '3d': { en: '3 days', id: '3 hari', minutes: 4320 },
} as const;
export type WaitKey = keyof typeof WAITS;
export const waitLabel = (k: WaitKey) => tr(WAITS[k].en, WAITS[k].id);

/** Days after a purchase before its look-back check-in is offered. */
export const LOOKBACK_DAYS = 14;
/** Days of history needed before pattern cards appear. */
export const LEARNING_DAYS = 14;

/**
 * A purchase's name for display. Purchases logged without a name are saved under their category
 * ("Snacks"), so those follow the language; names the user typed stay as typed.
 */
export const purchaseName = (p: { name: string; cat: CatId }) => {
  const c = catById(p.cat);
  return [c.name, c.short, c.nameId, c.shortId].includes(p.name) ? catShort(p.cat) : p.name;
};
