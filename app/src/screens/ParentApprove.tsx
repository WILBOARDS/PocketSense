// The page a parent lands on from the approval email (?consent=<token>). They don't have an account.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrivacyText } from './Account';

type View =
  | { kind: 'loading' }
  | { kind: 'error'; msg: string }
  | { kind: 'review'; childEmail: string }
  | { kind: 'done'; approved: boolean; childEmail: string };

async function call(body: Record<string, string>): Promise<{ ok: true; data: { childEmail: string } } | { ok: false; msg: string }> {
  if (!supabase) return { ok: false, msg: 'Accounts are not set up in this copy of Pocket Sense.' };
  const { data, error } = await supabase.functions.invoke('approve-consent', { body });
  if (!error) return { ok: true, data };
  const res = (error as { context?: Response }).context;
  const reply = res && typeof res.json === 'function' ? await res.json().catch(() => null) : null;
  return { ok: false, msg: reply?.error ?? "Can't reach the server. Check your connection and reload this page." };
}

export function ParentApprove({ token, onClose }: { token: string; onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState(false);

  useEffect(() => {
    let live = true;
    void call({ token }).then(r => {
      if (live) setView(r.ok ? { kind: 'review', childEmail: r.data.childEmail } : { kind: 'error', msg: r.msg });
    });
    return () => { live = false; };
  }, [token]);

  const decide = async (decision: 'approve' | 'decline') => {
    if (view.kind !== 'review') return;
    setBusy(true);
    const r = await call({ token, decision });
    setBusy(false);
    setView(r.ok ? { kind: 'done', approved: decision === 'approve', childEmail: view.childEmail } : { kind: 'error', msg: r.msg });
  };

  const title = { fontSize: 32, fontWeight: 800, lineHeight: 1.05, paddingTop: 16, textWrap: 'pretty', overflowWrap: 'anywhere' } as const;
  const p = 't15 pretty';

  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 14 }}>
      <div className="t13 w6 accent-text" style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>Pocket Sense · Parent approval</div>
      <div className="rule" />
      {view.kind === 'loading' && <div className="t15 muted" style={{ paddingTop: 16 }}>Loading…</div>}
      {view.kind === 'error' && <>
        <div style={title}>This link doesn't work</div>
        <div className={p} role="alert" style={{ lineHeight: 1.5 }}>{view.msg}</div>
      </>}
      {view.kind === 'review' && <>
        <div style={title}>Approve Pocket Sense for {view.childEmail}?</div>
        <div className={p} style={{ lineHeight: 1.5 }}>They want to use Pocket Sense, a spending-awareness app, on both their phone and a PC.</div>
        <div className="surface" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="t15 w6">What gets stored if you approve</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>Their email and birth year, purchases (amount, category, wallet and time), mood tags, savings goal, parking lot and app settings.</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>It's stored on Supabase servers. The person who runs Pocket Sense can technically see this data. It's never sold or used for ads.</div>
          <button className="btn btn-ghost btn-link" aria-expanded={policy} onClick={() => setPolicy(!policy)}>
            {policy ? 'Hide the privacy policy' : 'Read the privacy policy'}
          </button>
        </div>
        {policy && <div style={{ margin: '0 -20px' }}><PrivacyText /></div>}
        <div className={p} style={{ lineHeight: 1.5 }}>If you don't approve, nothing is stored. The app keeps working on their phone only.</div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => decide('approve')}>Approve</button>
        <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => decide('decline')}>Don't approve</button>
      </>}
      {view.kind === 'done' && <>
        <div style={title}>{view.approved ? 'Approved' : 'Not approved'}</div>
        <div className={p} style={{ lineHeight: 1.5 }}>
          {view.approved
            ? `Thanks. ${view.childEmail}'s data starts syncing the next time they open Pocket Sense.`
            : `Nothing was stored. ${view.childEmail} can keep using Pocket Sense on their phone.`}
        </div>
        <div className="t14 muted">You can close this page.</div>
        <div className="grow" />
        <button className="btn btn-secondary btn-md" onClick={onClose}>Open Pocket Sense</button>
      </>}
    </div>
  );
}
