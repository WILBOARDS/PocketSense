import { useState } from 'react';
import { useAccount } from '../lib/account';

export function SignOutSheet({ onClose }: { onClose: () => void }) {
  const acc = useAccount();
  const [busy, setBusy] = useState(false);
  const { online, pending } = acc.sync;
  const unsynced = !online && pending
    ? `${pending} change${pending > 1 ? "s haven't" : " hasn't"} synced because you're offline. Signing out now loses ${pending > 1 ? 'them' : 'it'}.`
    : '';

  return (
    <div className="overlay" style={{ zIndex: 30 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Sign out" style={{ padding: 20, gap: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>Sign out?</div>
        <div className="t15 pretty" style={{ lineHeight: 1.5 }}>This clears your data from this phone. It stays in your account and comes back when you sign in again.</div>
        {unsynced && (
          <div role="alert" className="t14 w6" style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', padding: '12px 14px', lineHeight: 1.45 }}>{unsynced}</div>
        )}
        <button className="btn btn-primary btn-lg" disabled={busy}
          onClick={async () => { setBusy(true); await acc.signOut(); onClose(); }}>
          Sign out and clear this phone
        </button>
        <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
