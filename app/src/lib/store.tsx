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

interface StoreValue {
  status: 'ready' | 'new' | 'error';
  data: Data | null;
  actions: Actions;
  start: (settings: Settings, goal: Goal | null) => void;
  retry: () => void;
  saveFailed: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const r = load();
    return r.ok ? { status: r.data ? ('ready' as const) : ('new' as const), data: r.data } : { status: 'error' as const, data: null };
  });
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

  const update = useCallback((fn: (d: Data) => Data) => {
    setState(s => (s.data ? { ...s, data: fn(s.data) } : s));
  }, []);
  const actions = useMemo(() => makeActions(update), [update]);

  const value = useMemo<StoreValue>(() => ({
    status: state.status,
    data: state.data,
    actions,
    saveFailed,
    start: (settings, goal) => setState({ status: 'ready', data: emptyData(settings, goal) }),
    retry: () => {
      const r = load();
      setState(r.ok ? { status: r.data ? 'ready' : 'new', data: r.data } : { status: 'error', data: null });
    },
  }), [state, actions, saveFailed]);

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
