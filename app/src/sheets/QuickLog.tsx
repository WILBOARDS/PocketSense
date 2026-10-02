import { useEffect, useRef, useState } from 'react';
import { ClsBadge, Dropdown } from '../components/common';
import { X } from '../components/icons';
import { CATS, INCOME_SRC, MOODS, catShort, moodLabel, purchaseName, wordLabel } from '../lib/constants';
import { classifier, repeatCandidates, weekStats } from '../lib/derive';
import { currencySymbol, isRupiah, money } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData, walletsOf } from '../lib/store';
import type { CatId } from '../lib/types';
import { useUi, type LogPrefill } from '../ui';

/** Rupiah has no cents, so the key left of 0 adds three zeros instead of a decimal point. */
const keys = () => ['1', '2', '3', '4', '5', '6', '7', '8', '9', isRupiah() ? '000' : '.', '0', 'del'];

/** The typed amount as shown: "25.000" in Rupiah, "12.5" in dollars. */
const shown = (a: string) => (isRupiah() && a ? Number(a).toLocaleString('id-ID') : a);

export function QuickLog({ prefill, onClose }: { prefill?: LogPrefill; onClose: () => void }) {
  const { data, actions } = useData();
  const { now, openWhy } = useUi();
  const [mode, setMode] = useState<'purchase' | 'income'>('purchase');
  const [amt, setAmt] = useState(prefill?.amt ? String(isRupiah() ? Math.round(prefill.amt) : prefill.amt) : '');
  const [cat, setCat] = useState<CatId | null>(prefill?.cat ?? null);
  const [custom, setCustom] = useState('');
  const [hint, setHint] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedIncome, setSavedIncome] = useState<{ src: string; amt: number } | null>(null);

  const week = weekStats(data, now);
  const amtNum = parseFloat(amt) || 0;
  const pctOfWeek = (n: number) => {
    const pct = Math.max(1, Math.round((n / Math.max(1, week.weekMoney)) * 100));
    return tr(`About ${pct}% of your week`, `Sekitar ${pct}% dari jatah minggumu`);
  };

  const press = (k: string) => {
    let a = amt;
    if (k === 'del') a = a.slice(0, -1);
    else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
    else if (k === '000') { if (!a || a.length > 9) return; a += '000'; }
    else if (/\.\d\d$/.test(a) || a.replace('.', '').length >= (isRupiah() ? 12 : 7)) return;
    else a = (a === '0' ? '' : a) + k;
    setAmt(a);
    setHint('');
  };

  // A physical keyboard types into the amount too (on a PC, or a phone with one).
  const pressRef = useRef(press);
  pressRef.current = press;
  const typing = !savedId && !savedIncome;
  useEffect(() => {
    if (!typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('del');
      else if ((e.key === '.' || e.key === ',') && !isRupiah()) pressRef.current('.');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typing]);

  const save = () => {
    if (!amtNum) return setHint(tr('Type an amount first.', 'Ketik jumlahnya dulu.'));
    if (!cat) return setHint(tr('Pick a category first.', 'Pilih kategori dulu.'));
    if (cat === 'other' && !custom.trim()) return setHint(tr('Name your category first.', 'Tulis nama kategorinya dulu.'));
    const name = prefill?.name ?? (cat === 'other' ? custom.trim() : catShort(cat));
    setSavedId(actions.addPurchase({ name, cat, amt: amtNum }));
  };

  const saved = savedId ? data.purchases.find(p => p.id === savedId) : undefined;
  // All sources, with the ones picked during setup first.
  const picked = data.settings.incomeSources;
  const incomeSrc = [...INCOME_SRC.filter(s => picked.includes(s)), ...INCOME_SRC.filter(s => !picked.includes(s))];

  return (
    <div className="overlay" style={{ zIndex: 20 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={tr('Log a purchase', 'Catat pembelian')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 20px' }}>
          {!saved && !savedIncome ? (
            <div role="radiogroup" aria-label={tr('Type', 'Jenis')} className="seg-grid ink" style={{ display: 'flex' }}>
              <button role="radio" aria-checked={mode === 'purchase'} onClick={() => { setMode('purchase'); setHint(''); }}>{tr('Purchase', 'Pembelian')}</button>
              <button role="radio" aria-checked={mode === 'income'} onClick={() => { setMode('income'); setHint(''); }}>{tr('Income', 'Pemasukan')}</button>
            </div>
          ) : <div className="t13 w6 accent-text">{saved ? tr('Saved', 'Tersimpan') : tr('Added', 'Ditambahkan')}</div>}
          <div className="grow" />
          <button className="icon-btn" aria-label={tr('Close', 'Tutup')} onClick={onClose}><X /></button>
        </div>

        {!saved && !savedIncome && <>
          <div style={{ padding: '4px 20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prefill?.name && <div className="t13 w6">{prefill.name}</div>}
            <div aria-live="polite" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', overflowWrap: 'anywhere', color: amt ? 'var(--color-text)' : 'var(--color-neutral-500)' }}>
              {currencySymbol()}{isRupiah() ? ' ' : ''}{shown(amt) || '0'}
            </div>
            <div className="t13 muted" style={{ minHeight: 18 }} role={hint ? 'alert' : undefined}>
              {hint || (amtNum ? pctOfWeek(amtNum) : mode === 'purchase'
                ? tr('Type an amount, pick a category, then save', 'Ketik jumlah, pilih kategori, lalu simpan')
                : tr('Type an amount, then tap where it came from', 'Ketik jumlah, lalu pilih asalnya'))}
            </div>
          </div>

          {mode === 'purchase' ? <>
            {!prefill && <RepeatChips onPick={(name, c, a) => { setAmt(String(a)); setSavedId(actions.addPurchase({ name, cat: c, amt: a })); }} />}
            <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="t13 muted">{tr('Category', 'Kategori')}</div>
              <Dropdown label={tr('Category', 'Kategori')} placeholder={tr('Pick a category', 'Pilih kategori')}
                options={CATS.map(c => ({ value: c.id, label: catShort(c.id) }))}
                value={cat} onPick={c => { setCat(c); setHint(''); }}
                customLabel={tr('Custom…', 'Kustom…')} customValue={'other' as CatId} custom={custom} onCustom={setCustom} />
              <button className="btn btn-primary btn-lg" onClick={save}>{tr('Save', 'Simpan')}</button>
            </div>
          </> : (
            <div className="cat-grid three">
              {incomeSrc.map(src => (
                <button key={src} className="cat-cell t14 w6" style={{ minHeight: 56, padding: '8px 12px' }} onClick={() => {
                  if (!amtNum) return setHint(tr('Type an amount first, then tap a source.', 'Ketik jumlah dulu, lalu pilih asalnya.'));
                  actions.addIncome(src, amtNum);
                  setSavedIncome({ src, amt: amtNum });
                }}>{wordLabel(src)}</button>
              ))}
            </div>
          )}

          <div className="keypad">
            {keys().map(k => (
              <button key={k} className="key" onClick={() => press(k)} aria-label={k === 'del' ? tr('Delete', 'Hapus') : k}>{k === 'del' ? '⌫' : k}</button>
            ))}
          </div>
        </>}

        {saved && <SavedPurchase id={saved.id} weightLine={pctOfWeek(saved.amt)} onWhy={() => openWhy(saved.id)} onDone={onClose} />}

        {savedIncome && (
          <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {tr(`${money(savedIncome.amt)} from ${savedIncome.src}`, `${money(savedIncome.amt)} dari ${wordLabel(savedIncome.src)}`)}
            </div>
            <div className="t15">{tr(`You now have ${money(week.left)} left this week.`, `Sisa uangmu minggu ini sekarang ${money(week.left)}.`)}</div>
            <button className="btn btn-primary btn-lg" onClick={onClose}>{tr('Done', 'Selesai')}</button>
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
          {tr('Repeat', 'Ulangi')} · {purchaseName(r)} {money(r.amt)}
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
        <div style={{ fontSize: 24, fontWeight: 800, overflowWrap: 'anywhere' }}>{purchaseName(p)}</div>
        <div style={{ fontSize: 24, fontWeight: 800, whiteSpace: 'nowrap' }}>{money(p.amt)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ClsBadge cls={cls} onClick={onWhy} big />
        <span className="t13 muted">{weightLine}</span>
      </div>
      <div className="rule" />
      <div className="t15 w6">{tr('How were you feeling?', 'Lagi merasa apa?')} <span className="muted" style={{ fontWeight: 400 }}>{tr('Optional', 'Opsional')}</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {MOODS.map(m => (
          <button key={m} className="choice" aria-pressed={p.mood === m} onClick={() => actions.setMood(p.id, p.mood === m ? null : m)}>{moodLabel(m)}</button>
        ))}
      </div>
      <div className="t15 w6">{tr('Paid with', 'Bayar pakai')}</div>
      {/* Up to 4 wallets fit in one row; more wrap as chips. */}
      <div role="radiogroup" aria-label={tr('Paid with', 'Bayar pakai')} className={wallets.length > 4 ? 'wrap-row' : 'seg-grid'}>
        {wallets.map(w => (
          <button key={w} role="radio" aria-checked={p.wallet === w} className={wallets.length > 4 ? 'choice' : undefined}
            onClick={() => actions.setWallet(p.id, w)} style={{ minHeight: 44, fontSize: 14 }}>{wordLabel(w)}</button>
        ))}
      </div>
      <button className="btn btn-primary btn-lg" onClick={onDone}>{tr('Done', 'Selesai')}</button>
    </div>
  );
}
