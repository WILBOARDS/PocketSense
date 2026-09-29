import { useState, type ReactNode } from 'react';
import { StateView } from '../components/common';
import { CLS } from '../lib/constants';
import { weekKey, weekRange } from '../lib/dates';
import { insights } from '../lib/insights';
import { money } from '../lib/format';
import { useData } from '../lib/store';
import { useUi } from '../ui';

const LEARNING_BODY = 'For your first 2 weeks you will see simple totals only. Patterns appear once there is enough data to be fair about them.';

export function Insights({ patternNames }: { patternNames: boolean }) {
  const { data, actions } = useData();
  const { now, toast } = useUi();
  const [whyOpen, setWhyOpen] = useState(false);

  if (data.purchases.length === 0) {
    return <StateView title="Insights" heading="Learning your patterns" body={LEARNING_BODY} />;
  }

  const ins = insights(data, now);
  const spent = ins.week.spent;
  const committed = data.commitWeek === weekKey(now);
  const noPatterns = !ins.impulse && !ins.leak && !ins.saver;

  return (
    <div className="screen">
      <div className="page-head">
        <div className="page-title">Insights</div>
        <div className="t13 muted">{weekRange(now)}</div>
      </div>
      <div className="rule" />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="t16 w8">Where it went</div>
        <div role="img" aria-label="Spending by class this week" style={{ display: 'flex', height: 28, border: '1px solid var(--color-text)' }}>
          {ins.totals.map(({ k, v }) => (
            <div key={k} style={{ width: spent ? `${(v / spent) * 100}%` : '0%', background: barBg(k), borderRight: v ? '1px solid var(--color-bg)' : 0 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px 16px' }}>
          {ins.totals.map(({ k, v }) => (
            <div key={k} className="t14" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, flex: 'none', background: barBg(k), border: `1px solid ${CLS[k].bd}` }} />
              <span style={{ flex: 1 }}>{CLS[k].label}</span><span className="w6">{money(v)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rule" />

      <div className="section-title">Patterns this week</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 20px' }}>
        {ins.learning ? (
          <div className="surface t14 pretty" style={{ padding: 16, lineHeight: 1.5 }}>
            <div className="t16 w6" style={{ marginBottom: 6 }}>Learning your patterns</div>
            {LEARNING_BODY}
          </div>
        ) : (
          <>
            {ins.impulse && (
              <PatternCard name="Impulse spike" score={ins.impulse.score} showName={patternNames} line={ins.impulse.line} basis={ins.impulse.basis}>
                <button className="btn btn-ghost btn-link" onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen}>
                  {whyOpen ? 'Hide why this happens' : 'Why this happens'}
                </button>
                {whyOpen && (
                  <div className="t14 pretty" style={{ lineHeight: 1.5, borderTop: '1px solid var(--color-divider)', paddingTop: 10 }}>
                    Boredom and stress make the reward of buying feel bigger right now than it will later. A short wait lets the feeling pass before the money does.
                  </div>
                )}
              </PatternCard>
            )}
            {ins.leak && <PatternCard name="Leak" score={ins.leak.score} showName={patternNames} line={ins.leak.line} basis={ins.leak.basis} />}
            {ins.saver && (
              <div style={{ border: '2px solid var(--color-text)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {patternNames && <div className="t12 w6">Saver streak</div>}
                <div className="t16 w6 pretty" style={{ lineHeight: 1.35 }}>{ins.saver}</div>
                <div className="t12 muted">From your parking lot this month</div>
              </div>
            )}
            {noPatterns && <div className="t14 muted">No strong patterns this week.</div>}
          </>
        )}
      </div>
      <div className="rule" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <Stat label="Bored vs Needed it" value={ins.boredVs?.value ?? '—'}
          line={ins.boredVs?.line ?? 'Needs 3 of each to compare'} basis={ins.boredBasis} divider />
        <Stat label="Regret rate" value={ins.regret ?? '—'}
          line={ins.regret ? 'check-ins rated Regret it' : 'Needs 3 check-ins'} basis={ins.regretBasis} />
      </div>

      <div className="red-block">
        <div className="t13 w6">This week's one thing</div>
        <div className="pretty" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{ins.oneThing}</div>
        <button className="on-red w6 self-start" aria-pressed={committed} style={{ padding: '0 20px' }}
          onClick={() => {
            actions.setCommitWeek(committed ? null : weekKey(now));
            if (!committed) toast('Got it. This stays here until Sunday.');
          }}>
          {committed ? 'Committed for this week' : 'Commit to this'}
        </button>
      </div>
    </div>
  );
}

const barBg = (k: keyof typeof CLS) => (k === 'useful' ? 'var(--color-neutral-300)' : CLS[k].bg === 'transparent' ? 'var(--color-bg)' : CLS[k].bg);

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
