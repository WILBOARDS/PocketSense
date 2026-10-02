import { useState, type ReactNode } from 'react';
import { INCOME_SRC, THRESHOLDS, WALLET_CHOICES, wordLabel } from '../lib/constants';
import { amountText, currencySymbol, money0, parseAmount, typeAmount } from '../lib/format';
import { tr } from '../lib/i18n';
import type { Currency, Goal, Settings } from '../lib/types';
import { useUi } from '../ui';

/** First-run setup: 4 steps. */
export function Onboarding({ onDone, onSignIn, currency, onCurrency }: {
  onDone: (settings: Settings, goal: Goal | null) => void;
  onSignIn?: () => void;
  currency: Currency;
  onCurrency: (c: Currency) => void;
}) {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<string[]>([]);
  const [weekStr, setWeekStr] = useState('');
  const [wallets, setWallets] = useState<string[]>([]);
  const [goalName, setGoalName] = useState('');
  const [goalPrice, setGoalPrice] = useState('');
  const [threshold, setThreshold] = useState(15);

  const weekMoney = parseAmount(weekStr);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const goalOk = goalName.trim() && parseAmount(goalPrice) > 0;
  const canNext = step !== 0 || weekMoney > 0;

  const next = () => {
    if (step < 3) return setStep(step + 1);
    onDone(
      { weekMoney, incomeSources: income, wallets, threshold, currency },
      goalOk ? { name: goalName.trim(), target: parseAmount(goalPrice) } : null,
    );
  };

  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <div className="t18 w8">Pocket Sense</div>
        <div className="grow" />
        <div className="t13 muted">{tr(`Step ${step + 1} of 4`, `Langkah ${step + 1} dari 4`)}</div>
        <LangSwitch small />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 4 }} aria-hidden="true">
        {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 4, background: i <= step ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} />)}
      </div>

      {step === 0 && <>
        <StepTitle>{tr('Where does your money come from?', 'Uangmu dari mana?')}</StepTitle>
        <div className="t14 muted">{tr('Pick all that apply.', 'Pilih semua yang sesuai.')}</div>
        <Chips options={INCOME_SRC} selected={income} onToggle={v => toggle(income, setIncome, v)} />
        <div className="t13" style={{ marginTop: 8 }}>{tr('Currency', 'Mata uang')}</div>
        <div role="radiogroup" aria-label={tr('Currency', 'Mata uang')} className="seg-grid" style={{ marginTop: -8 }}>
          {(['IDR', 'USD'] as Currency[]).map(c => (
            <button key={c} role="radio" aria-checked={currency === c}
              onClick={() => { if (c !== currency) { onCurrency(c); setWeekStr(''); setGoalPrice(''); } }}>
              {c === 'IDR' ? 'Rupiah (Rp)' : tr('Dollar ($)', 'Dolar ($)')}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="ob-week">{tr('About how much do you have to spend each week?', 'Kira-kira berapa uang yang bisa kamu pakai tiap minggu?')} ({currencySymbol()})</label>
          <input id="ob-week" className="input input-lg" inputMode="decimal" placeholder={currency === 'IDR' ? '350.000' : '120'} value={weekStr}
            onChange={e => setWeekStr(typeAmount(e.target.value))} autoComplete="off" />
        </div>
      </>}

      {step === 1 && <>
        <StepTitle>{tr('Where do you keep it?', 'Uangmu disimpan di mana?')}</StepTitle>
        <div className="t14 muted">{tr('The last one you use becomes the default.', 'Yang terakhir kamu pakai jadi pilihan awal.')}</div>
        <Chips options={WALLET_CHOICES} selected={wallets} onToggle={v => toggle(wallets, setWallets, v)} />
      </>}

      {step === 2 && <GoalFields name={goalName} price={goalPrice} onName={setGoalName} onPrice={setGoalPrice} />}

      {step === 3 && <>
        <StepTitle>{tr('When should we suggest a pause?', 'Kapan kami sarankan untuk jeda?')}</StepTitle>
        <div className="t14 muted">{tr('Share of your weekly money.', 'Porsi dari uang mingguanmu.')}</div>
        <div role="radiogroup" aria-label={tr('Cooldown line', 'Batas jeda')} className="seg-grid">
          {THRESHOLDS.map(t => (
            <button key={t} role="radio" aria-checked={threshold === t} onClick={() => setThreshold(t)} style={{ minHeight: 52, fontSize: 16 }}>{t}%</button>
          ))}
        </div>
        <div className="t15" style={{ lineHeight: 1.5 }}>
          {tr(`Anything over ${money0((weekMoney * threshold) / 100)} of a ${money0(weekMoney)} week gets a cooldown suggestion.`,
            `Apa pun di atas ${money0((weekMoney * threshold) / 100)} dari jatah ${money0(weekMoney)} seminggu akan disarankan untuk jeda dulu.`)}
        </div>
      </>}

      <div className="grow" />
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && <button className="btn btn-secondary" style={{ minHeight: 52, padding: '0 20px', fontSize: 16 }} onClick={() => setStep(step - 1)}>{tr('Back', 'Kembali')}</button>}
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={next} disabled={!canNext}>
          {step === 2 && !goalOk ? tr('Skip for now', 'Lewati dulu') : step === 3 ? tr('Start logging', 'Mulai mencatat') : tr('Continue', 'Lanjut')}
        </button>
      </div>
      {step === 0 && onSignIn && (
        <button className="btn btn-ghost btn-link" style={{ marginTop: -8 }} onClick={onSignIn}>{tr('I already have an account', 'Aku sudah punya akun')}</button>
      )}
    </div>
  );
}

