// History on bigger windows. Half screen: log row, paste a link, then this week by day.
// Full window: four numbers, class filters, search and a table (logging is in the side panel).
import { useState } from 'react';
import { ClsBadge } from '../components/common';
import { Search } from '../components/icons';
import { LogPanel } from '../components/LogPanel';
import { PastePark } from '../components/PastePark';
import { ReadyBanner } from '../components/ReadyBanner';
import { CLS_KEYS, catShort, cls as clsStyle, moodLabel, purchaseName, wordLabel } from '../lib/constants';
import { clock, dayKey, dayLabel, relDate, weekRange } from '../lib/dates';
import { classifier, parkingStats, weekStats } from '../lib/derive';
import { money } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { Cls, Data, Purchase } from '../lib/types';
import { useUi } from '../ui';
import { newestFirst } from './rows';

export function History() {
  const { layout } = useUi();
  return layout === 'full' ? <HistoryFull /> : <HistoryHalf />;
}

function byDay(list: Purchase[], now: number) {
  const groups: { key: string; label: string; items: Purchase[]; total: number }[] = [];
  for (const p of list) {
    const key = dayKey(p.at);
    let g = groups.find(x => x.key === key);
    if (!g) groups.push((g = { key, label: dayLabel(p.at, now), items: [], total: 0 }));
    g.items.push(p);
    g.total += p.amt;
  }
  return groups;
}

