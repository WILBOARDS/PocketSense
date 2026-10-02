// Account screens: Settings, sign in / create account, password reset, parent approval request,
// the first copy to the account, restore, delete and the privacy policy.
import { useState, type ReactNode } from 'react';
import { BackBar } from '../components/common';
import { ChevronRight } from '../components/icons';
import { formatDay, useAccount } from '../lib/account';
import { THRESHOLDS } from '../lib/constants';
import { addDays, shortDate } from '../lib/dates';
import { amountText, money0, parseAmount, typeAmount } from '../lib/format';
import { tr } from '../lib/i18n';
import { useData, useStore } from '../lib/store';
import { isEmail, maskEmail } from '../lib/sync';
import type { Currency } from '../lib/types';
import { useUi } from '../ui';
import { LangSwitch } from './Onboarding';

const THIS_YEAR = new Date().getFullYear();

function Section({ children }: { children: ReactNode }) {
  return <div className="t16 w8" style={{ padding: '20px 20px 12px' }}>{children}</div>;
}

function ListButton({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button className={danger ? 'list-btn danger' : 'list-btn'} onClick={onClick}>
      {children}<ChevronRight />
    </button>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return msg ? <div role="alert" className="t14 w6 accent-text">{msg}</div> : null;
}

/** A plain full-height page with a small label and a rule on top, used by the flow screens. */
function FlowPage({ label, accent, children }: { label: ReactNode; accent?: boolean; children: ReactNode }) {
  return (
    <div className="screen-fill" style={{ padding: '16px 20px 24px', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }} className={accent ? 't13 w6 accent-text' : 't18 w8'}>{label}</div>
      <div className="rule" />
      {children}
    </div>
  );
}

const flowTitle = { fontSize: 32, fontWeight: 800, lineHeight: 1.05, paddingTop: 16, textWrap: 'pretty' } as const;
const body15 = 't15 pretty';

// ─── Settings ─────────────────────────────────────────────────────────────────

export function Settings({ onSignOut }: { onSignOut: () => void }) {
  const acc = useAccount();
  const { data, actions } = useData();
  const { go, toast } = useUi();
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<'week' | 'cooldown' | 'currency' | null>(null);
  const [weekStr, setWeekStr] = useState('');
  const s = data.settings;
  const currency = s.currency ?? 'USD';

  const resend = async () => {
    setSending(true);
    const err = await acc.requestConsent();
    setSending(false);
    toast(err ?? tr(`Sent again to ${acc.profile?.parent_email}.`, `Dikirim lagi ke ${acc.profile?.parent_email}.`));
  };
  const toggle = (k: typeof editing) => {
    setEditing(editing === k ? null : k);
    if (k === 'week') setWeekStr(amountText(s.weekMoney));
  };
  const saveWeek = () => {
    const n = parseAmount(weekStr);
    if (n <= 0) return;
    actions.setPrefs({ weekMoney: n });
    setEditing(null);
    toast(tr('Weekly money updated.', 'Uang mingguan diperbarui.'));
  };

  return (
    <div className="screen">
      <BackBar title={tr('Settings', 'Pengaturan')} onBack={() => go('home')} />
      <Section>{tr('Preferences', 'Preferensi')}</Section>
      <div className="kv-row" style={{ alignItems: 'center', padding: '10px 20px' }}>
        <span className="muted">{tr('Language', 'Bahasa')}</span>
        <div style={{ justifySelf: 'end' }}><LangSwitch /></div>
      </div>
      <PrefRow label={tr('Weekly money', 'Uang mingguan')} value={money0(s.weekMoney)} open={editing === 'week'} onClick={() => toggle('week')} />
      {editing === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, padding: '0 20px 14px' }}>
          <input className="input input-lg" inputMode="decimal" aria-label={tr('Weekly money', 'Uang mingguan')} autoFocus value={weekStr}
            onChange={e => setWeekStr(typeAmount(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') saveWeek(); }} />
          <button className="btn btn-primary" style={{ minHeight: 48, padding: '0 16px' }} disabled={parseAmount(weekStr) <= 0} onClick={saveWeek}>{tr('Save', 'Simpan')}</button>
        </div>
      )}
      <PrefRow label={tr('Cooldown line', 'Batas jeda')} value={tr(`${s.threshold}% of your week`, `${s.threshold}% dari jatah minggu`)}
        open={editing === 'cooldown'} onClick={() => toggle('cooldown')} />
      {editing === 'cooldown' && (
        <div style={{ padding: '0 20px 14px' }}>
          <div role="radiogroup" aria-label={tr('Cooldown line', 'Batas jeda')} className="seg-grid">
            {THRESHOLDS.map(t => (
              <button key={t} role="radio" aria-checked={s.threshold === t} onClick={() => { actions.setPrefs({ threshold: t }); setEditing(null); }}>{t}%</button>
            ))}
          </div>
        </div>
      )}
      <PrefRow label={tr('Currency', 'Mata uang')} value={currency === 'IDR' ? 'Rupiah (Rp)' : tr('Dollar ($)', 'Dolar ($)')}
        open={editing === 'currency'} onClick={() => toggle('currency')} />
      {editing === 'currency' && (
        <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="radiogroup" aria-label={tr('Currency', 'Mata uang')} className="seg-grid">
            {(['IDR', 'USD'] as Currency[]).map(c => (
              <button key={c} role="radio" aria-checked={currency === c} onClick={() => { actions.setPrefs({ currency: c }); setEditing(null); }}>
                {c === 'IDR' ? 'Rupiah (Rp)' : tr('Dollar ($)', 'Dolar ($)')}
              </button>
            ))}
          </div>
          <div className="t13 muted pretty" style={{ lineHeight: 1.45 }}>
            {tr("This changes the symbol only. Amounts you've already logged aren't converted.", 'Ini hanya mengganti simbolnya. Jumlah yang sudah kamu catat tidak dikonversi.')}
          </div>
        </div>
      )}
      <div className="t13 muted pretty" style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--color-neutral-300)', lineHeight: 1.45 }}>
        {acc.enabled
          ? tr('These follow you to your PC, along with your goal, cooldown timers and the labels learned from look-backs.',
            'Ini ikut ke PC kamu, bersama target, timer jeda, dan label yang dipelajari dari tinjauan ulang.')
          : tr('Saved on this phone.', 'Disimpan di HP ini.')}
      </div>
      <div className="rule" />

      <div className="t16 w8" style={{ padding: '20px 20px 8px' }}>{tr('Privacy', 'Privasi')}</div>
      <div className="t14 muted pretty" style={{ padding: '0 20px 12px', lineHeight: 1.5 }}>
        {acc.enabled
          ? tr('With an account, purchases and mood tags are stored on our server so they sync. The person who runs Pocket Sense can technically see them.',
            'Dengan akun, pembelian dan tag mood disimpan di server kami supaya sinkron. Pengelola Pocket Sense secara teknis bisa melihatnya.')
          : tr('Everything stays on this phone.', 'Semua data tetap di HP ini.')}
      </div>
      <ListButton onClick={() => go('privacy')}>{tr('Privacy policy', 'Kebijakan privasi')}</ListButton>
      {acc.enabled && acc.status !== 'out' && <ListButton danger onClick={() => go('delete')}>{tr('Delete account', 'Hapus akun')}</ListButton>}
      <div style={{ borderTop: '1px solid var(--color-neutral-300)' }} />

      {acc.enabled && <>
        <div className="rule" style={{ marginTop: 8 }} />
        <Section>{tr('Account', 'Akun')}</Section>
        {acc.status === 'out' && (
          <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={body15} style={{ lineHeight: 1.5 }}>
              {acc.local.deletionAt
                ? tr(`Your account will be deleted on ${formatDay(acc.local.deletionAt)}. Sign in before then to keep it.`,
                  `Akunmu akan dihapus pada ${formatDay(acc.local.deletionAt)}. Masuk sebelum itu untuk menyimpannya.`)
                : tr('Optional. Sign in only if you want Pocket Sense on your PC too. Without an account, everything stays on this phone.',
                  'Opsional. Masuk hanya kalau kamu mau pakai Pocket Sense di PC juga. Tanpa akun, semua data tetap di HP ini.')}
            </div>
            <button className="btn btn-primary btn-md self-start" onClick={() => go('signin')}>{tr('Sign in or create account', 'Masuk atau buat akun')}</button>
          </div>
        )}
        {acc.status === 'pendingConsent' && (
          <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="t15 w6" style={{ overflowWrap: 'anywhere' }}>{maskEmail(acc.email)}</div>
            <div className="t14 pretty" style={{ lineHeight: 1.5 }}>
              {tr('Waiting for a parent to approve. Your data stays on this phone until then.', 'Menunggu persetujuan orang tua. Sampai saat itu datamu tetap di HP ini.')}
            </div>
            <div className="t13 muted" style={{ overflowWrap: 'anywhere' }}>{tr('Request sent to', 'Permintaan dikirim ke')} {acc.profile?.parent_email}</div>
            <button className="btn btn-ghost btn-link" disabled={sending} onClick={resend}>{tr('Resend request', 'Kirim ulang permintaan')}</button>
          </div>
        )}
        {acc.status === 'in' && <>
          <div className="kv-row">
            <span className="muted">{tr('Signed in as', 'Masuk sebagai')}</span>
            <span className="w6" style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{maskEmail(acc.email)}</span>
          </div>
          <div className="kv-row">
            <span className="muted">{tr('Sync', 'Sinkron')}</span>
            <span className="w6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, color: acc.sync.fg }}>
              <span className="sync-dot" style={{ width: 10, height: 10, background: acc.sync.dot }} />{acc.sync.label}
            </span>
          </div>
          <div style={{ padding: '16px 20px 24px', borderTop: '1px solid var(--color-neutral-300)' }}>
            <button className="danger-btn" onClick={onSignOut}>{tr('Sign out', 'Keluar')}</button>
          </div>
        </>}
      </>}
      <div style={{ height: 24 }} />
    </div>
  );
}

