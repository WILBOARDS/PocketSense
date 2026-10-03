import { useState } from 'react';
import { CATS, INCOME_SRC, catShort, wordLabel } from '../lib/constants';
import { weekStats } from '../lib/derive';
import { currencySymbol, money, parseAmount, typeAmount } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { CatId } from '../lib/types';
import { RepeatChips, SavedPurchase } from '../sheets/QuickLog';
import { useUi } from '../ui';
import { Dropdown } from './common';

/**
 * Logging on a bigger screen: type the amount, pick a category, save. Mood and wallet come after,
 * the same as the phone's Saved sheet.
 * row: one line above the half-screen History. panel: the desktop side panel.
 */
export function LogPanel({ variant }: { variant: 'row' | 'panel' }) {
  const { data, actions } = useData();
  const { now, openWhy, toast } = useUi();
  const [mode, setMode] = useState<'purchase' | 'income'>('purchase');
  const [amtStr, setAmtStr] = useState('');
  const [cat, setCat] = useState<CatId | null>(null);
  const [custom, setCustom] = useState('');
  const [hint, setHint] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  const week = weekStats(data, now);
  const amt = parseAmount(amtStr);
  const pct = (n: number) => {
    const p = Math.max(1, Math.round((n / Math.max(1, week.weekMoney)) * 100));
    return tr(`About ${p}% of your week`, `Sekitar ${p}% dari jatah minggumu`);
  };
  const reset = () => { setAmtStr(''); setCat(null); setCustom(''); setHint(''); setSavedId(null); };

  const save = () => {
    if (!amt) return setHint(tr('Type an amount first.', 'Ketik jumlahnya dulu.'));
    if (!cat) return setHint(tr('Pick a category first.', 'Pilih kategori dulu.'));
    if (cat === 'other' && !custom.trim()) return setHint(tr('Name your category first.', 'Tulis nama kategorinya dulu.'));
    setSavedId(actions.addPurchase({ name: cat === 'other' ? custom.trim() : catShort(cat), cat, amt }));
  };
  const addIncome = (src: string) => {
    if (!amt) return setHint(tr('Type an amount first.', 'Ketik jumlahnya dulu.'));
    actions.addIncome(src, amt);
    toast(tr(`${money(amt)} from ${src} added to this week.`, `${money(amt)} dari ${wordLabel(src)} masuk ke minggu ini.`));
    reset();
  };

  const saved = savedId ? data.purchases.find(p => p.id === savedId) : undefined;
  if (saved) {
    return (
      <div className={variant === 'panel' ? 'log-saved panel' : 'log-saved'}>
        <div className="t13 w6 accent-text" style={{ padding: variant === 'panel' ? '20px 24px 0' : '16px 20px 0' }}>{tr('Saved', 'Tersimpan')}</div>
        <SavedPurchase id={saved.id} weightLine={pct(saved.amt)} onWhy={() => openWhy(saved.id)} onDone={reset} />
      </div>
    );
  }

  const amountBox = (big: boolean) => (
    <label className="amount-box" style={{ minHeight: big ? 72 : 64 }}>
      <span className="w6 muted" style={{ fontSize: big ? 18 : 15 }}>{currencySymbol()}</span>
      <input aria-label={tr('Amount', 'Jumlah')} inputMode="decimal" placeholder="0" value={amtStr} autoComplete="off"
        onChange={e => { setAmtStr(typeAmount(e.target.value)); setHint(''); }}
        onKeyDown={e => { if (e.key === 'Enter' && mode === 'purchase') save(); }}
        style={{ fontSize: big ? 40 : 28 }} />
    </label>
  );
  const hintLine = (
    <div className="t12 muted" role={hint ? 'alert' : undefined} style={hint ? { color: 'var(--color-accent-700)', fontWeight: 600 } : undefined}>
      {hint || (amt ? pct(amt) : ' ')}
    </div>
  );
  const dropdown = (size: number) => (
    <Dropdown label={tr('Category', 'Kategori')} placeholder={tr('Pick a category', 'Pilih kategori')} size={size}
      options={CATS.map(c => ({ value: c.id, label: catShort(c.id) }))}
      value={cat} onPick={c => { setCat(c); setHint(''); }}
      customLabel={tr('Custom…', 'Kustom…')} customValue={'other' as CatId} custom={custom} onCustom={setCustom} />
  );
  const fillRepeat = (name: string, c: CatId, a: number) => setSavedId(actions.addPurchase({ name, cat: c, amt: a }));

  if (variant === 'row') {
    return (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span className="t16 w8">{tr('Log a purchase', 'Catat pembelian')}</span>
          <span className="t13 muted">{tr('Amount → category → save', 'Jumlah → kategori → simpan')}</span>
          <span className="grow" />
          <span className="t13 muted">{tr('Left this week', 'Sisa minggu ini')} <b style={{ color: 'var(--color-text)' }}>{money(week.left)}</b></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{amountBox(false)}{hintLine}</div>
          {dropdown(64)}
          <button className="btn btn-primary" style={{ minHeight: 64, padding: '0 20px', fontSize: 15 }} onClick={save}>{tr('Save', 'Simpan')}</button>
        </div>
        <RepeatChips wrap onPick={fillRepeat} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="t18 w8">{tr('Log a purchase', 'Catat pembelian')}</span>
        <span className="t13 muted">{tr('Amount → category → save', 'Jumlah → kategori → simpan')}</span>
      </div>
      <div role="radiogroup" aria-label={tr('Type', 'Jenis')} className="seg-grid ink self-start" style={{ display: 'flex' }}>
        <button role="radio" aria-checked={mode === 'purchase'} onClick={() => { setMode('purchase'); setHint(''); }} style={{ minHeight: 36 }}>{tr('Purchase', 'Pembelian')}</button>
        <button role="radio" aria-checked={mode === 'income'} onClick={() => { setMode('income'); setHint(''); }} style={{ minHeight: 36 }}>{tr('Income', 'Pemasukan')}</button>
      </div>
      {amountBox(true)}
      {hintLine}
      {mode === 'purchase' ? <>
        <div className="t12 muted">{tr('Category', 'Kategori')}</div>
        {dropdown(52)}
        <button className="btn btn-primary" style={{ minHeight: 48, padding: '0 16px', fontSize: 15 }} onClick={save}>{tr('Save', 'Simpan')}</button>
        <div className="t13 muted pretty" style={{ lineHeight: 1.45 }}>{tr('Mood and wallet are optional after saving.', 'Mood dan dompet bisa ditambah setelah disimpan.')}</div>
        <RepeatChips wrap onPick={fillRepeat} />
      </> : <>
        <div className="t12 muted">{tr('Where it came from', 'Asalnya dari mana')}</div>
        <div className="wrap-row">
          {INCOME_SRC.map(src => <button key={src} className="choice" onClick={() => addIncome(src)}>{wordLabel(src)}</button>)}
        </div>
      </>}
    </div>
  );
}
