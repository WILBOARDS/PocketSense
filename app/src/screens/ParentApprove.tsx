// The page a parent lands on from the approval email (?consent=<token>). They don't have an account.
import { useEffect, useState } from 'react';
import { tr } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { offlineMsg } from '../lib/sync';
import { PrivacyText } from './Account';

type View =
  | { kind: 'loading' }
  | { kind: 'error'; msg: string }
  | { kind: 'review'; childEmail: string }
  | { kind: 'done'; approved: boolean; childEmail: string };

async function call(body: Record<string, string>): Promise<{ ok: true; data: { childEmail: string } } | { ok: false; msg: string }> {
  if (!supabase) return { ok: false, msg: tr('Accounts are not set up in this copy of Pocket Sense.', 'Akun belum diatur di salinan Pocket Sense ini.') };
  const { data, error } = await supabase.functions.invoke('approve-consent', { body });
  if (!error) return { ok: true, data };
  const res = (error as { context?: Response }).context;
  const reply = res && typeof res.json === 'function' ? await res.json().catch(() => null) : null;
  return { ok: false, msg: reply?.error ?? offlineMsg() };
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
      <div className="t13 w6 accent-text" style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>Pocket Sense · {tr('Parent approval', 'Persetujuan orang tua')}</div>
      <div className="rule" />
      {view.kind === 'loading' && <div className="t15 muted" style={{ paddingTop: 16 }}>{tr('Loading…', 'Memuat…')}</div>}
      {view.kind === 'error' && <>
        <div style={title}>{tr("This link doesn't work", 'Link ini tidak berfungsi')}</div>
        <div className={p} role="alert" style={{ lineHeight: 1.5 }}>{view.msg}</div>
      </>}
      {view.kind === 'review' && <>
        <div style={title}>{tr(`Approve Pocket Sense for ${view.childEmail}?`, `Setujui Pocket Sense untuk ${view.childEmail}?`)}</div>
        <div className={p} style={{ lineHeight: 1.5 }}>
          {tr('They want to use Pocket Sense, a spending-awareness app, on both their phone and a PC.', 'Mereka ingin memakai Pocket Sense, aplikasi untuk lebih sadar soal pengeluaran, di HP dan PC.')}
        </div>
        <div className="surface" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="t15 w6">{tr('What gets stored if you approve', 'Apa yang disimpan kalau Anda setuju')}</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>
            {tr('Their email and birth year, purchases (amount, category, wallet and time), mood tags, savings goal, parking lot and app settings.',
              'Email dan tahun lahir mereka, pembelian (jumlah, kategori, dompet, dan waktu), tag mood, target tabungan, parkiran, dan pengaturan aplikasi.')}
          </div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>
            {tr("It's stored on Supabase servers. The person who runs Pocket Sense can technically see this data. It's never sold or used for ads.",
              'Data disimpan di server Supabase. Pengelola Pocket Sense secara teknis bisa melihat data ini. Data tidak pernah dijual atau dipakai untuk iklan.')}
          </div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>
            {tr('If they use Ask, their question and a summary of their logged spending are sent to an AI service to write the answer.',
              'Kalau mereka memakai fitur Tanya, pertanyaan dan ringkasan pengeluaran yang dicatat dikirim ke layanan AI untuk menulis jawabannya.')}
          </div>
          <button className="btn btn-ghost btn-link" aria-expanded={policy} onClick={() => setPolicy(!policy)}>
            {policy ? tr('Hide the privacy policy', 'Sembunyikan kebijakan privasi') : tr('Read the privacy policy', 'Baca kebijakan privasi')}
          </button>
        </div>
        {policy && <div style={{ margin: '0 -20px' }}><PrivacyText /></div>}
        <div className={p} style={{ lineHeight: 1.5 }}>
          {tr("If you don't approve, nothing is stored. The app keeps working on their phone only.", 'Kalau Anda tidak setuju, tidak ada yang disimpan. Aplikasi tetap bekerja di HP mereka saja.')}
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => decide('approve')}>{tr('Approve', 'Setujui')}</button>
        <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => decide('decline')}>{tr("Don't approve", 'Jangan setujui')}</button>
      </>}
      {view.kind === 'done' && <>
        <div style={title}>{view.approved ? tr('Approved', 'Disetujui') : tr('Not approved', 'Tidak disetujui')}</div>
        <div className={p} style={{ lineHeight: 1.5 }}>
          {view.approved
            ? tr(`Thanks. ${view.childEmail}'s data starts syncing the next time they open Pocket Sense.`, `Terima kasih. Data ${view.childEmail} mulai tersinkron saat mereka membuka Pocket Sense lagi.`)
            : tr(`Nothing was stored. ${view.childEmail} can keep using Pocket Sense on their phone.`, `Tidak ada yang disimpan. ${view.childEmail} tetap bisa memakai Pocket Sense di HP mereka.`)}
        </div>
        <div className="t14 muted">{tr('You can close this page.', 'Anda bisa menutup halaman ini.')}</div>
        <div className="grow" />
        <button className="btn btn-secondary btn-md" onClick={onClose}>{tr('Open Pocket Sense', 'Buka Pocket Sense')}</button>
      </>}
    </div>
  );
}
