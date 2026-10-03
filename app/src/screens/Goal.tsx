import { useState, type ReactNode } from 'react';
import { BackBar, StateView } from '../components/common';
import { GoalPhoto } from '../components/GoalPhoto';
import { relDate } from '../lib/dates';
import { goalStats } from '../lib/derive';
import { addAmounts } from '../lib/constants';
import { money0 } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import { useUi } from '../ui';

export function Goal() {
  const { data, actions } = useData();
  const { now, go, toast, layout } = useUi();
  const wide = layout !== 'phone';
  const full = layout === 'full';
  const head = wide
    ? (action?: ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: full ? '20px 28px' : '16px 20px' }}>
        <span className={full ? 'wide-title grow' : 'page-title grow'}>{tr('Goal', 'Target')}</span>{action}
      </div>
    )
    : (action?: ReactNode) => <BackBar title={tr('Goal', 'Target')} onBack={() => go('home')} action={action} />;
  const [addOpen, setAddOpen] = useState(false);

  const g = goalStats(data, now);
  if (!g.goal) {
    return (
      <div className="screen-fill">
        {head()}
        <StateView heading={tr('No goal yet', 'Belum ada target')}
          body={tr('Pick one thing you are saving for. A photo and a price make it real.', 'Pilih satu hal yang sedang kamu tabung. Foto dan harga membuatnya terasa nyata.')}
          action={tr('Set a goal', 'Buat target')} onAction={() => go('goal-setup')} />
      </div>
    );
  }
  const goalName = g.goal.name;

  return (
    <div className="screen">
      {head(<button className="btn btn-ghost btn-link" style={{ alignSelf: 'center' }} onClick={() => go('goal-setup')}>{tr('Edit goal', 'Ubah target')}</button>)}
      <div className={full ? 'goal-wide' : undefined}>
      <GoalPhoto pct={g.pct} editable placeholder={tr("Add a photo of what you're saving for", 'Tambahkan foto barang yang kamu tabung')}
        style={full ? { height: 320 } : { height: 280, borderBottom: '2px solid var(--color-divider)', borderTop: wide ? '2px solid var(--color-divider)' : 0 }} />
      <div style={{ padding: full ? '24px 28px' : 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {full && <div className="t13 muted">{tr('Saving for', 'Menabung untuk')}</div>}
        <div style={{ fontSize: full ? 40 : 32, fontWeight: 800, lineHeight: 1.05, overflowWrap: 'anywhere' }}>{goalName}</div>
        <div className="t15" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{tr(`${money0(g.saved)} of ${money0(g.target)}`, `${money0(g.saved)} dari ${money0(g.target)}`)}</span><span className="w6">{g.pct}%</span>
        </div>
        <div className="bar"><span style={{ width: `${g.pct}%`, background: 'var(--color-accent)' }} /></div>
        <div className="t14 muted">
          {g.hasRate && !g.reached ? tr(`${g.eta}, based on your last 4 weeks.`, `${g.eta}, berdasarkan 4 minggu terakhirmu.`) : g.eta}
        </div>
        <button className="btn btn-primary btn-md self-start" style={{ marginTop: 8 }} onClick={() => setAddOpen(!addOpen)} aria-expanded={addOpen}>
          {tr('Add money', 'Tambah uang')}
        </button>
        {addOpen && (
          <div style={{ display: 'flex', gap: 8 }}>
            {addAmounts(data.settings.currency).map(a => (
              <button key={a} className="btn btn-secondary" style={{ minHeight: 48, minWidth: 64, padding: '0 14px', fontSize: 15 }}
                onClick={() => {
                  actions.addContrib('Added', a);
                  setAddOpen(false);
                  toast(tr(`${money0(a)} added to ${goalName}.`, `${money0(a)} masuk ke ${goalName}.`));
                }}>
                {money0(a)}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
      <div className="rule" />
      <div style={{ padding: full ? '20px 28px 8px' : '16px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="t16 w8">{tr('Added to this goal', 'Masuk ke target ini')}</span><span className="t14 muted">{money0(g.saved)}</span>
      </div>
      {data.contribs.length === 0 && (
        <div className="t14 muted" style={{ padding: '0 20px 16px' }}>
          {tr('Nothing added yet. Skipped buys from your parking lot land here too.', 'Belum ada. Barang yang kamu lewatkan dari parkiran juga masuk ke sini.')}
        </div>
      )}
      {data.contribs.slice().reverse().map(c => (
        <div key={c.id} className="row" style={{ alignItems: 'start', padding: full ? '14px 28px' : undefined }}>
          <div className="row-main"><span className="row-title">{contribLabel(c.label)}</span><span className="row-meta">{relDate(c.at, now)}</span></div>
          <span className="t15 w6">+{money0(c.amt)}</span>
        </div>
      ))}
      <div style={{ height: 24 }} />
    </div>
  );
}

/** Labels are saved in English ("Added", "Skipped: Hoodie"); this shows them in the current language. */
function contribLabel(label: string) {
  if (label === 'Added') return tr('Added', 'Ditambahkan');
  if (label.startsWith('Skipped: ')) return tr(label, `Dilewati: ${label.slice(9)}`);
  return label;
}
