import { useState, type ReactNode } from 'react';
import { X } from '../components/icons';
import { CLS, catById } from '../lib/constants';
import { daysBetween, shortDate } from '../lib/dates';
import { classifier, pendingLookbacks } from '../lib/derive';
import { money } from '../lib/format';
import { useData } from '../lib/store';
import type { Feeling, Purchase, Usage } from '../lib/types';
import { useUi } from '../ui';

const FEEL: Record<Feeling, string> = { worth: 'Worth it', meh: 'Meh', regret: 'Regret it' };
const USE: Record<Usage, string> = { lots: 'Yes, a lot', few: 'A few times', none: 'Not yet' };

export function Lookback() {
  const { data, actions } = useData();
  const { now, go } = useUi();
  // Pin the purchase being reviewed so answering doesn't swap in the next one mid-flow.
  const [target] = useState<Purchase | undefined>(() => pendingLookbacks(data, now)[0]);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const close = <button className="icon-btn" aria-label="Close" onClick={() => go('home')}><X /></button>;
  const wrap = (children: ReactNode, label: string) => (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="t13 w6 accent-text">{label}</div>
        {close}
      </div>
      <div className="rule" />
      {children}
    </div>
  );

  if (!target) {
    return wrap(<>
      <div className="big-title">No check-ins right now.</div>
      <div className="t15 pretty muted" style={{ lineHeight: 1.5 }}>Two weeks after a bigger purchase, we'll ask whether it was worth it.</div>
      <div className="grow" />
      <button className="btn btn-primary btn-lg" onClick={() => go('home')}>Back to home</button>
    </>, 'Check-in');
  }

  const cat = catById(target.cat);
  const label = `Check-in · ${daysBetween(target.at, now)} days later`;
  const thing = target.name.toLowerCase();

  const answer = (usage: Usage) => {
    const regretted = feeling === 'regret' || usage === 'none';
    const cls = classifier(data)(target).cls;
    setResult(regretted
      ? `${cat.name} bought ${target.mood ? `when you tagged ${target.mood}` : 'like this'} will lean Want from now on. You can always change a label.`
      : `${cat.name} like this stays ${CLS[cls].label}. Good buys count too.`);
    actions.answerLookback(target, feeling!, usage);
  };

  if (result) {
    return wrap(<>
      <div className="big-title">Thanks. Noted.</div>
      <div className="t16 pretty" style={{ lineHeight: 1.5 }}>{result}</div>
      <div className="grow" />
      <button className="btn btn-primary btn-lg" onClick={() => go('home')}>Back to home</button>
    </>, label);
  }

  if (feeling) {
    return wrap(<>
      <div className="big-title">{target.cat === 'clothing' ? 'Have you worn it?' : 'Have you used it?'}</div>
      <div className="t14 muted">You said: {FEEL[feeling]}</div>
      <div className="grow" />
      <BigChoices options={USE} onPick={answer} />
    </>, label);
  }

  return wrap(<>
    <div className="big-title">How do you feel about the {thing} now?</div>
    <div className="t14 muted">{money(target.amt)} · {cat.name} · bought {shortDate(target.at)}</div>
    <div className="grow" />
    <BigChoices options={FEEL} onPick={setFeeling} />
    <button className="btn btn-ghost btn-link" onClick={() => go('home')}>Ask me later</button>
  </>, label);
}

function BigChoices<K extends string>({ options, onPick }: { options: Record<K, string>; onPick: (k: K) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {(Object.keys(options) as K[]).map(k => (
        <button key={k} className="btn btn-secondary" onClick={() => onPick(k)}
          style={{ minHeight: 64, padding: '0 20px', fontSize: 18, fontWeight: 600, borderWidth: 2 }}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}
