import { PurchaseRow, StateView } from '../components/common';
import { GoalPhoto } from '../components/GoalPhoto';
import { Gear, XSmall } from '../components/icons';
import { useAccount } from '../lib/account';
import { dayKey, headDate } from '../lib/dates';
import { goalStats, parkingStats, pendingLookbacks, weekStats } from '../lib/derive';
import { money, money0, roughly } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import { useUi } from '../ui';
import { newestFirst, toRows } from './rows';

export function Home() {
  const { data } = useData();
  const { now, go, openLog, openWhy, toast } = useUi();
  const acc = useAccount();

  const head = (
    <div className="home-head">
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="t18 w8">Pocket Sense</div>
        <div className="t12 muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{headDate(now)}</span>
          {acc.enabled && acc.sync.label && <>
            <span aria-hidden="true">·</span>
            <span className="sync-dot" style={{ background: acc.sync.dot }} />
            <span role="status" style={{ color: acc.sync.fg }}>{acc.sync.label}</span>
          </>}
        </div>
      </div>
      <button className="icon-btn" aria-label={tr('Settings', 'Pengaturan')} onClick={() => go('settings')}><Gear /></button>
    </div>
  );

  if (data.purchases.length === 0 && data.parking.length === 0) {
    const wiped = acc.enabled && acc.local.wiped && acc.status === 'out';
    return (
      <div className="screen-fill">
        {head}
        <div className="rule" />
        {wiped
          ? <StateView heading={tr('This phone is cleared', 'HP ini sudah dikosongkan')}
            body={tr('Sign in to bring your data back, or start fresh by logging a purchase.', 'Masuk untuk mengembalikan datamu, atau mulai dari awal dengan mencatat pembelian.')}
            action={tr('Sign in', 'Masuk')} onAction={() => go('signin')} />
          : <StateView heading={tr('Nothing logged this week', 'Belum ada catatan minggu ini')}
            body={tr('Press + and type an amount, pick a category, then save. That is the whole log.', 'Tekan +, ketik jumlah, pilih kategori, lalu simpan. Itu saja.')}
            action={tr('Log a purchase', 'Catat pembelian')} onAction={() => openLog()} />}
      </div>
    );
  }

  const week = weekStats(data, now);
  const g = goalStats(data, now);
  const pk = parkingStats(data, now);
  const lookbacks = pendingLookbacks(data, now);
  const today = data.purchases.filter(p => dayKey(p.at) === dayKey(now)).sort(newestFirst);

  const paceLine = week.left < 0
    ? (g.goal
      ? tr(`Rough week. Your goal is still ${g.pct}% there.`, `Minggu yang berat. Targetmu tetap ${g.pct}% tercapai.`)
      : tr('Rough week. Next week starts fresh on Monday.', 'Minggu yang berat. Minggu depan mulai baru hari Senin.'))
    : week.day === 7
      ? tr('Last day of the week. Anything left stays yours.', 'Hari terakhir minggu ini. Sisanya tetap milikmu.')
      : week.sunday >= 0
        ? tr(`At this pace you'll have about ${money(roughly(week.sunday))} left on Sunday.`, `Kalau begini terus, sisa uangmu sekitar ${money(roughly(week.sunday))} di hari Minggu.`)
        : tr(`At this pace you'll run short by about ${money(roughly(-week.sunday))} on Sunday.`, `Kalau begini terus, kamu akan kurang sekitar ${money(roughly(-week.sunday))} di hari Minggu.`);

  const parkSub = [
    pk.ready.length ? tr(`${pk.ready.length} ready`, `${pk.ready.length} siap`) : '',
    pk.waiting.length ? tr(`${pk.waiting.length} waiting`, `${pk.waiting.length} menunggu`) : '',
  ].filter(Boolean).join(' · ') || tr('Empty', 'Kosong');

  return (
    <div className="screen">
      {head}
      <div className="rule" />
      <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="t13 muted">{week.left >= 0 ? tr('Left this week', 'Sisa minggu ini') : tr('Over this week', 'Lebih minggu ini')}</div>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{money(Math.abs(week.left))}</div>
        <div className="t13 muted">
          {tr(`of ${money0(week.weekMoney)} this week · Day ${week.day} of 7`, `dari ${money0(week.weekMoney)} minggu ini · Hari ke-${week.day} dari 7`)}
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <span style={{ width: `${Math.min(100, week.weekMoney > 0 ? (week.spent / week.weekMoney) * 100 : 100)}%` }} />
        </div>
        <div className="t14 pretty" style={{ lineHeight: 1.45 }}>{paceLine}</div>
      </div>
      <div className="rule" />

      {g.goal ? (
        <button className="goal-strip" onClick={() => go('goals')} aria-label={tr(`Goal: ${g.goal.name}`, `Target: ${g.goal.name}`)}>
          <GoalPhoto pct={g.pct} placeholder={tr('Goal photo', 'Foto target')} style={{ width: 96, height: 96 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div className="t13 muted">{tr('Saving for', 'Menabung untuk')}</div>
            <div className="t20 w8" style={{ overflowWrap: 'anywhere' }}>{g.goal.name}</div>
            <div className="t14">{tr(`${money0(g.saved)} of ${money0(g.target)}`, `${money0(g.saved)} dari ${money0(g.target)}`)}</div>
            <div className="t13 muted">{g.etaShort}</div>
          </div>
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20 }}>
          <div className="stack" style={{ gap: 2 }}>
            <div className="t16 w8">{tr('No goal yet', 'Belum ada target')}</div>
            <div className="t13 muted">{tr('Pick one thing you are saving for.', 'Pilih satu hal yang sedang kamu tabung.')}</div>
          </div>
          <button className="btn btn-secondary" style={{ minHeight: 44, padding: '0 16px' }} onClick={() => go('goal-setup')}>{tr('Set a goal', 'Buat target')}</button>
        </div>
      )}
      <div className="rule" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, padding: '16px 20px' }}>
        <HomeTile title={tr('Thinking of buying…', 'Mau beli sesuatu…')} sub={tr('Check it first', 'Cek dulu')} onClick={() => go('thinking')} />
        <HomeTile title={tr('Parking lot', 'Parkiran')} sub={parkSub} accent={pk.ready.length > 0} onClick={() => go('parking')} />
      </div>

      {lookbacks.length > 0 && (
        <div className="surface" style={{ margin: '0 20px 16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="t12 w6 accent-text">
              {tr(`${lookbacks.length} check-in${lookbacks.length > 1 ? 's' : ''} waiting`, `${lookbacks.length} tinjauan menunggu`)}
            </div>
            <div className="t15 w6">{tr(`Was the ${lookbacks[0].name.toLowerCase()} worth it?`, `${lookbacks[0].name} sepadan nggak?`)}</div>
          </div>
          <button className="btn btn-primary" style={{ minHeight: 44, padding: '0 16px' }} onClick={() => go('lookback')}>{tr('Answer', 'Jawab')}</button>
        </div>
      )}
      {acc.enabled && acc.status === 'out' && !acc.local.promptDismissed && (
        <div className="sign-prompt">
          <div style={{ padding: '14px 0 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="t15 w6">{tr('Sign in to use Pocket Sense on your PC', 'Masuk untuk memakai Pocket Sense di PC')}</div>
            <div className="t13 muted pretty" style={{ lineHeight: 1.45 }}>
              {tr('Your purchases, goal and parking lot stay the same on both. Optional.', 'Pembelian, target, dan parkiranmu sama di keduanya. Opsional.')}
            </div>
            <button className="btn btn-primary self-start" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }} onClick={() => go('signin')}>{tr('Sign in', 'Masuk')}</button>
          </div>
          <button className="icon-btn" aria-label={tr('Dismiss', 'Tutup')}
            onClick={() => { acc.dismissPrompt(); toast(tr('Hidden. You can sign in any time from Settings.', 'Disembunyikan. Kamu bisa masuk kapan saja dari Pengaturan.')); }}>
            <XSmall />
          </button>
        </div>
      )}
      <div className="rule" />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
        <div className="t16 w8">{tr('Today', 'Hari ini')}</div>
        <div className="t14 muted">{money(today.reduce((a, p) => a + p.amt, 0))}</div>
      </div>
      {today.length === 0 && (
        <div className="t14 muted" style={{ padding: '8px 20px 24px' }}>{tr('Nothing logged today. Tap + when you buy something.', 'Belum ada catatan hari ini. Tekan + saat kamu beli sesuatu.')}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16 }}>
        {toRows(data, today).map(r => <PurchaseRow key={r.id} row={r} onWhy={openWhy} />)}
      </div>
    </div>
  );
}

function HomeTile({ title, sub, accent, onClick }: { title: string; sub: string; accent?: boolean; onClick: () => void }) {
  return (
    <button className="btn btn-secondary" onClick={onClick}
      style={{ minHeight: 64, padding: '10px 12px', fontSize: 14, fontWeight: 600, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
      <span>{title}</span>
      <span className={accent ? 't12 accent-text' : 't12 muted'} style={{ fontWeight: 400 }}>{sub}</span>
    </button>
  );
}
