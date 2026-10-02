export type Cls = 'need' | 'useful' | 'want' | 'invest';
/** 'other' is a category the user named themselves; the name is saved as the purchase name. */
export type CatId = 'meals' | 'snacks' | 'transport' | 'school' | 'clothing' | 'subs' | 'games' | 'savings' | 'other';
export type Currency = 'IDR' | 'USD';

export interface Purchase {
  id: string;
  name: string;
  cat: CatId;
  amt: number;
  wallet: string;
  mood: string | null;
  /** Epoch ms, local clock. */
  at: number;
  /** Class the user picked by hand in the "Why?" sheet. */
  override?: Cls | null;
}

export interface Income {
  id: string;
  src: string;
  amt: number;
  at: number;
}

export interface Contrib {
  id: string;
  label: string;
  amt: number;
  at: number;
}

export interface Parked {
  id: string;
  name: string;
  price: number;
  createdAt: number;
  endsAt: number;
  outcome: 'pending' | 'skipped' | 'bought';
  decidedAt?: number;
  /** A parking category id (see PARK_CATS) or a name the user typed. */
  cat?: string;
  /** Marked as a promo or flash sale. */
  promo?: boolean;
  /** Where it was shared or pasted from. */
  url?: string;
  /** Shop name from the link, e.g. Tokopedia. */
  src?: string;
}

export type Feeling = 'worth' | 'meh' | 'regret';
export type Usage = 'lots' | 'few' | 'none';

export interface Lookback {
  purchaseId: string;
  feeling: Feeling;
  usage: Usage;
  at: number;
}

/** Learned from a regretted check-in: this category (and mood, if any) leans Want. */
export interface Lesson {
  cat: CatId;
  mood: string | null;
}

export interface Settings {
  weekMoney: number;
  incomeSources: string[];
  wallets: string[];
  /** Share of weekly money (%) above which a cooldown is suggested. */
  threshold: number;
  /** Older data has none: it was all in dollars (see migrate.ts). */
  currency?: Currency;
  lang?: 'en' | 'id';
}

export interface Goal {
  name: string;
  target: number;
}

export interface Data {
  version: 1;
  settings: Settings;
  goal: Goal | null;
  purchases: Purchase[];
  incomes: Income[];
  contribs: Contrib[];
  parking: Parked[];
  lookbacks: Lookback[];
  lessons: Lesson[];
  rules: Partial<Record<CatId, Cls>>;
  lastWallet: string | null;
  /** Week key (Monday's date) the user committed to "This week's one thing". */
  commitWeek: string | null;
}
