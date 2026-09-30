// Account screens: Settings, sign in / create account, password reset, parent approval request,
// the first copy to the account, restore, delete and the privacy policy.
import { useState, type ReactNode } from 'react';
import { BackBar } from '../components/common';
import { ChevronRight } from '../components/icons';
import { formatDay, useAccount } from '../lib/account';
import { addDays, shortDate } from '../lib/dates';
import { useStore } from '../lib/store';
import { isEmail } from '../lib/sync';
import { useUi } from '../ui';

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
  const { go, toast } = useUi();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    const err = await acc.requestConsent();
    setSending(false);
    toast(err ?? `Sent again to ${acc.profile?.parent_email}.`);
  };

  return (
    <div className="screen">
      <BackBar title="Settings" onBack={() => go('home')} />
      <Section>Account</Section>
      {acc.status === 'out' && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className={body15} style={{ lineHeight: 1.5 }}>
            {acc.local.deletionAt
              ? `Your account will be deleted on ${formatDay(acc.local.deletionAt)}. Sign in before then to keep it.`
              : 'Not signed in. Everything is saved on this phone only.'}
          </div>
          <button className="btn btn-primary btn-md self-start" onClick={() => go('signin')}>Sign in or create account</button>
        </div>
      )}
      {acc.status === 'pendingConsent' && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="t15 w6" style={{ overflowWrap: 'anywhere' }}>{acc.email}</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>Waiting for a parent to approve. Your data stays on this phone until then.</div>
          <div className="t13 muted" style={{ overflowWrap: 'anywhere' }}>Request sent to {acc.profile?.parent_email}</div>
          <button className="btn btn-ghost btn-link" disabled={sending} onClick={resend}>Resend request</button>
        </div>
      )}
      {acc.status === 'in' && <>
        <div className="kv-row"><span className="muted">Signed in as</span><span className="w6" style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{acc.email}</span></div>
        <div className="kv-row">
          <span className="muted">Sync</span>
          <span className="w6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, color: acc.sync.fg }}>
            <span className="sync-dot" style={{ background: acc.sync.dot }} />{acc.sync.label}
          </span>
        </div>
        <div style={{ padding: '8px 20px 20px', borderTop: '1px solid var(--color-neutral-300)' }}>
          <button className="btn btn-secondary btn-md" style={{ marginTop: 8 }} onClick={onSignOut}>Sign out</button>
        </div>
      </>}
      <div className="rule" />
      <div className="t16 w8" style={{ padding: '20px 20px 8px' }}>Privacy</div>
      <div className="t14 muted pretty" style={{ padding: '0 20px 12px', lineHeight: 1.5 }}>
        With an account, purchases and mood tags are stored on our server so they sync. The person who runs Pocket Sense can technically see them.
      </div>
      <ListButton onClick={() => go('privacy')}>Privacy policy</ListButton>
      {acc.status !== 'out' && <ListButton danger onClick={() => go('delete')}>Delete account</ListButton>}
      <div style={{ height: 24, borderTop: '1px solid var(--color-neutral-300)' }} />
    </div>
  );
}

// ─── Sign in / create account ─────────────────────────────────────────────────

