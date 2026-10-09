import { useState } from 'react';
import { useAccount } from '../lib/account';
import { tr } from '../lib/i18n';

export function SignOutSheet({ onClose }: { onClose: () => void }) {
  const acc = useAccount();
  const [busy, setBusy] = useState(false);
  const { online, pending } = acc.sync;
  const unsynced = !online && pending
    ? tr(`${pending} change${pending > 1 ? "s haven't" : " hasn't"} synced because you're offline. Signing out now loses ${pending > 1 ? 'them' : 'it'}.`,
      `${pending} perubahan belum tersinkron karena kamu offline. Kalau keluar sekarang, perubahan itu hilang.`)
    : '';

  return (
    <div className="overlay" style={{ zIndex: 30 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={tr('Sign out of Pocket Sense?', 'Keluar dari Pocket Sense?')} style={{ padding: '20px 20px 24px', gap: 12 }}>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{tr('Sign out of Pocket Sense?', 'Keluar dari Pocket Sense?')}</div>
        <div className="t15 pretty" style={{ lineHeight: 1.5 }}>
          {acc.status === 'pendingConsent'
            ? tr('Nothing has been copied to your account yet, so signing out keeps your data on this phone.',
              'Belum ada yang disalin ke akunmu, jadi keluar tetap menyimpan datamu di HP ini.')
            : tr('Signing out clears this phone, so the next person never sees your data. Everything synced stays in your account. Your goal photo does not: it is only stored on this phone.',
              'Keluar akan menghapus data di HP ini, jadi orang lain tidak melihat datamu. Semua yang tersinkron tetap ada di akunmu. Foto targetmu tidak: foto itu hanya tersimpan di HP ini.')}
        </div>
        {unsynced && (
          <div role="alert" className="t14 w6" style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', padding: '12px 14px', lineHeight: 1.45 }}>{unsynced}</div>
        )}
        <button className="danger-btn" style={{ marginTop: 4 }} disabled={busy}
          onClick={async () => { setBusy(true); await acc.signOut(); onClose(); }}>
          {tr('Sign out', 'Keluar')}
        </button>
        <button className="btn btn-secondary btn-md" onClick={onClose}>{tr('Cancel', 'Batal')}</button>
      </div>
    </div>
  );
}
