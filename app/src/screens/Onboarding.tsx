import { useState, type ReactNode } from 'react';
import { INCOME_SRC, THRESHOLDS, WALLET_CHOICES } from '../lib/constants';
import { cleanAmount, money0 } from '../lib/format';
import type { Goal, Settings } from '../lib/types';

/** First-run setup: 4 steps. */
export function Onboarding({ onDone }: { onDone: (settings: Settings, goal: Goal | null) => void }) {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<string[]>([]);
  const [weekStr, setWeekStr] = useState('');
  const [wallets, setWallets] = useState<string[]>([]);
  const [goalName, setGoalName] = useState('');
  const [goalPrice, setGoalPrice] = useState('');
  const [threshold, setThreshold] = useState(15);

  const weekMoney = parseFloat(weekStr) || 0;
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const goalOk = goalName.trim() && parseFloat(goalPrice) > 0;
  const canNext = step !== 0 || weekMoney > 0;

  const next = () => {
    if (step < 3) return setStep(step + 1);
    onDone(
      { weekMoney, incomeSources: income, wallets, threshold },
      goalOk ? { name: goalName.trim(), target: parseFloat(goalPrice) } : null,
    );
  };

  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <div className="t18 w8">Pocket Sense</div>
        <div className="t13 muted">Step {step + 1} of 4</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 4 }} aria-hidden="true">
        {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 4, background: i <= step ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} />)}
      </div>

      {step === 0 && <>
        <StepTitle>Where does your money come from?</StepTitle>
        <div className="t14 muted">Pick all that apply.</div>
        <Chips options={INCOME_SRC} selected={income} onToggle={v => toggle(income, setIncome, v)} />
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="ob-week">About how much do you have to spend each week?</label>
          <input id="ob-week" className="input input-lg" inputMode="decimal" placeholder="120" value={weekStr}
            onChange={e => setWeekStr(cleanAmount(e.target.value))} autoComplete="off" />
        </div>
      </>}

      {step === 1 && <>
        <StepTitle>Where do you keep it?</StepTitle>
        <div className="t14 muted">The last one you use becomes the default.</div>
        <Chips options={WALLET_CHOICES} selected={wallets} onToggle={v => toggle(wallets, setWallets, v)} />
      </>}

      {step === 2 && <GoalFields name={goalName} price={goalPrice} onName={setGoalName} onPrice={setGoalPrice} />}

      {step === 3 && <>
        <StepTitle>When should we suggest a pause?</StepTitle>
        <div className="t14 muted">Share of your weekly money.</div>
        <div role="radiogroup" aria-label="Cooldown line" className="seg-grid">
          {THRESHOLDS.map(t => (
            <button key={t} role="radio" aria-checked={threshold === t} onClick={() => setThreshold(t)} style={{ minHeight: 52, fontSize: 16 }}>{t}%</button>
          ))}
        </div>
        <div className="t15" style={{ lineHeight: 1.5 }}>
          Anything over {money0((weekMoney * threshold) / 100)} of a {money0(weekMoney)} week gets a cooldown suggestion.
        </div>
      </>}

      <div className="grow" />
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && <button className="btn btn-secondary" style={{ minHeight: 52, padding: '0 20px', fontSize: 16 }} onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={next} disabled={!canNext}>
          {step === 2 && !goalOk ? 'Skip for now' : step === 3 ? 'Start logging' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

/** Set or edit the goal on its own, from the Goal tab or Home. */
export function GoalSetup({ initial, onSave, onCancel }: { initial: Goal | null; onSave: (g: Goal) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.target) : '');
  const ok = name.trim() && parseFloat(price) > 0;
  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
        <div className="t18 w8">{initial ? 'Edit goal' : 'New goal'}</div>
      </div>
      <GoalFields name={name} price={price} onName={setName} onPrice={setPrice} />
      <div className="grow" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ minHeight: 52, padding: '0 20px', fontSize: 16 }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={!ok}
          onClick={() => onSave({ name: name.trim(), target: parseFloat(price) })}>Save goal</button>
      </div>
    </div>
  );
}

function GoalFields({ name, price, onName, onPrice }: { name: string; price: string; onName: (v: string) => void; onPrice: (v: string) => void }) {
  return <>
    <StepTitle>Saving for something?</StepTitle>
    <div className="t14 muted">Optional. One thing, with a price.</div>
    <div className="field">
      <label htmlFor="ob-gname">What is it?</label>
      <input id="ob-gname" className="input input-lg" value={name} onChange={e => onName(e.target.value)} placeholder="Headphones" autoComplete="off" />
    </div>
    <div className="field">
      <label htmlFor="ob-gprice">Price</label>
      <input id="ob-gprice" className="input input-lg" inputMode="decimal" value={price} onChange={e => onPrice(cleanAmount(e.target.value))} placeholder="0.00" autoComplete="off" />
    </div>
  </>;
}

const StepTitle = ({ children }: { children: ReactNode }) => (
  <div className="pretty" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05, paddingTop: 16 }}>{children}</div>
);

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(v => (
        <button key={v} className="choice" aria-pressed={selected.includes(v)} onClick={() => onToggle(v)} style={{ minHeight: 48, padding: '0 16px', fontSize: 15 }}>{v}</button>
      ))}
    </div>
  );
}