function PrefRow({ label, value, open, onClick }: { label: string; value: string; open: boolean; onClick: () => void }) {
  return (
    <button className="kv-row pref-row" aria-expanded={open} onClick={onClick}>
      <span className="muted">{label}</span>
      <span className="w6" style={{ textAlign: 'right' }}>{value}</span>
    </button>
  );
}

// ─── Sign in / create account ─────────────────────────────────────────────────

export interface AuthForm {
  /** Null until the user picks a tab. */
  mode: 'signin' | 'signup' | null;
  year: string;
}

export function SignIn({ email, setEmail, form, setForm, onBack }: {
  email: string; setEmail: (v: string) => void; form: AuthForm; setForm: (f: AuthForm) => void; onBack: () => void;
}) {
  const acc = useAccount();
  const { go } = useUi();
  const mode = form.mode ?? (acc.finishing ? 'signup' : 'signin');
  const yearStr = form.year;
  const setYearStr = (year: string) => setForm({ mode, year });
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const finishing = acc.finishing;
  const signup = mode === 'signup' || finishing;

  /** Checks the Create account extras. Returns the birth year, or null after showing an error. */
  const checkSignup = (): number | null => {
    const y = parseInt(yearStr, 10);
    if (!(y > 1900 && y <= THIS_YEAR)) { setError(tr('Enter the year you were born.', 'Isi tahun lahirmu.')); return null; }
    if (!agreed) { setError(tr('Tick the box to agree to the privacy policy.', 'Centang kotaknya untuk menyetujui kebijakan privasi.')); return null; }
    return y;
  };

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  const submitEmail = () => {
    if (finishing) {
      const y = checkSignup();
      if (y) void run(() => acc.finishProfile(y));
      return;
    }
    if (!isEmail(email)) return setError(tr('Enter a valid email address.', 'Isi alamat email yang benar.'));
    if (password.length < 8) return setError(tr('Password needs at least 8 characters.', 'Kata sandi minimal 8 karakter.'));
    if (mode === 'signin') return void run(() => acc.signIn(email, password));
    const y = checkSignup();
    if (y) void run(() => acc.signUp(email, password, y));
  };

  const submitGoogle = () => {
    if (mode === 'signin') return void run(() => acc.google(null));
    const y = checkSignup();
    if (y) void run(() => acc.google(y));
  };

  const back = () => { if (finishing) void acc.cancelSignIn(); onBack(); };
  const pick = (m: 'signin' | 'signup') => { setForm({ mode: m, year: yearStr }); setError(''); };

  return (
    <div className="screen">
      <BackBar title={tr('Account', 'Akun')} onBack={back} />
      <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {finishing ? (
          <div className="t15 pretty" style={{ lineHeight: 1.5 }}>{tr('One more step to finish creating your account.', 'Satu langkah lagi untuk menyelesaikan akunmu.')}</div>
        ) : <>
          <div className="t14 muted pretty" style={{ lineHeight: 1.45 }}>
            {tr('Optional. Sign in only if you want Pocket Sense on your PC too. Without an account, everything stays on this phone.',
              'Opsional. Masuk hanya kalau kamu mau pakai Pocket Sense di PC juga. Tanpa akun, semua data tetap di HP ini.')}
          </div>
          <div role="radiogroup" aria-label={tr('Sign in or create account', 'Masuk atau buat akun')} className="seg-grid">
            <button role="radio" aria-checked={mode === 'signin'} onClick={() => pick('signin')}>{tr('Sign in', 'Masuk')}</button>
            <button role="radio" aria-checked={mode === 'signup'} onClick={() => pick('signup')}>{tr('Create account', 'Buat akun')}</button>
          </div>
          <button className="btn btn-secondary btn-lg" style={{ borderWidth: 2 }} disabled={busy} onClick={submitGoogle}>{tr('Continue with Google', 'Lanjut dengan Google')}</button>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 12 }} className="t13 muted">
            <div style={{ height: 1, background: 'var(--color-divider)' }} /><span>{tr('or with email', 'atau dengan email')}</span><div style={{ height: 1, background: 'var(--color-divider)' }} />
          </div>
          <div className="field">
            <label htmlFor="au-email">Email</label>
            <input id="au-email" className="input input-lg" type="email" autoComplete="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }} />
          </div>
          <div className="field">
            <label htmlFor="au-pass">{tr('Password', 'Kata sandi')}</label>
            <input id="au-pass" className="input input-lg" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
          </div>
        </>}
        {signup && <>
          <div className="field">
            <label htmlFor="au-year">{tr('Birth year', 'Tahun lahir')}</label>
            <input id="au-year" className="input input-lg" inputMode="numeric" maxLength={4} placeholder="2008" value={yearStr}
              onChange={e => { setYearStr(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </div>
          <div className="t13 muted" style={{ lineHeight: 1.45, marginTop: -6 }}>
            {tr("Under 18? We'll ask a parent to approve before anything syncs.", 'Di bawah 18 tahun? Kami minta persetujuan orang tua sebelum data disinkronkan.')}
          </div>
          {/* The link is a sibling of the checkbox, not inside it, so opening the policy doesn't tick the box. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <button className="check" aria-pressed={agreed} aria-label={tr('I agree to the privacy policy', 'Aku setuju dengan kebijakan privasi')}
              onClick={() => { setAgreed(!agreed); setError(''); }} style={{ minHeight: 48 }}>
              <span className="check-box" />
            </button>
            <span className="t15" style={{ lineHeight: 1.4 }}>
              {tr("By ticking this, you're agreeing to our ", 'Dengan mencentang ini, kamu menyetujui ')}
              <a href="#privacy" className="w6" onClick={e => { e.preventDefault(); go('privacy'); }}>{tr('privacy policy', 'kebijakan privasi')}</a>
              {tr('.', ' kami.')}
            </span>
          </div>
        </>}
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={submitEmail}>
          {finishing ? tr('Finish', 'Selesai') : mode === 'signin' ? tr('Sign in', 'Masuk') : tr('Create account', 'Buat akun')}
        </button>
        {mode === 'signin' && !finishing && (
          <button className="btn btn-ghost btn-link" onClick={() => go('forgot')}>{tr('Forgot password?', 'Lupa kata sandi?')}</button>
        )}
      </div>
    </div>
  );
}

// ─── Password reset ───────────────────────────────────────────────────────────

export function Forgot({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  const acc = useAccount();
  const { go, toast } = useUi();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (again: boolean) => {
    if (!isEmail(email)) return setError(tr('Enter a valid email address.', 'Isi alamat email yang benar.'));
    setBusy(true);
    const err = await acc.sendReset(email);
    setBusy(false);
    if (err) return again ? toast(err) : setError(err);
    setError('');
    if (again) toast(tr(`Sent again to ${email.trim()}.`, `Dikirim lagi ke ${email.trim()}.`));
    setSent(true);
  };

  return (
    <div className="screen-fill">
      <BackBar title={tr('Reset password', 'Atur ulang kata sandi')} onBack={() => go('signin')} />
      {!sent ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="t15" style={{ lineHeight: 1.5 }}>{tr("We'll email you a link to set a new password.", 'Kami akan mengirim link ke emailmu untuk membuat kata sandi baru.')}</div>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input id="fp-email" className="input input-lg" type="email" autoComplete="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }} />
          </div>
          <ErrorLine msg={error} />
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => send(false)}>{tr('Send reset link', 'Kirim link')}</button>
        </div>
      ) : (
        <CheckEmail body={tr(`We sent a reset link to ${email.trim()}. It works for 1 hour.`, `Kami mengirim link ke ${email.trim()}. Berlaku 1 jam.`)}>
          <button className="btn btn-primary btn-md" onClick={() => go('signin')}>{tr('Back to sign in', 'Kembali ke halaman masuk')}</button>
          <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => send(true)}>{tr('Send it again', 'Kirim lagi')}</button>
        </CheckEmail>
      )}
    </div>
  );
}

function CheckEmail({ body, children }: { body: string; children: ReactNode }) {
  return (
    <div style={{ padding: '40px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>{tr('Check your email', 'Cek emailmu')}</div>
      <div className="t15 pretty" style={{ lineHeight: 1.5 }}>{body}</div>
      <div className="t14 muted">{tr('Not there? Check your spam folder.', 'Tidak ada? Cek folder spam.')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

/** After Create account when the project asks people to confirm their email first. */
export function Verify({ email }: { email: string }) {
  const { go } = useUi();
  return (
    <div className="screen-fill">
      <BackBar title={tr('Account', 'Akun')} onBack={() => go('signin')} />
      <CheckEmail body={tr(`We sent a link to ${email.trim()}. Open it on this phone to finish creating your account.`,
        `Kami mengirim link ke ${email.trim()}. Buka di HP ini untuk menyelesaikan akunmu.`)}>
        <button className="btn btn-primary btn-md" onClick={() => go('signin')}>{tr('Back to sign in', 'Kembali ke halaman masuk')}</button>
      </CheckEmail>
    </div>
  );
}

/** Opened from the reset link in the email. */
export function NewPassword() {
  const acc = useAccount();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (password.length < 8) return setError(tr('Password needs at least 8 characters.', 'Kata sandi minimal 8 karakter.'));
    setBusy(true);
    const err = await acc.setNewPassword(password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="screen-fill">
      <BackBar title={tr('Reset password', 'Atur ulang kata sandi')} onBack={() => void acc.cancelSignIn()} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="t15" style={{ lineHeight: 1.5 }}>{tr(`Choose a new password for ${acc.email}.`, `Pilih kata sandi baru untuk ${acc.email}.`)}</div>
        <div className="field">
          <label htmlFor="np-pass">{tr('New password', 'Kata sandi baru')}</label>
          <input id="np-pass" className="input input-lg" type="password" autoComplete="new-password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }} />
        </div>
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={save}>{tr('Save password', 'Simpan kata sandi')}</button>
      </div>
    </div>
  );
}

// ─── Parent approval request ──────────────────────────────────────────────────

export function Consent() {
  const acc = useAccount();
  const { go } = useUi();
  const [parentEmail, setParentEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!isEmail(parentEmail)) return setError(tr("Enter your parent or guardian's email.", 'Isi email orang tua atau walimu.'));
    if (parentEmail.trim().toLowerCase() === (acc.email ?? '').toLowerCase()) return setError(tr('Use a different email from your own.', 'Pakai email yang beda dari emailmu.'));
    setBusy(true);
    const err = await acc.requestConsent(parentEmail);
    setBusy(false);
    if (err) return setError(err);
    setSent(true);
  };

  return (
    <FlowPage label={tr('Parent approval', 'Persetujuan orang tua')} accent>
      {!sent ? <>
        <div style={flowTitle}>{tr('Ask a parent to approve', 'Minta persetujuan orang tua')}</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>
          {tr("You're under 18, so a parent or guardian needs to agree before your data is stored on our server.", 'Kamu di bawah 18 tahun, jadi orang tua atau wali perlu setuju dulu sebelum datamu disimpan di server kami.')}
        </div>
        <div className={body15} style={{ lineHeight: 1.5 }}>{tr('Until then, Pocket Sense works as normal on this phone.', 'Sampai saat itu, Pocket Sense tetap jalan seperti biasa di HP ini.')}</div>
        <div className="field">
          <label htmlFor="pc-email">{tr("Parent or guardian's email", 'Email orang tua atau wali')}</label>
          <input id="pc-email" className="input input-lg" type="email" value={parentEmail}
            onChange={e => { setParentEmail(e.target.value); setError(''); }} />
        </div>
        <ErrorLine msg={error} />
        <div className="grow" />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}>{tr('Send request', 'Kirim permintaan')}</button>
        <button className="btn btn-ghost btn-link" onClick={() => void acc.skipConsent()}>{tr('Not now, keep it on this phone', 'Nanti saja, simpan di HP ini')}</button>
      </> : <>
        <div style={flowTitle}>{tr('Request sent', 'Permintaan terkirim')}</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>
          {tr(`We emailed ${parentEmail.trim()} what we store and a button to approve. Sync starts as soon as they do.`,
            `Kami mengirim email ke ${parentEmail.trim()} berisi data apa yang disimpan dan tombol untuk menyetujui. Sinkron mulai begitu mereka setuju.`)}
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => go('home')}>{tr('Back to home', 'Kembali ke beranda')}</button>
      </>}
    </FlowPage>
  );
}

// ─── First copy to (or from) the account ──────────────────────────────────────

export function Upload() {
  const acc = useAccount();
  const { data } = useStore();
  const { go } = useUi();
  const link = acc.link ?? { progress: 0, dir: 'up' as const, done: false, error: null };
  const down = link.dir === 'down';
  const purchases = data?.purchases ?? [];
  const items: [string, string | number][] = [
    [tr('Purchases', 'Pembelian'), purchases.length],
    [tr('Mood tags', 'Tag mood'), purchases.filter(p => p.mood).length],
    [tr('Parked items', 'Barang diparkir'), data?.parking.length ?? 0],
    [tr('Goal', 'Target'), data?.goal?.name ?? tr('None', 'Tidak ada')],
    [tr('Settings and learned labels', 'Pengaturan dan label yang dipelajari'), tr('All', 'Semua')],
  ];
  const title = link.error ? tr("Couldn't finish", 'Tidak bisa selesai')
    : link.done ? (down ? tr('Your data is back', 'Datamu sudah kembali') : tr('All copied', 'Semua tersalin'))
    : down ? tr('Getting your data', 'Mengambil datamu') : tr('Copying this phone to your account', 'Menyalin HP ini ke akunmu');
  const text = link.error ?? (link.done
    ? tr(`Sign in on your PC with ${acc.email} to see the same numbers.`, `Masuk di PC dengan ${acc.email} untuk melihat angka yang sama.`)
    : down ? tr('Downloading everything saved in your account.', 'Mengunduh semua yang tersimpan di akunmu.')
    : tr('Everything already on this phone goes into your account, so nothing starts from zero.', 'Semua yang sudah ada di HP ini masuk ke akunmu, jadi tidak mulai dari nol.'));

  return (
    <FlowPage label="Pocket Sense">
      <div style={{ ...flowTitle, paddingTop: 24 }}>{title}</div>
      <div className={body15} style={{ lineHeight: 1.5 }} role={link.error ? 'alert' : undefined}>{text}</div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={link.progress} className="bar" style={{ marginTop: 8 }}>
        <span style={{ width: `${link.progress}%` }} />
      </div>
      <div className="stack">
        {items.map(([label, val], i) => {
          const done = link.progress >= (i + 1) * 20;
          return (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-neutral-300)' }} className="t15">
              <span>{label}</span>
              <span className="w6" style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{val}</span>
              <span className={done ? 't12 w6' : 't12 w6 muted'} style={{ width: 40, textAlign: 'right' }}>{done ? tr('Done', 'Selesai') : '…'}</span>
            </div>
          );
        })}
      </div>
      <div className="grow" />
      {link.done && <button className="btn btn-primary btn-lg" onClick={() => go('home')}>{tr('Back to home', 'Kembali ke beranda')}</button>}
      {link.error && <>
        <button className="btn btn-primary btn-lg" onClick={acc.retryLink}>{tr('Try again', 'Coba lagi')}</button>
        <button className="btn btn-secondary btn-md" onClick={() => { void acc.cancelSignIn(); go('home'); }}>{tr('Not now', 'Nanti saja')}</button>
      </>}
      {!link.done && !link.error && <div className="t13 muted">{tr('Keep the app open until this finishes.', 'Biarkan aplikasi terbuka sampai selesai.')}</div>}
    </FlowPage>
  );
}

// ─── Restore / delete ─────────────────────────────────────────────────────────

export function Restore() {
  const acc = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const at = formatDay(acc.profile?.deletion_at ?? null);

  const restore = async () => {
    setBusy(true);
    const err = await acc.restore();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <FlowPage label={tr(`Deletion scheduled · ${at}`, `Penghapusan dijadwalkan · ${at}`)} accent>
      <div style={flowTitle}>{tr('Keep your account?', 'Simpan akunmu?')}</div>
      <div className={body15} style={{ lineHeight: 1.5 }}>
        {tr(`You asked to delete it. It will be erased on ${at} unless you restore it now.`, `Kamu meminta akun ini dihapus. Akun akan dihapus pada ${at} kecuali kamu memulihkannya sekarang.`)}
      </div>
      <div className={body15} style={{ lineHeight: 1.5 }}>
        {tr('Restoring brings back everything that was synced: purchases, mood tags, goal and look-backs.', 'Memulihkan akan mengembalikan semua yang sudah tersinkron: pembelian, tag mood, target, dan tinjauan.')}
      </div>
      <ErrorLine msg={error} />
      <div className="grow" />
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={restore}>{tr('Restore my account', 'Pulihkan akunku')}</button>
      <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => void acc.keepDeletion()}>{tr('Keep the deletion', 'Tetap hapus')}</button>
    </FlowPage>
  );
}

