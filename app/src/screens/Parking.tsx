import { useState } from 'react';
import { PastePark } from '../components/PastePark';
import { BackBar, StateView } from '../components/common';
import { ReadyBanner } from '../components/ReadyBanner';
import { PARK_CATS, parkCatLabel } from '../lib/constants';
import { dayMonth, relDate, timeLeft } from '../lib/dates';
import { parkingStats, weekStats } from '../lib/derive';
import { capitalize, money } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { Parked } from '../lib/types';
import { useUi } from '../ui';

/** 'all', 'ready', 'promo', or a parking category id. */
type Filter = string;

export function Parking() {
  const { layout } = useUi();
  return layout === 'phone' ? <ParkingPhone /> : <ParkingWide full={layout === 'full'} />;
}

function ParkingPhone() {
  const { data } = useData();
  const { now, go } = useUi();
  const [filter, setFilter] = useState<Filter>('all');
  const pk = parkingStats(data, now);
  const { weekMoney } = weekStats(data, now);

  const parkBtn = (
    <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14, color: 'var(--color-accent-700)' }} onClick={() => go('thinking')}>
      {tr('Park something', 'Parkir barang')}
    </button>
  );

  if (!pk.ready.length && !pk.waiting.length && !pk.decided.length) {
    return (
      <div className="screen-fill">
        <BackBar title={tr('Parking lot', 'Parkiran')} onBack={() => go('home')} />
        <StateView heading={tr('Nothing parked', 'Belum ada yang diparkir')}
          body={tr('When something tempts you, park it here and decide once the moment has passed. You can also share a product to Pocket Sense from a shop app.',
            'Kalau ada yang menggoda, parkir di sini dan putuskan setelah keinginannya reda. Kamu juga bisa membagikan produk ke Pocket Sense dari aplikasi toko.')}
          action={tr('Thinking of buying…', 'Mau beli sesuatu…')} onAction={() => go('thinking')} />
      </div>
    );
  }

  const live = [...pk.ready, ...pk.waiting];
  const match = (k: Parked) =>
    filter === 'all' || (filter === 'ready' && k.endsAt <= now) || (filter === 'promo' && !!k.promo) || k.cat === filter;
  const ready = pk.ready.filter(match);
  const waiting = filter === 'ready' ? [] : pk.waiting.filter(match);
  // Only offer category chips for categories something is actually parked under.
  const usedCats = PARK_CATS.filter(c => live.some(k => k.cat === c.id));
  const filters: { v: Filter; label: string }[] = [
    { v: 'all', label: `${tr('All', 'Semua')} ${live.length}` },
    { v: 'ready', label: `${tr('Ready', 'Siap')} ${pk.ready.length}` },
    { v: 'promo', label: `${tr('Promo only', 'Hanya promo')} ${live.filter(k => k.promo).length}` },
    ...usedCats.map(c => ({ v: c.id, label: tr(c.en, c.id_) })),
  ];
  const pct = (price: number) => Math.round((price / Math.max(1, weekMoney)) * 100);

  return (
    <div className="screen">
      <BackBar title={tr('Parking lot', 'Parkiran')} onBack={() => go('home')} action={parkBtn} />
      <div className="pretty" style={{ padding: '20px 20px 16px', fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{pk.saverLine}</div>
      {live.length > 0 && (
        <div className="hscroll" style={{ padding: '0 20px 16px' }}>
          {filters.map(f => (
            <button key={f.v} className="chip" aria-pressed={filter === f.v} onClick={() => setFilter(f.v)}>{f.label}</button>
          ))}
        </div>
      )}
      <div className="rule" />

      {ready.map(k => <ReadyBanner key={k.id} k={k} />)}

      <div className="section-title">{tr('Waiting', 'Menunggu')}</div>
      {waiting.length === 0 && (
        <div className="t14 muted" style={{ padding: '0 20px 16px' }}>
          {filter === 'all' ? tr('Nothing waiting right now.', 'Tidak ada yang menunggu sekarang.') : tr('Nothing matches this filter.', 'Tidak ada yang cocok dengan filter ini.')}
        </div>
      )}
      {waiting.map(k => (
        <div key={k.id} className="row" style={{ padding: '14px 20px' }}>
          <div className="row-main" style={{ gap: 6 }}>
            <span className="row-title">{capitalize(k.name)}</span>
            <span className="row-meta">
              {[money(k.price), tr(`${pct(k.price)}% of your week`, `${pct(k.price)}% dari jatah minggu`), k.src].filter(Boolean).join(' · ')}
            </span>
            {(k.cat || k.promo) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {k.cat && <span className="tag-box" style={{ borderColor: 'var(--color-text)' }}>{parkCatLabel(k.cat)}</span>}
                {k.promo && <span className="tag-box tag-promo">Promo</span>}
              </div>
            )}
          </div>
          <span className="t14 w6" style={{ whiteSpace: 'nowrap' }}>{timeLeft(k.endsAt - now)}</span>
        </div>
      ))}
      <div className="rule" style={{ marginTop: 8 }} />

      <div className="section-title">{tr('Decided this month', 'Diputuskan bulan ini')}</div>
      {pk.decided.length === 0 && <div className="t14 muted" style={{ padding: '0 20px 16px' }}>{tr('Nothing decided yet.', 'Belum ada yang diputuskan.')}</div>}
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
              {skipped ? tr('Skipped', 'Dilewati') : tr('Bought', 'Dibeli')}
            </span>
          </div>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );
}

