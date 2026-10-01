import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_WALLETS } from './constants';
import { newId } from './format';
import { load, save } from './storage';
import type { CatId, Cls, Data, Feeling, Goal, Parked, Purchase, Settings, Usage } from './types';

export function emptyData(settings: Settings, goal: Goal | null): Data {
  return {
    version: 1, settings, goal,
    purchases: [], incomes: [], contribs: [], parking: [], lookbacks: [], lessons: [],
    rules: {}, lastWallet: null, commitWeek: null,
  };
}

export const walletsOf = (d: Data) => (d.settings.wallets.length ? d.settings.wallets : DEFAULT_WALLETS);

function makeActions(update: (fn: (d: Data) => Data) => void) {
  const patchPurchase = (id: string, patch: Partial<Purchase>) =>
    update(d => ({ ...d, purchases: d.purchases.map(p => (p.id === id ? { ...p, ...patch } : p)) }));
  const patchParked = (id: string, patch: Partial<Parked>) =>
    update(d => ({ ...d, parking: d.parking.map(k => (k.id === id ? { ...k, ...patch } : k)) }));

  return {
    setGoal: (goal: Goal) => update(d => ({ ...d, goal })),
    addPurchase: (p: { name: string; cat: CatId; amt: number }) => {
      const id = newId('p');
      update(d => {
        const wallets = walletsOf(d);
        const wallet = d.lastWallet && wallets.includes(d.lastWallet) ? d.lastWallet : wallets[0];
        return { ...d, purchases: [{ id, ...p, wallet, mood: null, at: Date.now() }, ...d.purchases] };
      });
      return id;
    },
    setMood: (id: string, mood: string | null) => patchPurchase(id, { mood }),
    setOverride: (id: string, override: Cls | null) => patchPurchase(id, { override }),
    setWallet: (id: string, wallet: string) => {
      patchPurchase(id, { wallet });
      update(d => ({ ...d, lastWallet: wallet }));
    },
    addIncome: (src: string, amt: number) =>
      update(d => ({ ...d, incomes: [{ id: newId('i'), src, amt, at: Date.now() }, ...d.incomes] })),
    addContrib: (label: string, amt: number) =>
      update(d => ({ ...d, contribs: [...d.contribs, { id: newId('c'), label, amt, at: Date.now() }] })),
    park: (name: string, price: number, minutes: number) => {
      const now = Date.now();
      update(d => ({
        ...d,
        parking: [{ id: newId('k'), name, price, createdAt: now, endsAt: now + minutes * 60000, outcome: 'pending' }, ...d.parking],
      }));
    },
    decideParked: (id: string, outcome: 'skipped' | 'bought') => patchParked(id, { outcome, decidedAt: Date.now() }),
    extendParked: (id: string, minutes: number) => patchParked(id, { endsAt: Date.now() + minutes * 60000 }),
    answerLookback: (p: Purchase, feeling: Feeling, usage: Usage) =>
      update(d => {
        const regretted = feeling === 'regret' || usage === 'none';
        const exists = d.lessons.some(l => l.cat === p.cat && l.mood === p.mood);
        return {
          ...d,
          lookbacks: [...d.lookbacks, { purchaseId: p.id, feeling, usage, at: Date.now() }],
          lessons: regretted && !exists ? [...d.lessons, { cat: p.cat, mood: p.mood }] : d.lessons,
        };
      }),
    toggleRule: (cat: CatId, cls: Cls) =>
      update(d => {
        const rules = { ...d.rules };
        if (rules[cat] === cls) delete rules[cat];
        else rules[cat] = cls;
        return { ...d, rules };
      }),
    setCommitWeek: (week: string | null) => update(d => ({ ...d, commitWeek: week })),
  };
}

export type Actions = ReturnType<typeof makeActions>;

type StoreState = {
  status: 'ready' | 'new' | 'error';
  data: Data | null;
  /** Counts changes made on this phone (not ones that came from the account). Sync watches it. */
  edits: number;
};

interface StoreValue extends StoreState {
  actions: Actions;
  start: (settings: Settings, goal: Goal | null) => void;
  retry: () => void;
  /** Puts data from the account in place of what's here. Doesn't count as an edit. */
  replace: (data: Data) => void;
  /** Clears this phone after signing out or deleting the account. Keeps only the weekly setup. */
  wipe: () => void;
  /** The latest data right now, even before React re-renders. */
  getData: () => Data | null;
  getEdits: () => number;
  saveFailed: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function fromStorage(): StoreState {
  const r = load();
  return r.ok ? { status: r.data ? 'ready' : 'new', data: r.data, edits: 0 } : { status: 'error', data: null, edits: 0 };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(fromStorage);
  // The ref is the source of truth so sync can read and write without waiting for a render.
  const ref = useRef(state);
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Never write while in the error state: that would overwrite data we couldn't read.
    if (state.status === 'ready' && state.data) setSaveFailed(!save(state.data));
  }, [state]);

  const commit = useCallback((next: StoreState) => {
    ref.current = next;
    setState(next);
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    const s = ref.current;
    if (s.data) commit({ ...s, data: fn(s.data), edits: s.edits + 1 });
  }, [commit]);
  const actions = useMemo(() => makeActions(update), [update]);

  const value = useMemo<StoreValue>(() => ({
    ...state,
    actions,
    saveFailed,
    start: (settings, goal) => commit({ status: 'ready', data: emptyData(settings, goal), edits: ref.current.edits + 1 }),
    retry: () => commit({ ...fromStorage(), edits: ref.current.edits }),
    replace: data => commit({ status: 'ready', data, edits: ref.current.edits }),
    wipe: () => {
      const s = ref.current;
      if (s.data) commit({ status: 'ready', data: emptyData(s.data.settings, null), edits: s.edits });
    },
    getData: () => ref.current.data,
    getEdits: () => ref.current.edits,
  }), [state, actions, saveFailed, commit]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

/** For screens that only render once data exists. */
export function useData() {
  const { data, actions } = useStore();
  if (!data) throw new Error('useData called before data was loaded');
  return { data, actions };
}