export function DeleteAccount() {
  const acc = useAccount();
  const { go, now } = useUi();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const word = tr('DELETE', 'HAPUS');
  const ok = text.trim().toUpperCase() === word;

  const confirm = async () => {
    if (!ok) return;
    setBusy(true);
    const err = await acc.deleteAccount();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="screen">
      <BackBar title={tr('Delete account', 'Hapus akun')} onBack={() => go('settings')} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>{tr('Delete your account?', 'Hapus akunmu?')}</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>
          {tr('This deletes your account and everything synced to it: purchases, mood tags, goal, parking lot and look-backs. This phone is cleared too.',
            'Ini menghapus akunmu dan semua yang tersinkron: pembelian, tag mood, target, parkiran, dan tinjauan. HP ini juga dikosongkan.')}
        </div>
        <div className="surface" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="t15 w6">{tr('You have 7 days to change your mind', 'Kamu punya 7 hari untuk berubah pikiran')}</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>
            {tr(`Sign in before ${shortDate(addDays(now, 7))}, or use the link we email you, and nothing is lost. After that it's gone for good.`,
              `Masuk sebelum ${shortDate(addDays(now, 7))}, atau pakai link yang kami kirim lewat email, dan tidak ada yang hilang. Setelah itu, semuanya hilang permanen.`)}
          </div>
        </div>
        <div className="field">
          <label htmlFor="del-confirm">{tr('Type DELETE to confirm', 'Ketik HAPUS untuk konfirmasi')}</label>
          <input id="del-confirm" className="input input-lg" autoCapitalize="characters" autoComplete="off" value={text}
            onChange={e => { setText(e.target.value); setError(''); }} style={{ letterSpacing: '0.04em' }} />
        </div>
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={!ok || busy} onClick={confirm}>{tr('Delete my account', 'Hapus akunku')}</button>
        <button className="btn btn-secondary btn-md" onClick={() => go('settings')}>{tr('Cancel', 'Batal')}</button>
      </div>
    </div>
  );
}

