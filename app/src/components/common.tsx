import type { ReactNode } from 'react';
import { CLS } from '../lib/constants';
import type { Cls } from '../lib/types';
import { ArrowLeft } from './icons';

export function BackBar({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return (
    <div className="back-bar">
      <button className="icon-btn" aria-label="Back" onClick={onBack}><ArrowLeft /></button>
      <div className="back-bar-title">{title}</div>
      {action}
    </div>
  );
}

export function ClsBadge({ cls, onClick, big }: { cls: Cls; onClick: () => void; big?: boolean }) {
  const s = CLS[cls];
  return (
    <button
      className="cls-badge"
      onClick={onClick}
      aria-label={`${s.label}. Why this class?`}
      style={{ background: s.bg, color: s.fg, borderColor: s.bd, ...(big ? { minHeight: 32, padding: '2px 10px', fontSize: 13 } : null) }}
    >
      {s.label} · Why?
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
