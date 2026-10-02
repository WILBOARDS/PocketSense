import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cls as clsStyle } from '../lib/constants';
import { tr } from '../lib/i18n';
import type { Cls } from '../lib/types';
import { ArrowLeft, ChevronDown } from './icons';

export function BackBar({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return (
    <div className="back-bar">
      <button className="icon-btn" aria-label={tr('Back', 'Kembali')} onClick={onBack}><ArrowLeft /></button>
      <div className="back-bar-title">{title}</div>
      {action}
    </div>
  );
}

export function ClsBadge({ cls, onClick, big }: { cls: Cls; onClick: () => void; big?: boolean }) {
  const s = clsStyle(cls);
  return (
    <button
      className="cls-badge"
      onClick={onClick}
      aria-label={tr(`${s.label}. Why this class?`, `${s.label}. Kenapa kelas ini?`)}
      style={{ background: s.bg, color: s.fg, borderColor: s.bd, ...(big ? { minHeight: 32, padding: '2px 10px', fontSize: 13 } : null) }}
    >
      {s.label} · {tr('Why?', 'Kenapa?')}
    </button>
  );
}

export interface RowData {
  id: string;
  name: string;
  meta: string;
  amtStr: string;
  cls: Cls;
}

export function PurchaseRow({ row, onWhy }: { row: RowData; onWhy: (id: string) => void }) {
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-title">{row.name}</div>
        <div className="row-meta">{row.meta}</div>
      </div>
      <div className="row-end">
        <div className="t15 w6">{row.amtStr}</div>
        <ClsBadge cls={row.cls} onClick={() => onWhy(row.id)} />
      </div>
    </div>
  );
}

/** Full-screen empty / error message that replaces a screen's content. */
export function StateView({ title, heading, body, action, onAction }: {
  title?: string; heading: string; body: string; action?: string; onAction?: () => void;
}) {
  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
      {title && <><div className="t18 w8">{title}</div><div className="rule" /></>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: title ? 48 : 24 }}>
        <div className="pretty" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{heading}</div>
        <div className="t15 muted pretty" style={{ lineHeight: 1.5 }}>{body}</div>
        {action && onAction && <button className="btn btn-primary btn-md self-start" onClick={onAction}>{action}</button>}
      </div>
    </div>
  );
}

export interface Option<V> {
  value: V;
  label: string;
}

/**
 * A button that opens a list to pick one option, with "Custom…" (or "+ Your own…") at the end
 * that shows a text field for a name the user types. Closes on pick, Escape or a tap outside.
 */
export function Dropdown<V>({ options, value, onPick, placeholder, customLabel, customValue, custom, onCustom, size = 52, label }: {
  options: Option<V>[];
  value: V | null;
  onPick: (v: V) => void;
  placeholder: string;
  /** The last item, e.g. "Custom…". Leave out for no custom option. */
  customLabel?: string;
  /** The value that means "custom". */
  customValue?: V;
  custom?: string;
  onCustom?: (s: string) => void;
  size?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const isCustom = customLabel !== undefined && value === customValue;
  const current = isCustom ? customLabel.replace(/…$/, '') : options.find(o => o.value === value)?.label;
  const all = customLabel !== undefined && customValue !== undefined ? [...options, { value: customValue, label: customLabel }] : options;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  return (
    <div ref={box} className="dropdown">
      <button type="button" className="dropdown-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current ?? placeholder}`}
        onClick={() => setOpen(!open)} style={{ minHeight: size, color: current ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>
        <span style={{ flex: 1 }}>{current ?? placeholder}</span><ChevronDown />
      </button>
      {isCustom && onCustom && (
        <input className="input" aria-label={tr('Name your category', 'Tulis nama kategori')} placeholder={tr('Name your category', 'Tulis nama kategori')}
          value={custom ?? ''} onChange={e => onCustom(e.target.value)} maxLength={40} autoFocus style={{ minHeight: 48, fontSize: 15 }} />
      )}
      {open && (
        <div role="listbox" aria-label={label} className="dropdown-list" style={{ top: size + 4 }}>
          {all.map((o, i) => (
            <button key={i} type="button" role="option" aria-selected={o.value === value}
              className={customLabel !== undefined && i === all.length - 1 ? 'dropdown-opt sep' : 'dropdown-opt'}
              onClick={() => { onPick(o.value); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** On/off switch drawn as a square track, used for "Promo or flash sale?". */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}
