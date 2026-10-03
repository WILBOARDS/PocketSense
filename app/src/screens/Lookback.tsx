import { useState, type ReactNode } from 'react';
import { X } from '../components/icons';
import { catName, cls as clsStyle, moodLabel, purchaseName } from '../lib/constants';
import { daysBetween, shortDate } from '../lib/dates';
import { classifier, pendingLookbacks } from '../lib/derive';
import { money } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { Feeling, Purchase, Usage } from '../lib/types';
import { useUi } from '../ui';

const feelings = (): Record<Feeling, string> => ({ worth: tr('Worth it', 'Sepadan'), meh: tr('Meh', 'Biasa saja'), regret: tr('Regret it', 'Menyesal') });
const usages = (): Record<Usage, string> => ({ lots: tr('Yes, a lot', 'Ya, sering'), few: tr('A few times', 'Beberapa kali'), none: tr('Not yet', 'Belum') });

export function Lookback() {
  const { data, actions } = useData();
  const { now, go } = useUi();
  // Pin the purchase being reviewed so answering doesn't swap in the next one mid-flow.
  const [target] = useState<Purchase | undefined>(() => pendingLookbacks(data, now)[0]);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const close = <button className="icon-btn" aria-label={tr('Close', 'Tutup')} onClick={() => go('home')}><X /></button>;
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
      <div className="big-title">{tr('No check-ins right now.', 'Belum ada tinjauan sekarang.')}</div>
      <div className="t15 pretty muted" style={{ lineHeight: 1.5 }}>
        {tr("Two weeks after a bigger purchase, we'll ask whether it was worth it.", 'Dua minggu setelah pembelian yang lebih besar, kami akan tanya apakah itu sepadan.')}
      </div>
      <div className="grow" />
      <button className="btn btn-primary btn-lg" onClick={() => go('home')}>{tr('Back to home', 'Kembali ke beranda')}</button>
    </>, tr('Check-in', 'Tinjauan'));
  }

  const cat = catName(target.cat);
  const days = daysBetween(target.at, now);
  const label = tr(`Check-in · ${days} days later`, `Tinjauan · ${days} hari kemudian`);
  const thing = purchaseName(target).toLowerCase();

  const answer = (usage: Usage) => {
    const regretted = feeling === 'regret' || usage === 'none';
    const cls = classifier(data)(target).cls;
    const mood = target.mood;
    setResult(regretted
      ? tr(`${cat} bought ${mood ? `when you tagged ${mood}` : 'like this'} will lean Want from now on. You can always change a label.`,
        `${cat} yang dibeli ${mood ? `saat kamu menandai ${moodLabel(mood)}` : 'seperti ini'} akan condong ke Ingin mulai sekarang. Kamu selalu bisa mengubah labelnya.`)
      : tr(`${cat} like this stays ${clsStyle(cls).label}. Good buys count too.`, `${cat} seperti ini tetap ${clsStyle(cls).label}. Pembelian yang baik juga dihitung.`));
    actions.answerLookback(target, feeling!, usage);
  };

  if (result) {
    return wrap(<>
      <div className="big-title">{tr('Thanks. Noted.', 'Terima kasih. Dicatat.')}</div>
      <div className="t16 pretty" style={{ lineHeight: 1.5 }}>{result}</div>
      <div className="grow" />
      <button className="btn btn-primary btn-lg" onClick={() => go('home')}>{tr('Back to home', 'Kembali ke beranda')}</button>
    </>, label);
  }

  if (feeling) {
    return wrap(<>
      <div className="big-title">{target.cat === 'clothing' ? tr('Have you worn it?', 'Sudah kamu pakai?') : tr('Have you used it?', 'Sudah kamu gunakan?')}</div>
      <div className="t14 muted">{tr('You said', 'Jawabanmu')}: {feelings()[feeling]}</div>
      <div className="grow" />
      <BigChoices options={usages()} onPick={answer} />
    </>, label);
  }

  return wrap(<>
    <div className="big-title">{tr(`How do you feel about the ${thing} now?`, `Bagaimana perasaanmu soal ${thing} sekarang?`)}</div>
    <div className="t14 muted">{money(target.amt)} · {cat} · {tr('bought', 'dibeli')} {shortDate(target.at)}</div>
    <div className="grow" />
    <BigChoices options={feelings()} onPick={setFeeling} />
    <button className="btn btn-ghost btn-link" onClick={() => go('home')}>{tr('Ask me later', 'Tanya nanti')}</button>
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
