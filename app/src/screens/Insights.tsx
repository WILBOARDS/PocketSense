import { useState, type ReactNode } from 'react';
import { StateView } from '../components/common';
import { cls, type ClsStyle } from '../lib/constants';
import { weekKey, weekRange } from '../lib/dates';
import { insights } from '../lib/insights';
import { money } from '../lib/format';
import { tr } from '../lib/i18n';
import type { Cls } from '../lib/types';
import { useData } from '../lib/store';
import { useUi } from '../ui';

const learningBody = () => tr('For your first 2 weeks you will see simple totals only. Patterns appear once there is enough data to be fair about them.',
  'Selama 2 minggu pertama kamu hanya melihat total sederhana. Pola muncul setelah datanya cukup untuk dinilai dengan adil.');

export function Insights({ patternNames }: { patternNames: boolean }) {
  const { data, actions } = useData();
  const { now, toast } = useUi();
  const [whyOpen, setWhyOpen] = useState(false);

  if (data.purchases.length === 0) {
    return <StateView title={tr('This week', 'Minggu ini')} heading={tr('Learning your patterns', 'Mempelajari polamu')} body={learningBody()} />;
  }

  const ins = insights(data, now);
  const spent = ins.week.spent;
  const committed = data.commitWeek === weekKey(now);
  const noPatterns = !ins.impulse && !ins.leak && !ins.saver;

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '16px 20px', minHeight: 60 }}>
        <span className="page-title">{tr('This week', 'Minggu ini')}</span>
        <span className="t13 muted">{weekRange(now)}</span>
      </div>
      <div className="rule" />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="t16 w8">{tr('Where it went', 'Ke mana uangmu')}</span><span className="t14 w6">{money(spent)}</span>
        </div>
        <div role="img" aria-label={tr('Spending by class this week', 'Belanja per kelas minggu ini')} style={{ display: 'flex', height: 28, border: '1px solid var(--color-text)' }}>
          {ins.totals.map(({ k, v }) => (
            <div key={k} style={{ width: spent ? `${(v / spent) * 100}%` : '0%', background: barBg(k), borderRight: v ? '1px solid var(--color-bg)' : 0 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px 16px' }}>
          {ins.totals.map(({ k, v }) => (
            <div key={k} className="t14" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, flex: 'none', background: barBg(k), border: `1px solid ${cls(k).bd}` }} />
              <span style={{ flex: 1 }}>{cls(k).label}</span><span className="w6">{money(v)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rule" />

      <div className="section-title">{tr('Patterns this week', 'Pola minggu ini')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
        {ins.learning ? (
          <div className="surface t14 pretty" style={{ padding: 16, lineHeight: 1.5 }}>
            <div className="t16 w6" style={{ marginBottom: 6 }}>{tr('Learning your patterns', 'Mempelajari polamu')}</div>
            {learningBody()}
          </div>
        ) : (
          <>
            {ins.impulse && (
              <PatternCard name={tr('Impulse spike', 'Lonjakan impulsif')} score={ins.impulse.score} showName={patternNames} line={ins.impulse.line} basis={ins.impulse.basis}>
                <button className="btn btn-ghost btn-link" onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen}>
                  {whyOpen ? tr('Hide why this happens', 'Sembunyikan penjelasannya') : tr('Why this happens', 'Kenapa ini terjadi')}
                </button>
                {whyOpen && (
                  <div className="t14 pretty" style={{ lineHeight: 1.5, borderTop: '1px solid var(--color-divider)', paddingTop: 10 }}>
                    {tr('Boredom and stress make the reward of buying feel bigger right now than it will later. A short wait lets the feeling pass before the money does.',
                      'Rasa bosan dan stres membuat senangnya belanja terasa lebih besar sekarang daripada nanti. Menunggu sebentar membuat perasaan itu lewat sebelum uangnya keluar.')}
                  </div>
                )}
              </PatternCard>
            )}
            {ins.leak && <PatternCard name={tr('Leak', 'Kebocoran')} score={ins.leak.score} showName={patternNames} line={ins.leak.line} basis={ins.leak.basis} />}
            {ins.saver && (
              <div style={{ border: '2px solid var(--color-text)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {patternNames && <div className="t12 w6">{tr('Saver streak', 'Rajin menahan diri')}</div>}
                <div className="t16 w6 pretty" style={{ lineHeight: 1.35 }}>{ins.saver}</div>
                <div className="t12 muted">{tr('From your parking lot this month', 'Dari parkiranmu bulan ini')}</div>
              </div>
            )}
            {noPatterns && <div className="t14 muted">{tr('No strong patterns this week.', 'Tidak ada pola yang kuat minggu ini.')}</div>}
          </>
        )}
      </div>
      <div className="rule" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <Stat label={tr('Bored vs Needed it', 'Bosan vs Memang perlu')} value={ins.boredVs?.value ?? '—'}
          line={ins.boredVs?.line ?? tr('Needs 3 of each to compare', 'Butuh 3 dari masing-masing untuk dibandingkan')} basis={ins.boredBasis} divider />
        <Stat label={tr('Regret rate', 'Tingkat menyesal')} value={ins.regret ?? '—'}
          line={ins.regret ? tr('check-ins rated Regret it', 'tinjauan dinilai Menyesal') : tr('Needs 3 check-ins', 'Butuh 3 tinjauan')} basis={ins.regretBasis} />
      </div>

      <div className="red-block">
        <div className="t13 w6">{tr("This week's one thing", 'Satu hal minggu ini')}</div>
        <div className="pretty" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{ins.oneThing}</div>
        <button className="on-red w6 self-start" aria-pressed={committed} style={{ padding: '0 20px' }}
          onClick={() => {
            actions.setCommitWeek(committed ? null : weekKey(now));
            if (!committed) toast(tr('Got it. This stays here until Sunday.', 'Oke. Ini tetap di sini sampai hari Minggu.'));
          }}>
          {committed ? tr('Committed for this week', 'Sudah berkomitmen minggu ini') : tr('Commit to this', 'Aku coba ini')}
        </button>
      </div>
    </div>
  );
}

const barBg = (k: Cls) => {
  const s: ClsStyle = cls(k);
  return k === 'useful' ? 'var(--color-neutral-300)' : s.bg === 'transparent' ? 'var(--color-bg)' : s.bg;
};

function PatternCard({ name, score, showName, line, basis, children }: {
  name: string; score: number; showName: boolean; line: string; basis: string; children?: ReactNode;
}) {
  return (
    <div className="surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showName && (
        <div className="t12 w6 accent-text" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{name}</span><span>{score} / 100</span>
        </div>
      )}
      <div className="t16 w6 pretty" style={{ lineHeight: 1.35 }}>{line}</div>
      <div className="t12 muted">{basis}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, line, basis, divider }: { label: string; value: string; line: string; basis: string; divider?: boolean }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6, borderRight: divider ? '1px solid var(--color-divider)' : 0 }}>
      <div className="t13 muted">{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div className="t13" style={{ lineHeight: 1.4 }}>{line}</div>
      <div className="t12 muted">{basis}</div>
    </div>
  );
}
