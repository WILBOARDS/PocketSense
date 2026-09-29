import type { CatId, Cls } from './types';

export interface Category {
  id: CatId;
  name: string;
  short?: string;
  cls: Cls;
}

export const CATS: Category[] = [
  { id: 'meals', name: 'Meals', cls: 'need' },
  { id: 'snacks', name: 'Snacks & drinks', short: 'Snacks', cls: 'want' },
  { id: 'transport', name: 'Transport', cls: 'need' },
  { id: 'school', name: 'School & books', short: 'School', cls: 'need' },
  { id: 'clothing', name: 'Clothing', cls: 'useful' },
  { id: 'subs', name: 'Subscriptions', short: 'Subs', cls: 'useful' },
  { id: 'games', name: 'Games & in-app', short: 'Games', cls: 'want' },
  { id: 'savings', name: 'Savings transfer', short: 'Savings', cls: 'invest' },
];

export const catById = (id: CatId): Category => CATS.find(c => c.id === id) ?? CATS[0];
export const catShort = (id: CatId) => {
  const c = catById(id);
  return c.short ?? c.name;
};

export interface ClsStyle {
  label: string;
  bg: string;
  fg: string;
  bd: string;
}

export const CLS: Record<Cls, ClsStyle> = {
  need: { label: 'Need', bg: 'var(--color-text)', fg: 'var(--color-bg)', bd: 'var(--color-text)' },
  useful: { label: 'Useful', bg: 'transparent', fg: 'var(--color-text)', bd: 'var(--color-text)' },
  want: { label: 'Want', bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)', bd: 'var(--color-accent-400)' },
  invest: { label: 'Invest', bg: 'var(--color-accent-700)', fg: '#fff', bd: 'var(--color-accent-700)' },
};

export const CLS_KEYS: Cls[] = ['need', 'useful', 'want', 'invest'];

/** "Meals is usually a Need" / "Clothing is usually Useful". */
export const ART: Record<Cls, string> = { need: 'a Need', useful: 'Useful', want: 'a Want', invest: 'Invest' };

export const MOODS = ['Needed it', 'Bored', 'Stressed', 'Celebrating', 'Hungry', 'Tired', 'Social pressure', 'Treating myself'];
export const WANT_MOODS = ['Bored', 'Stressed', 'Treating myself'];

export const INCOME_SRC = ['Allowance', 'Part-time', 'Gift', 'Freelance', 'Other'];
export const WALLET_CHOICES = ['Cash', 'E-wallet', 'Debit card', "Parent's card"];
export const DEFAULT_WALLETS = ['Cash', 'E-wallet', 'Card'];
export const THRESHOLDS = [10, 15, 25];

export const WAITS = {
  '1h': { label: '1 hour', minutes: 60 },
  '24h': { label: '24 hours', minutes: 1440 },
  '3d': { label: '3 days', minutes: 4320 },
} as const;
export type WaitKey = keyof typeof WAITS;

/** Days after a purchase before its look-back check-in is offered. */
export const LOOKBACK_DAYS = 14;
/** Days of history needed before pattern cards appear. */
export const LEARNING_DAYS = 14;