export function SignIn({ email, setEmail, onBack }: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const acc = useAccount();
  const { go } = useUi();
  const [mode, setMode] = useState<'signin' | 'signup'>(acc.finishing ? 'signup' : 'signin');
  const [password, setPassword] = useState('');
  const [yearStr, setYearStr] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const finishing = acc.finishing;
  const signup = mode === 'signup' || finishing;

  /** Checks the Create account extras. Returns the birth year, or null after showing an error. */
  const checkSignup = (): number | null => {
    const y = parseInt(yearStr, 10);
    if (!(y > 1900 && y <= THIS_YEAR)) { setError('Enter the year you were born.'); return null; }
    if (!agreed) { setError('Tick the box to confirm you understand how your data is stored.'); return null; }
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
    if (!isEmail(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password needs at least 8 characters.');
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
  const pick = (m: 'signin' | 'signup') => { setMode(m); setError(''); };

  return (
    <div className="screen">
      <BackBar title="Account" onBack={back} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {finishing ? (
          <div className="t15 pretty" style={{ lineHeight: 1.5 }}>One more step to finish creating your account.</div>
        ) : <>
          <div role="radiogroup" aria-label="Sign in or create account" className="seg-grid">
            <button role="radio" aria-checked={mode === 'signin'} onClick={() => pick('signin')}>Sign in</button>
            <button role="radio" aria-checked={mode === 'signup'} onClick={() => pick('signup')}>Create account</button>
          </div>
          <button className="btn btn-secondary btn-lg" style={{ borderWidth: 2 }} disabled={busy} onClick={submitGoogle}>Continue with Google</button>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 12 }} className="t13 muted">
            <div style={{ height: 1, background: 'var(--color-divider)' }} /><span>or with email</span><div style={{ height: 1, background: 'var(--color-divider)' }} />
          </div>
          <div className="field">
            <label htmlFor="au-email">Email</label>
            <input id="au-email" className="input input-lg" type="email" autoComplete="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }} />
          </div>
          <div className="field">
            <label htmlFor="au-pass">Password</label>
            <input id="au-pass" className="input input-lg" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
          </div>
        </>}
        {signup && <>
          <div className="field">
            <label htmlFor="au-year">Birth year</label>
            <input id="au-year" className="input input-lg" inputMode="numeric" maxLength={4} placeholder="2007" value={yearStr}
              onChange={e => { setYearStr(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </div>
          <div className="t13 muted" style={{ lineHeight: 1.45, marginTop: -8 }}>Under 18? We'll ask a parent to approve before anything syncs.</div>
          <div className="surface" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="t15 w6">What gets stored</div>
            <div className="t14 pretty" style={{ lineHeight: 1.5 }}>Your purchases and mood tags are stored on our server so they sync between your phone and PC.</div>
            <div className="t14 pretty" style={{ lineHeight: 1.5 }}>The person who runs Pocket Sense can technically see this data in the database.</div>
            <button className="btn btn-ghost btn-link" onClick={() => go('privacy')}>Read the privacy policy</button>
          </div>
          <button className="check" aria-pressed={agreed} onClick={() => { setAgreed(!agreed); setError(''); }}>
            <span className="check-box" />I understand how my data is stored
          </button>
        </>}
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={submitEmail}>
          {finishing ? 'Finish' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'signin' && !finishing && (
          <button className="btn btn-ghost btn-link" onClick={() => go('forgot')}>Forgot password?</button>
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
    if (!isEmail(email)) return setError('Enter a valid email address.');
    setBusy(true);
    const err = await acc.sendReset(email);
    setBusy(false);
    if (err) return again ? toast(err) : setError(err);
    setError('');
    if (again) toast(`Sent again to ${email.trim()}.`);
    setSent(true);
  };

  return (
    <div className="screen-fill">
      <BackBar title="Reset password" onBack={() => go('signin')} />
      {!sent ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="t15" style={{ lineHeight: 1.5 }}>We'll email you a link to set a new password.</div>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input id="fp-email" className="input input-lg" type="email" autoComplete="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }} />
          </div>
          <ErrorLine msg={error} />
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => send(false)}>Send reset link</button>
        </div>
      ) : (
        <CheckEmail body={`We sent a reset link to ${email.trim()}. It works for 1 hour.`}>
          <button className="btn btn-primary btn-md" onClick={() => go('signin')}>Back to sign in</button>
          <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => send(true)}>Send it again</button>
        </CheckEmail>
      )}
    </div>
  );
}

function CheckEmail({ body, children }: { body: string; children: ReactNode }) {
  return (
    <div style={{ padding: '40px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>Check your email</div>
      <div className="t15 pretty" style={{ lineHeight: 1.5 }}>{body}</div>
      <div className="t14 muted">Not there? Check your spam folder.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

/** After Create account when the project asks people to confirm their email first. */
export function Verify({ email }: { email: string }) {
  const { go } = useUi();
  return (
    <div className="screen-fill">
      <BackBar title="Account" onBack={() => go('signin')} />
      <CheckEmail body={`We sent a link to ${email.trim()}. Open it on this phone to finish creating your account.`}>
        <button className="btn btn-primary btn-md" onClick={() => go('signin')}>Back to sign in</button>
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
    if (password.length < 8) return setError('Password needs at least 8 characters.');
    setBusy(true);
    const err = await acc.setNewPassword(password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="screen-fill">
      <BackBar title="Reset password" onBack={() => void acc.cancelSignIn()} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="t15" style={{ lineHeight: 1.5 }}>Choose a new password for {acc.email}.</div>
        <div className="field">
          <label htmlFor="np-pass">New password</label>
          <input id="np-pass" className="input input-lg" type="password" autoComplete="new-password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }} />
        </div>
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={save}>Save password</button>
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
    if (!isEmail(parentEmail)) return setError("Enter your parent or guardian's email.");
    if (parentEmail.trim().toLowerCase() === (acc.email ?? '').toLowerCase()) return setError('Use a different email from your own.');
    setBusy(true);
    const err = await acc.requestConsent(parentEmail);
    setBusy(false);
    if (err) return setError(err);
    setSent(true);
  };

  return (
    <FlowPage label="Parent approval" accent>
      {!sent ? <>
        <div style={flowTitle}>Ask a parent to approve</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>You're under 18, so a parent or guardian needs to agree before your data is stored on our server.</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>Until then, Pocket Sense works as normal on this phone.</div>
        <div className="field">
          <label htmlFor="pc-email">Parent or guardian's email</label>
          <input id="pc-email" className="input input-lg" type="email" value={parentEmail}
            onChange={e => { setParentEmail(e.target.value); setError(''); }} />
        </div>
        <ErrorLine msg={error} />
        <div className="grow" />
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}>Send request</button>
        <button className="btn btn-ghost btn-link" onClick={() => void acc.skipConsent()}>Not now, keep it on this phone</button>
      </> : <>
        <div style={flowTitle}>Request sent</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>We emailed {parentEmail.trim()} what we store and a button to approve. Sync starts as soon as they do.</div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={() => go('home')}>Back to home</button>
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
    ['Purchases', purchases.length],
    ['Mood tags', purchases.filter(p => p.mood).length],
    ['Parked items', data?.parking.length ?? 0],
    ['Goal', data?.goal?.name ?? 'None'],
    ['Settings and learned labels', 'All'],
  ];
  const title = link.error ? "Couldn't finish"
    : link.done ? (down ? 'Your data is back' : 'All copied')
    : down ? 'Getting your data' : 'Copying this phone to your account';
  const text = link.error ?? (link.done
    ? `Sign in on your PC with ${acc.email} to see the same numbers.`
    : down ? 'Downloading everything saved in your account.' : 'Everything already on this phone goes into your account, so nothing starts from zero.');

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
              <span className={done ? 't12 w6' : 't12 w6 muted'} style={{ width: 40, textAlign: 'right' }}>{done ? 'Done' : '…'}</span>
            </div>
          );
        })}
      </div>
      <div className="grow" />
      {link.done && <button className="btn btn-primary btn-lg" onClick={() => go('home')}>Back to home</button>}
      {link.error && <>
        <button className="btn btn-primary btn-lg" onClick={acc.retryLink}>Try again</button>
        <button className="btn btn-secondary btn-md" onClick={() => { void acc.cancelSignIn(); go('home'); }}>Not now</button>
      </>}
      {!link.done && !link.error && <div className="t13 muted">Keep the app open until this finishes.</div>}
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
    <FlowPage label={`Deletion scheduled · ${at}`} accent>
      <div style={flowTitle}>Keep your account?</div>
      <div className={body15} style={{ lineHeight: 1.5 }}>You asked to delete it. It will be erased on {at} unless you restore it now.</div>
      <div className={body15} style={{ lineHeight: 1.5 }}>Restoring brings back everything that was synced: purchases, mood tags, goal and look-backs.</div>
      <ErrorLine msg={error} />
      <div className="grow" />
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={restore}>Restore my account</button>
      <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => void acc.keepDeletion()}>Keep the deletion</button>
    </FlowPage>
  );
}

export function DeleteAccount() {
  const acc = useAccount();
  const { go, now } = useUi();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = text.trim() === 'DELETE';

  const confirm = async () => {
    if (!ok) return;
    setBusy(true);
    const err = await acc.deleteAccount();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="screen">
      <BackBar title="Delete account" onBack={() => go('settings')} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>Delete your account?</div>
        <div className={body15} style={{ lineHeight: 1.5 }}>This deletes your account and everything synced to it: purchases, mood tags, goal, parking lot and look-backs. This phone is cleared too.</div>
        <div className="surface" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="t15 w6">You have 7 days to change your mind</div>
          <div className="t14 pretty" style={{ lineHeight: 1.5 }}>Sign in before {shortDate(addDays(now, 7))}, or use the link we email you, and nothing is lost. After that it's gone for good.</div>
        </div>
        <div className="field">
          <label htmlFor="del-confirm">Type DELETE to confirm</label>
          <input id="del-confirm" className="input input-lg" autoCapitalize="characters" autoComplete="off" value={text}
            onChange={e => { setText(e.target.value); setError(''); }} style={{ letterSpacing: '0.04em' }} />
        </div>
        <ErrorLine msg={error} />
        <button className="btn btn-primary btn-lg" disabled={!ok || busy} onClick={confirm}>Delete my account</button>
        <button className="btn btn-secondary btn-md" onClick={() => go('settings')}>Cancel</button>
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
    ['1. Who we are', `Pocket Sense is a spending-awareness app. In this policy, "we" means the person who runs it. Contact: ${CONTACT_EMAIL}.`],
    ['2. What we collect', 'Without an account, everything stays on your phone and we collect nothing. With an account, we store your email address and birth year; your purchases (amount, category, wallet and time); any mood tags you add; your goal, parking lot items and cooldown timers; and your settings, including labels the app has learned from your look-backs.'],
    ['3. Why we collect it', "Only to keep your data the same across your devices and to run the app's features. We don't use it for advertising and we don't sell it."],
    ["4. Where it's stored", 'On servers run by Supabase, our database provider. Password-reset emails are sent through Resend, which receives only your email address.'],
    ['5. Who can see it', 'Your account is protected by your password or Google sign-in. The person who runs Pocket Sense can technically view your data in the database, and will only do so to fix a problem you report.'],
    ['6. Users under 18', "If you're under 18, a parent or guardian must approve before your data is stored on our server, in line with Indonesia's Personal Data Protection Law (UU PDP No. 27/2022). Until then, the app works on your phone only."],
    ['7. Signing out and deleting', 'Signing out clears your data from that phone; it stays in your account. You can delete your account in Settings. Deletion takes effect after 7 days, and signing in before then cancels it. After 7 days, your account and all synced data are permanently erased.'],
    ['8. Changes', "If this policy changes, we'll tell you in the app before the change applies."],
  ];
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15, lineHeight: 1.55 }}>
      <div className="t13 muted">Last updated {POLICY_UPDATED}</div>
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
      <BackBar title="Privacy policy" onBack={onBack} />
      <PrivacyText />
    </div>
  );
}
