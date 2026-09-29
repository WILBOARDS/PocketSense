import { useState } from 'react';
import { StateView } from '../components/common';
import { GoalPhoto } from '../components/GoalPhoto';
import { relDate } from '../lib/dates';
import { goalStats } from '../lib/derive';
import { money0 } from '../lib/format';
import { useData } from '../lib/store';
import { useUi } from '../ui';

export function Goal() {
  const { data, actions } = useData();
  const { now, go, toast } = useUi();
  const [addOpen, setAddOpen] = useState(false);

  const g = goalStats(data, now);
  if (!g.goal) {
    return <StateView title="Goal" heading="No goal yet" body="Pick one thing you are saving for. A photo and a price make it real."
      action="Set a goal" onAction={() => go('goal-setup')} />;
  }
  const goalName = g.goal.name;

  return (
    <div className="screen">
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div className="page-title">Goal</div>
        <button className="btn btn-ghost btn-link" style={{ alignSelf: 'center' }} onClick={() => go('goal-setup')}>Edit</button>
      </div>
      <GoalPhoto pct={g.pct} editable placeholder="Add a photo of what you're saving for"
        style={{ height: 280, borderTop: '2px solid var(--color-divider)', borderBottom: '2px solid var(--color-divider)' }} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, overflowWrap: 'anywhere' }}>{goalName}</div>
        <div className="t15" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{money0(g.saved)} of {money0(g.target)}</span><span className="w6">{g.pct}%</span>
        </div>
        <div className="bar"><span style={{ width: `${g.pct}%`, background: 'var(--color-accent)' }} /></div>
        <div className="t14 muted">{g.hasRate && !g.reached ? `${g.eta}, based on your last 4 weeks.` : g.eta}</div>
        <button className="btn btn-primary btn-md self-start" style={{ marginTop: 8 }} onClick={() => setAddOpen(!addOpen)} aria-expanded={addOpen}>
          Add money
        </button>
        {addOpen && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 20].map(a => (
              <button key={a} className="btn btn-secondary" style={{ minHeight: 48, minWidth: 64, padding: '0 14px', fontSize: 15 }}
                onClick={() => { actions.addContrib('Added', a); setAddOpen(false); toast(`$${a} added to ${goalName}.`); }}>
                ${a}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rule" />
      <div style={{ padding: '16px 20px 8px' }} className="t16 w8">How it got here</div>
      {data.contribs.length === 0 && <div className="t14 muted" style={{ padding: '0 20px 16px' }}>Nothing added yet. Skipped buys from your parking lot land here too.</div>}
      {data.contribs.slice().reverse().map(c => (
        <div key={c.id} className="row" style={{ alignItems: 'start' }}>
          <div className="row-main"><span className="row-title">{c.label}</span><span className="row-meta">{relDate(c.at, now)}</span></div>
          <span className="t15 w6">+{money0(c.amt)}</span>
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}
