import { PurchaseRow, StateView } from '../components/common';
import { GoalPhoto } from '../components/GoalPhoto';
import { dayKey, shortDate } from '../lib/dates';
import { goalStats, parkingStats, pendingLookbacks, weekStats } from '../lib/derive';
import { money, money0, plural } from '../lib/format';
import { useData } from '../lib/store';
import { useUi } from '../ui';
import { newestFirst, toRows } from './rows';

export function Home() {
  const { data } = useData();
  const { now, go, openLog, openWhy } = useUi();

  if (data.purchases.length === 0 && data.parking.length === 0) {
    return (
      <StateView title="Pocket Sense" heading="Nothing logged this week"
        body="Press + and type an amount, then tap a category. That is the whole log."
        action="Log a purchase" onAction={() => openLog()} />
    );
  }

  const week = weekStats(data, now);
  const g = goalStats(data, now);
  const pk = parkingStats(data, now);
  const lookbacks = pendingLookbacks(data, now);
  const today = data.purchases.filter(p => dayKey(p.at) === dayKey(now)).sort(newestFirst);

  const paceLine = week.left < 0
    ? `Rough week.${g.goal ? ` Your goal is still ${g.pct}% there.` : ' Next week starts fresh on Monday.'}`
    : week.day === 7
      ? `Last day of the week. Anything left stays yours.`
      : week.sunday >= 0
        ? `At this pace you'll have about ${money(week.sunday)} left on Sunday.`
        : `At this pace you'll run short by about ${money(-week.sunday)} on Sunday.`;

  return (
    <div className="screen">
      <div className="page-head">
        <div className="t18 w8">Pocket Sense</div>
        <div className="t13 muted">{shortDate(now)}</div>
      </div>
      <div className="rule" />
      <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="t13 muted">{week.left >= 0 ? 'Left this week' : 'Over this week'}</div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.02em' }}>{money(Math.abs(week.left))}</div>
        <div className="t13 muted">of {money0(week.weekMoney)} this week · Day {week.day} of 7</div>
        <div className="bar" style={{ marginTop: 8 }}>
          <span style={{ width: `${Math.min(100, week.weekMoney > 0 ? (week.spent / week.weekMoney) * 100 : 100)}%` }} />
        </div>
        <div className="t14 pretty" style={{ lineHeight: 1.45 }}>{paceLine}</div>
      </div>
      <div className="rule" />

      {g.goal ? (
        <div style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 16, padding: 20 }}>
          <GoalPhoto pct={g.pct} placeholder="Goal photo" style={{ width: 112, height: 112 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div className="t13 muted">Saving for</div>
            <div className="t20 w8" style={{ overflowWrap: 'anywhere' }}>{g.goal.name}</div>
            <div className="t14">{money0(g.saved)} of {money0(g.target)}</div>
            <div className="t13 muted">{g.eta}</div>
            <button className="btn btn-ghost btn-link" onClick={() => go('goals')}>Open goal</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20 }}>
          <div className="stack" style={{ gap: 2 }}>
            <div className="t16 w8">No goal yet</div>
            <div className="t13 muted">Pick one thing you are saving for.</div>
          </div>
          <button className="btn btn-secondary" style={{ minHeight: 44, padding: '0 16px' }} onClick={() => go('goal-setup')}>Set a goal</button>
        </div>
      )}
      <div className="rule" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, padding: '16px 20px' }}>
        <HomeTile title="Thinking of buying…" sub="Check it first" onClick={() => go('thinking')} />
        <HomeTile title="Parking lot" onClick={() => go('parking')}
          sub={pk.ready.length ? `${pk.ready.length} ready to decide` : pk.waiting.length ? `${pk.waiting.length} waiting` : 'Empty'} />
      </div>

      {lookbacks.length > 0 && (
        <div className="surface" style={{ margin: '0 20px 16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="t12 w6 accent-text">{plural(lookbacks.length, 'check-in')} waiting</div>
            <div className="t15 w6">Was the {lookbacks[0].name.toLowerCase()} worth it?</div>
          </div>
          <button className="btn btn-primary" style={{ minHeight: 44, padding: '0 16px' }} onClick={() => go('lookback')}>Answer</button>
        </div>
      )}
      <div className="rule" />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
        <div className="t16 w8">Today</div>
        <div className="t14 muted">{money(today.reduce((a, p) => a + p.amt, 0))}</div>
      </div>
      {today.length === 0 && <div className="t14 muted" style={{ padding: '8px 20px 24px' }}>Nothing logged today. Tap + when you buy something.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16 }}>
        {toRows(data, today).map(r => <PurchaseRow key={r.id} row={r} onWhy={openWhy} />)}
      </div>
    </div>
  );
}

function HomeTile({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button className="btn btn-secondary" onClick={onClick}
      style={{ minHeight: 64, padding: '10px 12px', fontSize: 14, fontWeight: 600, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
      <span>{title}</span>
      <span className="t12 muted" style={{ fontWeight: 400 }}>{sub}</span>
    </button>
  );
}
