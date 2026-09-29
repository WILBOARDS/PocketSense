import { createContext, useContext } from 'react';

export type Screen = 'home' | 'transactions' | 'insights' | 'goals' | 'thinking' | 'parking' | 'lookback' | 'goal-setup';

export interface LogPrefill {
  amt?: number;
  /** Name to save the purchase under instead of the category name. */
  name?: string;
}

export interface Ui {
  now: number;
  screen: Screen;
  go: (s: Screen) => void;
  openLog: (prefill?: LogPrefill) => void;
  openWhy: (purchaseId: string) => void;
  toast: (msg: string) => void;
  photo: string | null;
  setPhoto: (file: File) => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi() {
  const v = useContext(UiContext);
  if (!v) throw new Error('useUi must be used inside UiContext');
  return v;
}
