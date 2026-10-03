import { useState } from 'react';
import { BackBar, Dropdown, Switch } from '../components/common';
import { LinkIcon } from '../components/icons';
import { PARK_CATS, WAITS, waitLabel, type WaitKey } from '../lib/constants';
import { goalStats, weekStats } from '../lib/derive';
import { amountText, currencySymbol, money, money0, parseAmount, typeAmount } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import { useUi, type ParkPrefill } from '../ui';

/** Dropdown value for "+ Your own…". */
const OWN = '__own';

export function Thinking({ prefill }: { prefill?: ParkPrefill }) {
  const { data, actions } = useData();
  const { now, go, openLog, toast } = useUi();
  const [name, setName] = useState(prefill?.name ?? '');
  const [priceStr, setPriceStr] = useState(amountText(prefill?.price ?? 0));
  const [cat, setCat] = useState<string | null>(null);
  const [ownCat, setOwnCat] = useState('');
  const [promo, setPromo] = useState(false);
  const [wait, setWait] = useState<WaitKey>('24h');

  const price = parseAmount(priceStr);
  const { weekMoney } = weekStats(data, now);
  const g = goalStats(data, now);
  const w = weekMoney > 0 ? (price / weekMoney) * 100 : 100;
  const weightLabel = w < 5 ? tr('Small purchase', 'Pembelian kecil') : w < 15 ? tr('Medium purchase', 'Pembelian sedang')
    : w < 30 ? tr('Large purchase', 'Pembelian besar') : tr('Major purchase', 'Pembelian sangat besar');
  const threshold = data.settings.threshold;
  const over = price > (data.settings.weekMoney * threshold) / 100;
  const itemName = name.trim() || tr('this', 'ini');
  const delay = g.hasRate ? Math.ceil(price / (g.weeklySave / 7)) : 0;
  const goalName = g.goal?.name.toLowerCase() ?? '';
  const delayLine = g.goal && !g.reached && g.hasRate
    ? tr(`Buying ${itemName} pushes your ${goalName} back about ${delay} day${delay === 1 ? '' : 's'}.`,
      `Beli ${itemName} bikin ${goalName}-mu mundur sekitar ${delay} hari.`)
    : '';
  const parkCat = cat === OWN ? ownCat.trim() || undefined : cat ?? undefined;
  const buyCat = PARK_CATS.find(c => c.id === cat)?.buyCat;

  const park = () => {
    actions.park({
      name: name.trim() || tr('Unnamed item', 'Barang tanpa nama'), price, minutes: WAITS[wait].minutes,
      cat: parkCat, promo, url: prefill?.url, src: prefill?.src,
    });
    go('parking');
    toast(tr(`Parked. We'll ask again in ${waitLabel(wait)}.`, `Diparkir. Kami tanya lagi dalam ${waitLabel(wait)}.`));
  };

  return (
    <div className="screen-fill">
      <BackBar title={prefill?.url ? tr('Park it', 'Parkir dulu') : tr('Thinking of buying', 'Mau beli sesuatu')} onBack={() => go('home')} />
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prefill?.src && <div className="t12 w6 accent-text">{tr(`Shared from ${prefill.src}`, `Dibagikan dari ${prefill.src}`)}</div>}
        {prefill?.url && <div className="link-box"><LinkIcon /><span>{prefill.url.replace(/^https?:\/\/(www\.)?/, '')}</span></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 8 }}>
          <div className="field">
            <label htmlFor="tb-name">{tr('What is it?', 'Barang apa?')}</label>
            <input id="tb-name" className="input input-lg" value={name} onChange={e => setName(e.target.value)} placeholder={tr('Wireless earbuds', 'Earbuds TWS')} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="tb-price">{tr('Price', 'Harga')} ({currencySymbol()})</label>
            <input id="tb-price" className="input input-lg" inputMode="decimal" value={priceStr} onChange={e => setPriceStr(typeAmount(e.target.value))} placeholder="0" autoComplete="off" />
          </div>
        </div>
        <div className="t13 muted">{tr('Category', 'Kategori')}</div>
        <div style={{ marginTop: -4 }}>
          <Dropdown label={tr('Category', 'Kategori')} placeholder={tr('Pick a category', 'Pilih kategori')} size={48}
            options={PARK_CATS.map(c => ({ value: c.id, label: tr(c.en, c.id_) }))}
            value={cat} onPick={setCat} customLabel={tr('+ Your own…', '+ Buat sendiri…')} customValue={OWN} custom={ownCat} onCustom={setOwnCat} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, borderTop: '1px solid var(--color-neutral-300)', paddingTop: 8 }}>
          <div className="t15 w6">{tr('Promo or flash sale?', 'Lagi promo atau flash sale?')}</div>
          <Switch on={promo} onChange={setPromo} label={tr('Promo or flash sale?', 'Lagi promo atau flash sale?')} />
        </div>
        {promo && (
          <div className="surface t14 pretty" style={{ lineHeight: 1.5, padding: '12px 14px' }}>
            {tr('Countdown timers are there to rush the decision. Most sales come back, and the wait costs you nothing.',
              'Hitung mundur dibuat supaya kamu buru-buru. Kebanyakan promo akan muncul lagi, dan menunggu tidak ada ruginya.')}
          </div>
        )}
      </div>

      {price > 0 ? (
        <>
          <div style={{ borderTop: '2px solid var(--color-divider)', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '4px 16px', alignItems: 'end' }}>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{Math.round(w)}%</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
              <span className="t13 muted">{weightLabel}</span>
              <span className="t15">{tr(`of your ${money0(weekMoney)} week`, `dari jatah ${money0(weekMoney)} minggu ini`)}</span>
            </div>
            {delayLine && <div className="t15 pretty" style={{ gridColumn: '1 / -1', lineHeight: 1.45, paddingTop: 8 }}>{delayLine}</div>}
          </div>
          <div style={{ borderTop: '2px solid var(--color-divider)', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {over ? (
              <>
                <div className="t15 w6">{tr(`It's over your ${threshold}% line. Wait before deciding?`, `Ini melewati batas ${threshold}%-mu. Tunggu dulu sebelum memutuskan?`)}</div>
                <div role="radiogroup" aria-label={tr('Wait period', 'Lama menunggu')} className="seg-grid">
                  {(Object.keys(WAITS) as WaitKey[]).map(k => (
                    <button key={k} role="radio" aria-checked={wait === k} onClick={() => setWait(k)}>{waitLabel(k)}</button>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg" onClick={park}>{tr(`Park it for ${waitLabel(wait)}`, `Parkir selama ${waitLabel(wait)}`)}</button>
              </>
            ) : (
              <div className="t15" style={{ lineHeight: 1.45 }}>
                {tr(`Under your ${threshold}% line, so no wait needed.`, `Masih di bawah batas ${threshold}%-mu, jadi tidak perlu menunggu.`)}
              </div>
            )}
            <button className={over ? 'btn btn-ghost btn-link' : 'btn btn-secondary btn-md'} onClick={() => {
              go('home');
              openLog({ amt: price, name: name.trim() || undefined, cat: buyCat });
            }}>
              {tr('Buy it now and log it', 'Beli sekarang dan catat')}
            </button>
          </div>
        </>
      ) : (
        <div className="t14 muted" style={{ padding: '0 20px 20px', lineHeight: 1.5 }}>
          {g.goal
            ? tr('Add a price to see what share of your week it takes and how long it pushes back your goal.', 'Isi harga untuk melihat porsinya dari jatah minggumu dan berapa lama targetmu mundur.')
            : tr('Add a price to see what share of your week it takes.', 'Isi harga untuk melihat porsinya dari jatah minggumu.')}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{price > 0 ? tr(`${Math.round(w)}% of your week, ${money(price)}`, `${Math.round(w)}% dari jatah minggumu, ${money(price)}`) : ''}</span>
    </div>
  );
}
