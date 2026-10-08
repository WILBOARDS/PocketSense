import { createContext, useContext } from 'react';
import type { Layout } from './layout';
import type { Lang } from './lib/i18n';
import type { CatId } from './lib/types';

export type Screen = 'home' | 'transactions' | 'insights' | 'ask' | 'ask-about' | 'goals' | 'thinking' | 'parking' | 'lookback' | 'goal-setup'
  | 'settings' | 'privacy'
  // Account screens
  | 'signin' | 'forgot' | 'verify' | 'new-password' | 'consent' | 'upload' | 'restore' | 'delete';

export interface LogPrefill {
  amt?: number;
  /** Name to save the purchase under instead of the category name. */
  name?: string;
  /** Category to start with, e.g. Clothing when buying a parked jacket. */
  cat?: CatId;
}

/** What "Thinking of buying" starts with when something is shared or pasted in. */
export interface ParkPrefill {
  name?: string;
  price?: number;
  url?: string;
  src?: string;
  /** Pasted into the desktop "Park something from a link" box, rather than shared from a shop app. */
  pasted?: boolean;
}

export interface Ui {
  now: number;
  screen: Screen;
  go: (s: Screen) => void;
  openLog: (prefill?: LogPrefill) => void;
  openWhy: (purchaseId: string) => void;
  /** Opens "Thinking of buying", filled in from a shared or pasted link if there is one. */
  think: (prefill?: ParkPrefill) => void;
  toast: (msg: string) => void;
  photo: string | null;
  setPhoto: (file: File) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  layout: Layout;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi() {
  const v = useContext(UiContext);
  if (!v) throw new Error('useUi must be used inside UiContext');
  return v;
}