/** Set or edit the goal on its own, from the Goal tab or Home. */
export function GoalSetup({ initial, onSave, onCancel }: { initial: Goal | null; onSave: (g: Goal) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(amountText(initial?.target ?? 0));
  const ok = name.trim() && parseAmount(price) > 0;
  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
        <div className="t18 w8">{initial ? tr('Edit goal', 'Ubah target') : tr('New goal', 'Target baru')}</div>
      </div>
      <GoalFields name={name} price={price} onName={setName} onPrice={setPrice} />
      <div className="grow" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ minHeight: 52, padding: '0 20px', fontSize: 16 }} onClick={onCancel}>{tr('Cancel', 'Batal')}</button>
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={!ok}
          onClick={() => onSave({ name: name.trim(), target: parseAmount(price) })}>{tr('Save goal', 'Simpan target')}</button>
      </div>
    </div>
  );
}

function GoalFields({ name, price, onName, onPrice }: { name: string; price: string; onName: (v: string) => void; onPrice: (v: string) => void }) {
  return <>
    <StepTitle>{tr('Saving for something?', 'Lagi menabung untuk sesuatu?')}</StepTitle>
    <div className="t14 muted">{tr('Optional. One thing, with a price.', 'Opsional. Satu barang, dengan harganya.')}</div>
    <div className="field">
      <label htmlFor="ob-gname">{tr('What is it?', 'Barang apa?')}</label>
      <input id="ob-gname" className="input input-lg" value={name} onChange={e => onName(e.target.value)} placeholder={tr('Headphones', 'Tiket konser')} autoComplete="off" />
    </div>
    <div className="field">
      <label htmlFor="ob-gprice">{tr('Price', 'Harga')} ({currencySymbol()})</label>
      <input id="ob-gprice" className="input input-lg" inputMode="decimal" value={price} onChange={e => onPrice(typeAmount(e.target.value))} placeholder="0" autoComplete="off" />
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
        <button key={v} className="choice" aria-pressed={selected.includes(v)} onClick={() => onToggle(v)} style={{ minHeight: 48, padding: '0 16px', fontSize: 15 }}>{wordLabel(v)}</button>
      ))}
    </div>
  );
}

/** English / Indonesia switch, in Settings and on the first setup screen. */
export function LangSwitch({ small }: { small?: boolean }) {
  const { lang, setLang } = useUi();
  const h = small ? 36 : 44;
  return (
    <div role="radiogroup" aria-label={tr('Language', 'Bahasa')} className="seg-grid ink" style={{ display: 'flex', flex: 'none' }}>
      <button role="radio" aria-checked={lang === 'en'} onClick={() => setLang('en')} style={{ minHeight: h }}>{small ? 'EN' : 'English'}</button>
      <button role="radio" aria-checked={lang === 'id'} onClick={() => setLang('id')} style={{ minHeight: h }}>{small ? 'ID' : 'Indonesia'}</button>
    </div>
  );
}
