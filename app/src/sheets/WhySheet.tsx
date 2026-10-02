import { X } from '../components/icons';
import { CLS_KEYS, catName, cls, purchaseName } from '../lib/constants';
import { classify } from '../lib/classify';
import { money } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';

export function WhySheet({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const { data, actions } = useData();
  const p = data.purchases.find(x => x.id === purchaseId);
  if (!p) return null;

  const ctx = { all: data.purchases, rules: data.rules, lessons: data.lessons };
  const current = classify(p, ctx);
  const predicted = classify({ ...p, override: null }, ctx).cls;
  const cat = catName(p.cat);
  const label = cls(current.cls).label;
  const ruleOn = data.rules[p.cat] === current.cls;
  // The "always" option appears once the user has corrected a label, or already has a rule.
  const canRule = !!p.override || ruleOn;

  return (
    <div className="overlay" style={{ zIndex: 30 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={tr('Why this class', 'Kenapa kelas ini')} style={{ padding: '8px 20px 20px', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="t13 muted">{purchaseName(p)} · {money(p.amt)}</div>
          <button className="icon-btn" style={{ marginRight: -12 }} aria-label={tr('Close', 'Tutup')} onClick={onClose}><X /></button>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>{tr(`Why ${label}?`, `Kenapa ${label}?`)}</div>
        <div className="stack">
          {current.reasons.map((text, i) => (
            <div key={text} className="t15" style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', gap: 8, padding: '10px 0', borderTop: '1px solid var(--color-divider)' }}>
              <span className="w8">{i + 1}</span><span>{text}</span>
            </div>
          ))}
        </div>
        <div className="t15 w6">{tr('Not right? You decide.', 'Kurang tepat? Kamu yang tentukan.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
          {CLS_KEYS.map(k => (
            <button key={k} className="choice w6" aria-pressed={current.cls === k} style={{ minHeight: 48, padding: '0 8px' }}
              onClick={() => actions.setOverride(p.id, k === predicted ? null : k)}>
              {cls(k).label}
            </button>
          ))}
        </div>
        {canRule && (
          <button className="check" aria-pressed={ruleOn} onClick={() => actions.toggleRule(p.cat, current.cls)}>
            <span className="check-box" />{tr(`Always treat ${cat} as ${label}`, `Selalu anggap ${cat} sebagai ${label}`)}
          </button>
        )}
        <button className="btn btn-primary btn-lg" onClick={onClose}>{tr('Done', 'Selesai')}</button>
      </div>
    </div>
  );
}
