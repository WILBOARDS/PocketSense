import { X } from '../components/icons';
import { CLS, CLS_KEYS, catById } from '../lib/constants';
import { classify } from '../lib/classify';
import { money } from '../lib/format';
import { useData } from '../lib/store';

export function WhySheet({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const { data, actions } = useData();
  const p = data.purchases.find(x => x.id === purchaseId);
  if (!p) return null;

  const ctx = { all: data.purchases, rules: data.rules, lessons: data.lessons };
  const current = classify(p, ctx);
  const predicted = classify({ ...p, override: null }, ctx).cls;
  const cat = catById(p.cat);
  const ruleOn = data.rules[p.cat] === current.cls;
  // The "always" option appears once the user has corrected a label, or already has a rule.
  const canRule = !!p.override || ruleOn;

  return (
    <div className="overlay" style={{ zIndex: 30 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Why this class" style={{ padding: '8px 20px 20px', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="t13 muted">{p.name} · {money(p.amt)}</div>
          <button className="icon-btn" style={{ marginRight: -12 }} aria-label="Close" onClick={onClose}><X /></button>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>Why {CLS[current.cls].label}?</div>
        <div className="stack">
          {current.reasons.map((text, i) => (
            <div key={text} className="t15" style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', gap: 8, padding: '10px 0', borderTop: '1px solid var(--color-divider)' }}>
              <span className="w8">{i + 1}</span><span>{text}</span>
            </div>
          ))}
        </div>
        <div className="t15 w6">Not right? You decide.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
          {CLS_KEYS.map(k => (
            <button key={k} className="choice w6" aria-pressed={current.cls === k} style={{ minHeight: 48, padding: '0 8px' }}
              onClick={() => actions.setOverride(p.id, k === predicted ? null : k)}>
              {CLS[k].label}
            </button>
          ))}
        </div>
        {canRule && (
          <button className="check" aria-pressed={ruleOn} onClick={() => actions.toggleRule(p.cat, current.cls)}>
            <span className="check-box" />Always treat {cat.name} as {CLS[current.cls].label}
          </button>
        )}
        <button className="btn btn-primary btn-lg" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
