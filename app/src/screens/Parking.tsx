import { useState } from 'react';
import { BackBar, StateView } from '../components/common';
import { PARK_CATS, parkCatLabel } from '../lib/constants';
import { relDate, timeLeft } from '../lib/dates';
import { parkingStats, weekStats } from '../lib/derive';
import { capitalize, money, money0 } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import type { Parked } from '../lib/types';
import { useUi } from '../ui';

/** 'all', 'ready', 'promo', or a parking category id. */
type Filter = string;

export function Parking() {
  const { data, actions } = useData();
  const { now, go, openLog, toast } = useUi();
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

      {ready.map(k => (
        <div key={k.id} className="red-block" style={{ borderBottom: '2px solid var(--color-bg)' }}>
          <div className="t13 w6">{[tr("Wait's over", 'Waktu tunggu selesai'), money(k.price), k.src].filter(Boolean).join(' · ')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {tr(`Still want the ${k.name}?`, `Masih mau ${k.name}?`)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            <button className="on-red solid w6" onClick={() => {
              actions.decideParked(k.id, 'skipped');
              if (data.goal) {
                actions.addContrib(`Skipped: ${capitalize(k.name)}`, k.price);
                toast(tr(`${money0(k.price)} kept and added to ${data.goal.name}.`, `${money0(k.price)} disimpan dan masuk ke ${data.goal.name}.`));
              } else toast(tr(`${money0(k.price)} kept.`, `${money0(k.price)} disimpan.`));
            }}>{tr('Skip it', 'Lewati')}</button>
            <button className="on-red" onClick={() => {
              actions.extendParked(k.id, 1440);
              toast(tr('Parked for another 24 hours.', 'Diparkir 24 jam lagi.'));
            }}>{tr('Wait longer', 'Tunggu lagi')}</button>
            <button className="on-red" onClick={() => {
              actions.decideParked(k.id, 'bought');
              openLog({ amt: k.price, name: capitalize(k.name), cat: PARK_CATS.find(c => c.id === k.cat)?.buyCat });
            }}>{tr('Buy it', 'Beli')}</button>
          </div>
        </div>
      ))}

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
