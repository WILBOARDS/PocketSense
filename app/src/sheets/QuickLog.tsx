import { useState } from 'react';
import { ClsBadge } from '../components/common';
import { X } from '../components/icons';
import { CATS, CLS, INCOME_SRC, MOODS } from '../lib/constants';
import { classifier, repeatCandidates, weekStats } from '../lib/derive';
import { money } from '../lib/format';
import { useData, walletsOf } from '../lib/store';
import type { CatId } from '../lib/types';
import { useUi, type LogPrefill } from '../ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

export function QuickLog({ prefill, onClose }: { prefill?: LogPrefill; onClose: () => void }) {
  const { data, actions } = useData();
  const { now, openWhy } = useUi();
  const [mode, setMode] = useState<'purchase' | 'income'>('purchase');
  const [amt, setAmt] = useState(prefill?.amt ? String(prefill.amt) : '');
  const [hint, setHint] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedIncome, setSavedIncome] = useState<{ src: string; amt: number } | null>(null);

  const week = weekStats(data, now);
  const amtNum = parseFloat(amt) || 0;
  const pctOfWeek = (n: number) => `About ${Math.max(1, Math.round((n / Math.max(1, week.weekMoney)) * 100))}% of your week`;

  const press = (k: string) => {
    let a = amt;
    if (k === 'del') a = a.slice(0, -1);
    else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
    else if (/\.\d\d$/.test(a) || a.replace('.', '').length >= 7) return;
    else a = (a === '0' ? '' : a) + k;
    setAmt(a);
    setHint('');
  };

  const saveCat = (cat: CatId, name: string) => {
    if (!amtNum) return setHint('Type an amount first, then tap a category.');
    setSavedId(actions.addPurchase({ name: prefill?.name ?? name, cat, amt: amtNum }));
  };

  const saved = savedId ? data.purchases.find(p => p.id === savedId) : undefined;
  // All sources, with the ones picked during setup first.
  const picked = data.settings.incomeSources;
  const incomeSrc = [...INCOME_SRC.filter(s => picked.includes(s)), ...INCOME_SRC.filter(s => !picked.includes(s))];

  return (
    <div className="overlay" style={{ zIndex: 20 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Quick log">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 20px' }}>
          {!saved && !savedIncome ? (
            <div role="radiogroup" aria-label="Type" className="seg-grid ink" style={{ display: 'flex' }}>
              <button role="radio" aria-checked={mode === 'purchase'} onClick={() => { setMode('purchase'); setHint(''); }}>Purchase</button>
              <button role="radio" aria-checked={mode === 'income'} onClick={() => { setMode('income'); setHint(''); }}>Income</button>
            </div>
          ) : <div className="t13 w6 accent-text">{saved ? 'Saved' : 'Added'}</div>}
          <div className="grow" />
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X /></button>
        </div>

        {!saved && !savedIncome && <>
          <div style={{ padding: '4px 20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prefill?.name && <div className="t13 w6">{prefill.name}</div>}
            <div aria-live="polite" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: amt ? 'var(--color-text)' : 'var(--color-neutral-500)' }}>
              ${amt || '0'}
            </div>
            <div className="t13 muted" style={{ minHeight: 18 }} role={hint ? 'alert' : undefined}>
              {hint || (amtNum ? pctOfWeek(amtNum) : mode === 'purchase' ? 'Type an amount, then tap a category' : 'Type an amount, then tap where it came from')}
            </div>
          </div>

          {mode === 'purchase' ? <>
            {!prefill && <RepeatChips onPick={(name, cat, a) => { setAmt(String(a)); setSavedId(actions.addPurchase({ name, cat, amt: a })); }} />}
            <div className="cat-grid">
              {CATS.map(c => (
                <button key={c.id} className="cat-cell" onClick={() => saveCat(c.id, c.short ?? c.name)}>
                  <span className="t13 w6">{c.short ?? c.name}</span>
                  <span className="t11 muted">{CLS[c.cls].label}</span>
                </button>
              ))}
            </div>
          </> : (
            <div className="cat-grid three">
              {incomeSrc.map(src => (
                <button key={src} className="cat-cell t14 w6" style={{ minHeight: 56, padding: '8px 12px' }} onClick={() => {
                  if (!amtNum) return setHint('Type an amount first, then tap a source.');
                  actions.addIncome(src, amtNum);
                  setSavedIncome({ src, amt: amtNum });
                }}>{src}</button>
              ))}
            </div>
          )}

          <div className="keypad">
            {KEYS.map(k => (
              <button key={k} className="key" onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>{k === 'del' ? '⌫' : k}</button>
            ))}
          </div>
        </>}

        {saved && <SavedPurchase id={saved.id} weightLine={pctOfWeek(saved.amt)} onWhy={() => openWhy(saved.id)} onDone={onClose} />}

        {savedIncome && (
          <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{money(savedIncome.amt)} from {savedIncome.src}</div>
            <div className="t15">You now have {money(week.left)} left this week.</div>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RepeatChips({ onPick }: { onPick: (name: string, cat: CatId, amt: number) => void }) {
  const { data } = useData();
  const { now } = useUi();
  const chips = repeatCandidates(data, now);
  if (!chips.length) return null;
  return (
    <div className="hscroll" style={{ padding: '0 20px 12px' }}>
      {chips.map(r => (
        <button key={`${r.name}|${r.amt}`} className="repeat-chip" onClick={() => onPick(r.name, r.cat, r.amt)}>
          Repeat · {r.name} {money(r.amt)}
        </button>
      ))}
    </div>
  );
}

function SavedPurchase({ id, weightLine, onWhy, onDone }: { id: string; weightLine: string; onWhy: () => void; onDone: () => void }) {
  const { data, actions } = useData();
  const p = data.purchases.find(x => x.id === id)!;
  const cls = classifier(data)(p).cls;
  const wallets = walletsOf(data);
  return (
    <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 24, fontWeight: 800, overflowWrap: 'anywhere' }}>{p.name}</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{money(p.amt)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ClsBadge cls={cls} onClick={onWhy} big />
        <span className="t13 muted">{weightLine}</span>
      </div>
      <div className="rule" />
      <div className="t15 w6">How were you feeling? <span className="muted" style={{ fontWeight: 400 }}>Optional</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {MOODS.map(m => (
          <button key={m} className="choice" aria-pressed={p.mood === m} onClick={() => actions.setMood(p.id, p.mood === m ? null : m)}>{m}</button>
        ))}
      </div>
      <div className="t15 w6">Paid with</div>
      <div role="radiogroup" aria-label="Wallet" className="seg-grid">
        {wallets.map(w => (
          <button key={w} role="radio" aria-checked={p.wallet === w} onClick={() => actions.setWallet(p.id, w)} style={{ minHeight: 44, fontSize: 14 }}>{w}</button>
        ))}
      </div>
      <button className="btn btn-primary btn-lg" onClick={onDone}>Done</button>
    </div>
  );
}
