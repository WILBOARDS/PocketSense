import { useState } from 'react';
import { BackBar } from '../components/common';
import { WAITS, type WaitKey } from '../lib/constants';
import { goalStats, weekStats } from '../lib/derive';
import { cleanAmount, money, money0 } from '../lib/format';
import { useData } from '../lib/store';
import { useUi } from '../ui';

export function Thinking() {
  const { data, actions } = useData();
  const { now, go, openLog, toast } = useUi();
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [sale, setSale] = useState(false);
  const [wait, setWait] = useState<WaitKey>('24h');

  const price = parseFloat(priceStr) || 0;
  const { weekMoney } = weekStats(data, now);
  const g = goalStats(data, now);
  const w = weekMoney > 0 ? (price / weekMoney) * 100 : 100;
  const weightLabel = w < 5 ? 'Small' : w < 15 ? 'Medium' : w < 30 ? 'Large' : 'Major';
  const line = (data.settings.weekMoney * data.settings.threshold) / 100;
  const over = price > line;
  const itemName = name.trim() || 'this';
  const delay = g.hasRate ? Math.ceil(price / (g.weeklySave / 7)) : 0;
  const delayLine = g.goal && !g.reached && g.hasRate
    ? `Buying ${itemName} pushes your ${g.goal.name.toLowerCase()} back about ${delay} day${delay === 1 ? '' : 's'}.`
    : '';

  return (
    <div className="screen-fill">
      <BackBar title="Thinking of buying" onBack={() => go('home')} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label htmlFor="tb-name">What is it?</label>
          <input id="tb-name" className="input input-lg" value={name} onChange={e => setName(e.target.value)} placeholder="Wireless earbuds" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="tb-price">Price</label>
          <input id="tb-price" className="input input-lg" inputMode="decimal" value={priceStr} onChange={e => setPriceStr(cleanAmount(e.target.value))} placeholder="0.00" autoComplete="off" />
        </div>
        <button className="check" aria-pressed={sale} onClick={() => setSale(!sale)}>
          <span className="check-box" />It's on a sale or has a countdown
        </button>
      </div>

      {price > 0 ? (
        <>
          <div style={{ borderTop: '2px solid var(--color-divider)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="t13 muted">{weightLabel} purchase</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{Math.round(w)}%</div>
            <div className="t15">of your {money0(weekMoney)} week</div>
            {delayLine && <div className="t15 pretty" style={{ lineHeight: 1.45 }}>{delayLine}</div>}
            {sale && (
              <div className="surface t14 pretty" style={{ lineHeight: 1.5, padding: '12px 14px' }}>
                Countdown timers are there to rush the decision. Most sales come back, and the wait costs you nothing.
              </div>
            )}
          </div>
          <div style={{ borderTop: '2px solid var(--color-divider)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {over ? (
              <>
                <div className="t15 w6">It's over your {data.settings.threshold}% line. Wait before deciding?</div>
                <div role="radiogroup" aria-label="Wait period" className="seg-grid">
                  {(Object.keys(WAITS) as WaitKey[]).map(k => (
                    <button key={k} role="radio" aria-checked={wait === k} onClick={() => setWait(k)}>{k}</button>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg" onClick={() => {
                  actions.park(name.trim() || 'Unnamed item', price, WAITS[wait].minutes);
                  go('parking');
                  toast(`Parked. We'll ask again in ${WAITS[wait].label}.`);
                }}>
                  Park it for {WAITS[wait].label}
                </button>
              </>
            ) : (
              <div className="t15" style={{ lineHeight: 1.45 }}>Under your {data.settings.threshold}% line, so no wait needed.</div>
            )}
            <button className="btn btn-secondary btn-md" onClick={() => {
              go('home');
              openLog({ amt: price, name: name.trim() || undefined });
            }}>
              Buy it now and log it
            </button>
          </div>
        </>
      ) : (
        <div className="t14 muted" style={{ padding: '0 20px 20px', lineHeight: 1.5 }}>
          Add a price to see what share of your week it takes{g.goal ? ' and how long it pushes back your goal' : ''}.
        </div>
      )}
      <span className="sr-only" aria-live="polite">{price > 0 ? `${Math.round(w)}% of your week, ${money(price)}` : ''}</span>
    </div>
  );
}