type Status = 'all' | 'ready' | 'waiting' | 'decided';

/** Half screen and full window: filters on top, then every parked item as a row. */
function ParkingWide({ full }: { full: boolean }) {
  const { data } = useData();
  const { now } = useUi();
  const [status, setStatus] = useState<Status>('all');
  const [promoOnly, setPromoOnly] = useState(false);
  const [catF, setCatF] = useState<string>('all');
  const [deciding, setDeciding] = useState<Parked | null>(null);
  const pk = parkingStats(data, now);
  const { weekMoney } = weekStats(data, now);

  const stateOf = (k: Parked): Exclude<Status, 'all' | 'decided'> | 'skipped' | 'bought' =>
    k.outcome !== 'pending' ? k.outcome : k.endsAt <= now ? 'ready' : 'waiting';
  const order = { ready: 0, waiting: 1, skipped: 2, bought: 2 };
  const all = data.parking.slice().sort((a, b) => order[stateOf(a)] - order[stateOf(b)]
    || (stateOf(a) === 'waiting' ? a.endsAt - b.endsAt : (b.decidedAt ?? b.createdAt) - (a.decidedAt ?? a.createdAt)));
  const rows = all.filter(k => {
    const st = stateOf(k);
    return (status === 'all' || (status === 'decided' ? st === 'skipped' || st === 'bought' : st === status))
      && (!promoOnly || k.promo) && (catF === 'all' || k.cat === catF);
  });
  const usedCats = PARK_CATS.filter(c => data.parking.some(k => k.cat === c.id));
  const statuses: [Status, string][] = [['all', tr('All', 'Semua')], ['ready', tr('Ready', 'Siap')], ['waiting', tr('Waiting', 'Menunggu')], ['decided', tr('Decided', 'Diputuskan')]];
  const pct = (price: number) => `${Math.round((price / Math.max(1, weekMoney)) * 100)}%`;
  const statusText = (k: Parked) => {
    const st = stateOf(k);
    if (st === 'ready') return tr("Wait's over", 'Waktu tunggu selesai');
    if (st === 'waiting') return timeLeft(k.endsAt - now);
    const when = k.decidedAt ? dayMonth(k.decidedAt) : '';
    return `${st === 'skipped' ? tr('Skipped', 'Dilewati') : tr('Bought', 'Dibeli')}${when ? ` · ${when}` : ''}`;
  };
  const statusColor = (k: Parked) => {
    const st = stateOf(k);
    return st === 'ready' ? 'var(--color-accent-700)' : st === 'waiting' ? 'var(--color-text)' : 'var(--color-neutral-700)';
  };
  const decideBtn = (k: Parked) => stateOf(k) === 'ready' && (
    <button className="btn btn-primary" style={{ minHeight: full ? 32 : 36, padding: '0 12px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setDeciding(k)}>
      {tr('Decide', 'Putuskan')}
    </button>
  );
  const promoTag = <span className="tag-box tag-promo">Promo</span>;
  const pad = full ? 28 : 20;

  return (
    <div className="screen">
      {full ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 28px' }}>
          <span className="wide-title">{tr('Parking lot', 'Parkiran')}</span>
          <span className="t15 muted">{pk.saverLine}</span>
        </div>
      ) : (
        <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="t18 w8 pretty" style={{ lineHeight: 1.25 }}>{pk.saverLine}</div>
          <PastePark />
        </div>
      )}
      <div className="filter-bar" style={{ padding: `12px ${pad}px`, gap: full ? 12 : 8 }}>
        <div role="radiogroup" aria-label={tr('Status', 'Status')} className="seg-grid ink" style={{ display: 'flex' }}>
          {statuses.map(([v, l]) => <button key={v} role="radio" aria-checked={status === v} onClick={() => setStatus(v)}>{l}</button>)}
        </div>
        <button className="chip promo-toggle" style={{ minHeight: 36 }} aria-pressed={promoOnly} onClick={() => setPromoOnly(!promoOnly)}>
          <span className="promo-box" />{tr('Promo only', 'Hanya promo')}
        </button>
        {full && <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-divider)' }} />}
        {usedCats.length > 0 && [['all', tr('All categories', 'Semua kategori')], ...usedCats.map(c => [c.id, tr(c.en, c.id_)])].map(([v, l]) => (
          <button key={v} className="chip" style={{ minHeight: 36, padding: '0 12px' }} aria-pressed={catF === v} onClick={() => setCatF(v)}>{l}</button>
        ))}
      </div>

      {!full && pk.ready[0] && <ReadyBanner k={pk.ready[0]} variant="bar" />}

      {full ? (
        <div style={{ padding: '0 28px 24px' }}>
          <div className="wide-table parking" role="table" aria-label={tr('Parked items', 'Barang diparkir')}>
            <div className="wide-th" role="row">
              <span role="columnheader">{tr('Item', 'Barang')}</span><span role="columnheader">{tr('Category', 'Kategori')}</span>
              <span role="columnheader">Promo</span><span role="columnheader" style={{ textAlign: 'right' }}>{tr('Price', 'Harga')}</span>
              <span role="columnheader" style={{ textAlign: 'right' }}>{tr('Share of week', 'Porsi minggu')}</span>
              <span role="columnheader">{tr('Status', 'Status')}</span><span role="columnheader" />
            </div>
            {rows.map(k => (
              <div key={k.id} className="wide-tr" role="row" style={stateOf(k) === 'ready' ? { background: 'var(--color-accent-100)' } : undefined}>
                <span role="cell" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="w6" style={{ overflowWrap: 'anywhere' }}>{capitalize(k.name)}</span>
                  {k.src && <span className="t12 muted">{k.src}</span>}
                </span>
                <span role="cell">{parkCatLabel(k.cat) || '—'}</span>
                <span role="cell">{k.promo && promoTag}</span>
                <span role="cell" className="w6" style={{ textAlign: 'right' }}>{money(k.price)}</span>
                <span role="cell" style={{ textAlign: 'right' }}>{pct(k.price)}</span>
                <span role="cell" className="w6" style={{ color: statusColor(k) }}>{statusText(k)}</span>
                <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>{decideBtn(k)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : rows.map(k => (
        <div key={k.id} className="half-park-row" style={stateOf(k) === 'ready' ? { background: 'var(--color-accent-100)' } : undefined}>
          <div className="row-main" style={{ gap: 4 }}>
            <span className="row-title">{capitalize(k.name)}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {k.src && <span className="t12 muted">{k.src}</span>}
              {k.cat && <span className="tag-box" style={{ borderColor: 'var(--color-text)', padding: '2px 6px' }}>{parkCatLabel(k.cat)}</span>}
              {k.promo && promoTag}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="t15 w6">{money(k.price)}</span><span className="t12 muted">{pct(k.price)}</span>
          </div>
          <span className="t13 w6" style={{ color: statusColor(k) }}>{statusText(k)}</span>
          <span style={{ display: 'flex', justifyContent: 'flex-end' }}>{decideBtn(k)}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="t14 muted" style={{ padding: `24px ${pad}px` }}>
          {data.parking.length ? tr('Nothing matches these filters.', 'Tidak ada yang cocok dengan filter ini.')
            : tr('Nothing parked yet. Paste a link to park something.', 'Belum ada yang diparkir. Tempel link untuk memarkir barang.')}
        </div>
      )}
      <div style={{ height: 24 }} />

      {deciding && (
        <div className="overlay" style={{ zIndex: 30 }}>
          <div className="backdrop" onClick={() => setDeciding(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={tr('Decide', 'Putuskan')}>
            <ReadyBanner k={deciding} onDone={() => setDeciding(null)} />
            <div style={{ padding: 16 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setDeciding(null)}>{tr('Not now', 'Nanti saja')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