function HistoryHalf() {
  const { data } = useData();
  const { now, openWhy } = useUi();
  const cls = classifier(data);
  const week = weekStats(data, now).purchases.slice().sort(newestFirst);
  const ready = parkingStats(data, now).ready[0];

  return (
    <div className="screen">
      <LogPanel variant="row" />
      <div className="rule" />
      <div style={{ padding: '12px 20px' }}><PastePark /></div>
      {ready && <ReadyBanner k={ready} variant="bar" showSrc={false} />}
      {week.length === 0 && <div className="t14 muted" style={{ padding: '24px 20px' }}>{tr('Nothing logged this week yet.', 'Belum ada catatan minggu ini.')}</div>}
      {byDay(week, now).map(g => (
        <div key={g.key} className="stack">
          <div className="t13 w6" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
            <span>{g.label}</span><span className="muted" style={{ fontWeight: 400 }}>{money(g.total)}</span>
          </div>
          {g.items.map(p => (
            <div key={p.id} className="half-row">
              <div className="row-main">
                <span className="row-title">{purchaseName(p)}</span>
                <span className="row-meta">{clock(p.at)} · {catShort(p.cat)}</span>
              </div>
              <span className="t13 muted">{p.mood ? moodLabel(p.mood) : '—'}</span>
              <span className="t13">{wordLabel(p.wallet)}</span>
              <div className="row-end">
                <span className="t15 w6">{money(p.amt)}</span>
                <ClsBadge cls={cls(p).cls} onClick={() => openWhy(p.id)} />
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}

/** "Want" share of this week's spending and the mood that comes up most with it. */
function wantStats(data: Data, purchases: Purchase[]) {
  const cls = classifier(data);
  const spent = purchases.reduce((a, p) => a + p.amt, 0);
  const wants = purchases.filter(p => cls(p).cls === 'want');
  const wantSum = wants.reduce((a, p) => a + p.amt, 0);
  const moods = new Map<string, number>();
  for (const p of wants) if (p.mood) moods.set(p.mood, (moods.get(p.mood) ?? 0) + 1);
  const top = [...moods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { pct: spent ? Math.round((wantSum / spent) * 100) : 0, sum: wantSum, mood: top };
}

function HistoryFull() {
  const { data } = useData();
  const { now, openWhy } = useUi();
  const [filter, setFilter] = useState<Cls | 'all'>('all');
  const [query, setQuery] = useState('');
  const cls = classifier(data);
  const week = weekStats(data, now);
  const pk = parkingStats(data, now);
  const want = wantStats(data, week.purchases);

  // Searching looks through everything; otherwise the table shows this week.
  const q = query.trim().toLowerCase();
  const base = (q ? data.purchases : week.purchases).slice().sort(newestFirst);
  const text = (p: Purchase) => [purchaseName(p), p.name, catShort(p.cat), p.mood && moodLabel(p.mood), wordLabel(p.wallet)].filter(Boolean).join(' ').toLowerCase();
  const matching = q ? base.filter(p => text(p).includes(q)) : base;
  const rows = matching.filter(p => filter === 'all' || cls(p).cls === filter);
  const count = (k: Cls | 'all') => (k === 'all' ? matching.length : matching.filter(p => cls(p).cls === k).length);
  const live = pk.ready.length + pk.waiting.length;

  return (
    <div className="screen-fill">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 28px', flexWrap: 'wrap' }}>
        <div className="grow" style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="wide-title">{tr('History', 'Riwayat')}</span>
          <span className="t14 muted">{q ? tr('All purchases', 'Semua pembelian') : `${tr('This week', 'Minggu ini')} · ${weekRange(now)}`}</span>
        </div>
        <label className="paste-box" style={{ width: 280, minHeight: 40 }}>
          <Search />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Search purchases', 'Cari pembelian')} aria-label={tr('Search purchases', 'Cari pembelian')} />
        </label>
      </div>
      <div className="stat-tiles">
        <Tile label={tr('Left this week', 'Sisa minggu ini')} value={money(week.left)}
          sub={tr(`of ${money(week.weekMoney)} · Day ${week.day} of 7`, `dari ${money(week.weekMoney)} · Hari ke-${week.day} dari 7`)} />
        <Tile label={tr('Spent', 'Terpakai')} value={money(week.spent)}
          sub={tr(`${week.purchases.length} purchase${week.purchases.length === 1 ? '' : 's'}`, `${week.purchases.length} pembelian`)} />
        <Tile label={tr('Want', 'Ingin')} value={`${want.pct}%`} accent
          sub={want.mood ? tr(`${money(want.sum)} · mostly when ${want.mood}`, `${money(want.sum)} · kebanyakan saat ${moodLabel(want.mood)}`) : money(want.sum)} />
        <Tile label={tr('Parked', 'Diparkir')} value={String(live)}
          sub={pk.ready.length ? tr(`${pk.ready.length} ready to decide`, `${pk.ready.length} siap diputuskan`) : tr('None ready yet', 'Belum ada yang siap')} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '16px 28px', flexWrap: 'wrap' }}>
        {(['all', ...CLS_KEYS] as const).map(k => (
          <button key={k} className="chip" style={{ minHeight: 36 }} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === 'all' ? tr('All', 'Semua') : clsStyle(k).label} {count(k)}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 28px 24px' }}>
        <div className="wide-table history" role="table" aria-label={tr('Purchases', 'Pembelian')}>
          <div className="wide-th" role="row">
            <span role="columnheader">{tr('Date', 'Tanggal')}</span><span role="columnheader">{tr('Item', 'Barang')}</span>
            <span role="columnheader">{tr('Category', 'Kategori')}</span><span role="columnheader">{tr('Class', 'Kelas')}</span>
            <span role="columnheader">Mood</span><span role="columnheader">{tr('Paid with', 'Bayar pakai')}</span>
            <span role="columnheader" style={{ textAlign: 'right' }}>{tr('Amount', 'Jumlah')}</span>
          </div>
          {rows.map(p => (
            <div key={p.id} className="wide-tr" role="row">
              <span role="cell" className="muted">{relDate(p.at, now)} · {clock(p.at)}</span>
              <span role="cell" className="w6" style={{ overflowWrap: 'anywhere' }}>{purchaseName(p)}</span>
              <span role="cell">{catShort(p.cat)}</span>
              <span role="cell"><ClsBadge cls={cls(p).cls} onClick={() => openWhy(p.id)} /></span>
              <span role="cell" className="muted">{p.mood ? moodLabel(p.mood) : '—'}</span>
              <span role="cell">{wordLabel(p.wallet)}</span>
              <span role="cell" className="w6" style={{ textAlign: 'right' }}>{money(p.amt)}</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="t14 muted" style={{ padding: '24px 0' }}>
              {q ? tr('No purchases match that search.', 'Tidak ada pembelian yang cocok.') : tr('No purchases here this week.', 'Belum ada pembelian di sini minggu ini.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <span className="t13 muted">{label}</span>
      <span className="stat-value" style={accent ? { color: 'var(--color-accent-700)' } : undefined}>{value}</span>
      <span className="t12 muted">{sub}</span>
    </div>
  );
}
