import { BackBar, StateView } from '../components/common';
import { relDate, timeLeft } from '../lib/dates';
import { parkingStats, weekStats } from '../lib/derive';
import { capitalize, money, money0 } from '../lib/format';
import { useData } from '../lib/store';
import { useUi } from '../ui';

export function Parking() {
  const { data, actions } = useData();
  const { now, go, openLog, toast } = useUi();
  const pk = parkingStats(data, now);
  const { weekMoney } = weekStats(data, now);

  const parkBtn = <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14, color: 'var(--color-accent-700)' }} onClick={() => go('thinking')}>Park something</button>;

  if (!pk.ready.length && !pk.waiting.length && !pk.decided.length) {
    return (
      <div className="screen-fill">
        <BackBar title="Parking lot" onBack={() => go('home')} />
        <StateView heading="Nothing parked"
          body="When something tempts you, park it here and decide once the moment has passed."
          action="Thinking of buying…" onAction={() => go('thinking')} />
      </div>
    );
  }

  return (
    <div className="screen">
      <BackBar title="Parking lot" onBack={() => go('home')} action={parkBtn} />
      <div className="pretty" style={{ padding: 20, fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{pk.saverLine}</div>

      {pk.ready.map(k => (
        <div key={k.id} className="red-block" style={{ borderBottom: '2px solid var(--color-bg)' }}>
          <div className="t13 w6">Wait's over · {money(k.price)}</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere' }}>Still want the {k.name}?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            <button className="on-red solid w6" onClick={() => {
              actions.decideParked(k.id, 'skipped');
              if (data.goal) {
                actions.addContrib(`Skipped: ${capitalize(k.name)}`, k.price);
                toast(`${money0(k.price)} kept and added to ${data.goal.name}.`);
              } else toast(`${money0(k.price)} kept.`);
            }}>Skip it</button>
            <button className="on-red" onClick={() => { actions.extendParked(k.id, 1440); toast('Parked for another 24 hours.'); }}>Wait longer</button>
            <button className="on-red" onClick={() => {
              actions.decideParked(k.id, 'bought');
              openLog({ amt: k.price, name: capitalize(k.name) });
            }}>Buy it</button>
          </div>
        </div>
      ))}

      <div className="section-title">Waiting</div>
      {pk.waiting.length === 0 && <div className="t14 muted" style={{ padding: '0 20px 16px' }}>Nothing waiting right now.</div>}
      {pk.waiting.map(k => (
        <div key={k.id} className="row" style={{ padding: '14px 20px' }}>
          <div className="row-main">
            <span className="row-title">{capitalize(k.name)}</span>
            <span className="row-meta">{money(k.price)} · {Math.round((k.price / weekMoney) * 100)}% of your week</span>
          </div>
          <span className="t14 w6">{timeLeft(k.endsAt - now)}</span>
        </div>
      ))}
      <div className="rule" style={{ marginTop: 8 }} />

      <div className="section-title">Decided this month</div>
      {pk.decided.length === 0 && <div className="t14 muted" style={{ padding: '0 20px 16px' }}>Nothing decided yet.</div>}
      {pk.decided.map(k => {
        const skipped = k.outcome === 'skipped';
        return (
          <div key={k.id} className="row">
            <div className="row-main">
              <span className="row-title">{capitalize(k.name)}</span>
              <span className="row-meta">{money(k.price)} · {relDate(k.decidedAt, now)}</span>
            </div>
            <span className="tag-box" style={skipped
              ? { background: 'var(--color-text)', color: 'var(--color-bg)', borderColor: 'var(--color-text)' }
              : { background: 'transparent', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}>
              {skipped ? 'Skipped' : 'Bought'}
            </span>
          </div>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );
}
