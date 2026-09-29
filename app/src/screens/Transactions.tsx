import { useState } from 'react';
import { PurchaseRow, StateView } from '../components/common';
import { CLS, CLS_KEYS } from '../lib/constants';
import { dayKey, dayLabel } from '../lib/dates';
import { weekStats } from '../lib/derive';
import { money } from '../lib/format';
import { useData } from '../lib/store';
import type { Cls } from '../lib/types';
import { useUi } from '../ui';
import { newestFirst, toRows } from './rows';

export function Transactions() {
  const { data } = useData();
  const { now, openLog, openWhy } = useUi();
  const [filter, setFilter] = useState<Cls | 'all'>('all');

  const week = weekStats(data, now).purchases.slice().sort(newestFirst);
  if (week.length === 0) {
    const never = data.purchases.length === 0;
    return (
      <StateView title="Spending" heading={never ? 'No purchases yet' : 'No purchases this week'}
        body="Every purchase you log shows up here with its class: Need, Useful, Want or Invest."
        action="Log a purchase" onAction={() => openLog()} />
    );
  }

  const rows = toRows(data, week);
  const counts = { all: rows.length } as Record<Cls | 'all', number>;
  CLS_KEYS.forEach(k => { counts[k] = rows.filter(r => r.cls === k).length; });
  const shown = rows.filter(r => filter === 'all' || r.cls === filter);

  const groups: { key: string; label: string; rows: typeof rows; total: number }[] = [];
  week.forEach((p, i) => {
    const row = rows[i];
    if (!shown.includes(row)) return;
    const key = dayKey(p.at);
    let g = groups.find(x => x.key === key);
    if (!g) groups.push((g = { key, label: dayLabel(p.at, now), rows: [], total: 0 }));
    g.rows.push(row);
    g.total += p.amt;
  });

  return (
    <div className="screen">
      <div className="page-head">
        <div className="page-title">Transactions</div>
        <div className="t13 muted">This week</div>
      </div>
      <div className="hscroll" style={{ padding: '0 20px 16px' }}>
        {(['all', ...CLS_KEYS] as const).map(k => (
          <button key={k} className="choice" aria-pressed={filter === k} onClick={() => setFilter(k)}
            style={{ flex: 'none', padding: '0 14px', borderColor: 'var(--color-divider)' }}>
            {k === 'all' ? 'All' : CLS[k].label} {counts[k]}
          </button>
        ))}
      </div>
      <div className="rule" />
      {groups.length === 0 && <div className="t14 muted" style={{ padding: '24px 20px' }}>No purchases in this class this week.</div>}
      {groups.map(g => (
        <div key={g.key} className="stack">
          <div className="t13 w6" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
            <span>{g.label}</span><span className="muted" style={{ fontWeight: 400 }}>{money(g.total)}</span>
          </div>
          {g.rows.map(r => <PurchaseRow key={r.id} row={r} onWhy={openWhy} />)}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}