// ─── Privacy policy ───────────────────────────────────────────────────────────

// Fill these in before publishing the app.
const POLICY_UPDATED = '[date]';
const CONTACT_EMAIL = '[contact email]';

export function PrivacyText() {
  const parts: [string, string][] = [
    [tr('1. Who we are', '1. Siapa kami'), tr(
      `Pocket Sense is a spending-awareness app. In this policy, "we" means the person who runs it. Contact: ${CONTACT_EMAIL}.`,
      `Pocket Sense adalah aplikasi untuk lebih sadar soal pengeluaran. Dalam kebijakan ini, "kami" berarti orang yang mengelolanya. Kontak: ${CONTACT_EMAIL}.`)],
    [tr('2. What we collect', '2. Apa yang kami kumpulkan'), tr(
      'Without an account, everything stays on your phone and we collect nothing. With an account, we store your email address and birth year; your purchases (amount, category, wallet and time); any mood tags you add; your goal, parking lot items and cooldown timers; and your settings, including labels the app has learned from your look-backs.',
      'Tanpa akun, semua data tetap di HP-mu dan kami tidak mengumpulkan apa pun. Dengan akun, kami menyimpan alamat email dan tahun lahirmu; pembelianmu (jumlah, kategori, dompet, dan waktu); tag mood yang kamu tambahkan; target, barang di parkiran, dan timer jeda; serta pengaturanmu, termasuk label yang dipelajari aplikasi dari tinjauanmu.')],
    [tr('3. Why we collect it', '3. Kenapa kami mengumpulkannya'), tr(
      "Only to keep your data the same across your devices and to run the app's features. We don't use it for advertising and we don't sell it.",
      'Hanya supaya datamu sama di semua perangkatmu dan untuk menjalankan fitur aplikasi. Kami tidak memakainya untuk iklan dan tidak menjualnya.')],
    [tr("4. Where it's stored", '4. Di mana data disimpan'), tr(
      'On servers run by Supabase, our database provider. Password-reset and parent-approval emails are sent through Resend, which receives only the email address and the message.',
      'Di server milik Supabase, penyedia database kami. Email atur ulang kata sandi dan persetujuan orang tua dikirim lewat Resend, yang hanya menerima alamat email dan isi pesannya.')],
    [tr('5. Ask (AI answers)', '5. Tanya (jawaban AI)'), tr(
      "Ask is optional and needs an account. When you send a question, it goes with a short summary of what you logged (this week's money, recent purchases with their categories and mood tags, your goal and parked items) to OpenRouter, which passes it to an AI model to write the answer. Your email and birth year are not sent. We don't keep your questions or the answers; we only count how many you ask each day, to keep within limits.",
      'Fitur Tanya bersifat opsional dan butuh akun. Saat kamu mengirim pertanyaan, pertanyaan itu dikirim bersama ringkasan singkat dari yang kamu catat (uang minggu ini, pembelian terakhir beserta kategori dan tag mood, target, dan barang yang diparkir) ke OpenRouter, yang meneruskannya ke model AI untuk menulis jawaban. Email dan tahun lahirmu tidak dikirim. Kami tidak menyimpan pertanyaan atau jawabanmu; kami hanya menghitung berapa banyak yang kamu tanyakan tiap hari, supaya tetap dalam batas.')],
    [tr('6. Who can see it', '6. Siapa yang bisa melihatnya'), tr(
      'Your account is protected by your password or Google sign-in. The person who runs Pocket Sense can technically view your data in the database, and will only do so to fix a problem you report.',
      'Akunmu dilindungi kata sandi atau login Google. Pengelola Pocket Sense secara teknis bisa melihat datamu di database, dan hanya akan melakukannya untuk memperbaiki masalah yang kamu laporkan.')],
    [tr('7. Users under 18', '7. Pengguna di bawah 18 tahun'), tr(
      "If you're under 18, a parent or guardian must approve before your data is stored on our server or sent to Ask, in line with Indonesia's Personal Data Protection Law (UU PDP No. 27/2022). Until then, the app works on your phone only.",
      'Kalau kamu di bawah 18 tahun, orang tua atau wali harus menyetujui dulu sebelum datamu disimpan di server kami atau dikirim ke fitur Tanya, sesuai UU Pelindungan Data Pribadi (UU PDP No. 27/2022). Sampai saat itu, aplikasi hanya bekerja di HP-mu.')],
    [tr('8. Signing out and deleting', '8. Keluar dan menghapus akun'), tr(
      'Signing out clears your data from that phone; it stays in your account. You can delete your account in Settings. Deletion takes effect after 7 days, and signing in before then cancels it. After 7 days, your account and all synced data are permanently erased.',
      'Keluar akan menghapus datamu dari HP itu; datanya tetap ada di akunmu. Kamu bisa menghapus akun di Pengaturan. Penghapusan berlaku setelah 7 hari, dan masuk sebelum itu akan membatalkannya. Setelah 7 hari, akun dan semua data yang tersinkron dihapus permanen.')],
    [tr('9. Changes', '9. Perubahan'), tr(
      "If this policy changes, we'll tell you in the app before the change applies.",
      'Kalau kebijakan ini berubah, kami akan memberi tahu di aplikasi sebelum perubahannya berlaku.')],
  ];
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15, lineHeight: 1.55 }}>
      <div className="t13 muted">{tr('Last updated', 'Terakhir diperbarui')} {POLICY_UPDATED}</div>
      {parts.map(([h, p]) => (
        <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{h}</div>
          <div className="pretty">{p}</div>
        </div>
      ))}
    </div>
  );
}

export function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <BackBar title={tr('Privacy policy', 'Kebijakan privasi')} onBack={onBack} />
      <PrivacyText />
    </div>
  );
}
