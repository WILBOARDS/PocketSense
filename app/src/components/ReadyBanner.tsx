import { PARK_CATS } from '../lib/constants';
import { capitalize, money, money0 } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { Parked } from '../lib/types';
import { useUi } from '../ui';

/** Skip it / Wait longer / Buy it for a parked item whose wait is over. */
export function useDecide() {
  const { data, actions } = useData();
  const { openLog, toast } = useUi();
  return {
    skip: (k: Parked) => {
      actions.decideParked(k.id, 'skipped');
      if (data.goal) {
        actions.addContrib(`Skipped: ${capitalize(k.name)}`, k.price);
        toast(tr(`${money0(k.price)} kept and added to ${data.goal.name}.`, `${money0(k.price)} disimpan dan masuk ke ${data.goal.name}.`));
      } else toast(tr(`${money0(k.price)} kept.`, `${money0(k.price)} disimpan.`));
    },
    wait: (k: Parked) => {
      actions.extendParked(k.id, 1440);
      toast(tr('Parked for another 24 hours.', 'Diparkir 24 jam lagi.'));
    },
    buy: (k: Parked) => {
      actions.decideParked(k.id, 'bought');
      openLog({ amt: k.price, name: capitalize(k.name), cat: PARK_CATS.find(c => c.id === k.cat)?.buyCat });
    },
  };
}

/**
 * "Wait's over · Still want the earbuds?" with the three choices.
 * block: the phone's full-width red block. bar: one row (half screen). panel: the desktop side panel.
 */
export function ReadyBanner({ k, variant = 'block', showSrc = true, onDone }: {
  k: Parked; variant?: 'block' | 'bar' | 'panel'; showSrc?: boolean; onDone?: () => void;
}) {
  const decide = useDecide();
  const d = {
    skip: (x: Parked) => { decide.skip(x); onDone?.(); },
    wait: (x: Parked) => { decide.wait(x); onDone?.(); },
    buy: (x: Parked) => { onDone?.(); decide.buy(x); },
  };
  const label = [tr("Wait's over", 'Waktu tunggu selesai'), money(k.price), showSrc ? k.src : ''].filter(Boolean).join(' · ');
  const question = tr(`Still want the ${k.name}?`, `Masih mau ${k.name}?`);
  const buttons = (
    <div className={`ready-actions is-${variant}`}>
      <button className="on-red solid w6" onClick={() => d.skip(k)}>{tr('Skip it', 'Lewati')}</button>
      <button className="on-red" onClick={() => d.wait(k)}>{tr('Wait longer', 'Tunggu lagi')}</button>
      <button className="on-red" onClick={() => d.buy(k)}>{tr('Buy it', 'Beli')}</button>
    </div>
  );
  if (variant === 'bar') {
    return (
      <div className="red-block ready-bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="t12 w6">{label}</span>
          <span className="t18 w8" style={{ overflowWrap: 'anywhere' }}>{question}</span>
        </div>
        {buttons}
      </div>
    );
  }
  return (
    <div className={variant === 'panel' ? 'red-block ready-panel' : 'red-block'} style={variant === 'block' ? { borderBottom: '2px solid var(--color-bg)' } : undefined}>
      <div className={variant === 'panel' ? 't12 w6' : 't13 w6'}>{label}</div>
      <div style={{ fontSize: variant === 'panel' ? 20 : 24, fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{question}</div>
      {buttons}
    </div>
  );
}
