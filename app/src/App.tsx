import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StateView } from './components/common';
import { Chart, House, List, Plus, Target } from './components/icons';
import { AccountContext, useAccountController } from './lib/account';
import { loadPhoto, resizePhoto, savePhoto } from './lib/storage';
import { useStore } from './lib/store';
import { Consent, DeleteAccount, Forgot, NewPassword, Privacy, Restore, Settings, SignIn, Upload, Verify } from './screens/Account';
import { Goal } from './screens/Goal';
import { Home } from './screens/Home';
import { Insights } from './screens/Insights';
import { Lookback } from './screens/Lookback';
import { GoalSetup, Onboarding } from './screens/Onboarding';
import { ParentApprove } from './screens/ParentApprove';
import { Parking } from './screens/Parking';
import { Thinking } from './screens/Thinking';
import { Transactions } from './screens/Transactions';
import { QuickLog } from './sheets/QuickLog';
import { SignOutSheet } from './sheets/SignOut';
import { WhySheet } from './sheets/WhySheet';
import { UiContext, type LogPrefill, type Screen, type Ui } from './ui';

/** Show pattern names ("Impulse spike", "Leak", "Saver streak") above the plain sentences. */
const SHOW_PATTERN_NAMES = true;
const TABS: Screen[] = ['home', 'transactions', 'insights', 'goals'];
/** Screens that work before onboarding is done, e.g. signing in on a new PC. */
const ACCOUNT_SCREENS: Screen[] = ['settings', 'signin', 'forgot', 'verify', 'new-password', 'consent', 'upload', 'restore', 'delete', 'privacy'];
/** Screens whose back button returns to wherever they were opened from. */
const RETURNS: Screen[] = ['signin', 'privacy'];

/** The token from a parent's approval email link, if this page was opened from one. */
const consentToken = () => new URLSearchParams(window.location.search).get('consent');

export function App() {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>('home');
  const [log, setLog] = useState<{ prefill?: LogPrefill } | null>(null);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [photo, setPhotoState] = useState(loadPhoto);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [parentToken, setParentToken] = useState(consentToken);
  const [from, setFrom] = useState<Partial<Record<Screen, Screen>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number>(undefined);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);

  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => { if (store.saveFailed) toast("Couldn't save to this phone. Storage may be full."); }, [store.saveFailed, toast]);

  const go = useCallback((s: Screen) => {
    const cur = screenRef.current;
    // Remember where sign-in and the privacy policy were opened from, but not steps inside those flows.
    if (RETURNS.includes(s) && s !== cur && !['forgot', 'verify', 'privacy', 'signin'].includes(cur)) {
      setFrom(f => ({ ...f, [s]: cur }));
    }
    setScreen(s);
    scrollRef.current?.scrollTo(0, 0);
  }, []);
  const back = (s: Screen) => go(from[s] ?? 'home');

  const clearPhoto = useCallback(() => { savePhoto(null); setPhotoState(null); }, []);
  const account = useAccountController(store, go, toast, clearPhoto);

  // Escape and the Android back button close the top layer first: Why sheet, then Quick log, then the screen.
  const closeTop = useCallback(() => {
    if (signOutOpen) setSignOutOpen(false);
    else if (whyId) setWhyId(null);
    else if (log) setLog(null);
    else if (screen !== 'home') go(RETURNS.includes(screen) ? from[screen] ?? 'home' : 'home');
  }, [signOutOpen, whyId, log, screen, from, go]);
  useBackButton((signOutOpen ? 1 : 0) + (whyId ? 1 : 0) + (log ? 1 : 0) + (screen !== 'home' ? 1 : 0), closeTop);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (signOutOpen || whyId || log)) closeTop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signOutOpen, whyId, log, closeTop]);

  const ui = useMemo<Ui>(() => ({
    now, screen, go, toast, photo,
    openLog: prefill => setLog({ prefill }),
    openWhy: id => setWhyId(id),
    setPhoto: file => {
      resizePhoto(file)
        .then(url => {
          if (savePhoto(url)) setPhotoState(url);
          else toast('That photo is too big to save on this phone.');
        })
        .catch(() => toast("Couldn't read that image."));
    },
  }), [now, screen, go, toast, photo]);

  const toastEl = (bottom: number) => toastMsg && <div role="status" className="toast" style={{ bottom }}>{toastMsg}</div>;
  const wrap = (children: ReactNode) => (
    <UiContext.Provider value={ui}>
      <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
    </UiContext.Provider>
  );

  if (parentToken) {
    const close = () => { history.replaceState(null, '', window.location.pathname); setParentToken(null); };
    return wrap(<div className="app"><div className="scroll"><ParentApprove token={parentToken} onClose={close} /></div></div>);
  }

  if (store.status === 'error') {
    return (
      <div className="app">
        <StateView title="Pocket Sense" heading="Couldn't read your saved data"
          body="Your purchases are still on this phone. Nothing was deleted." action="Try again" onAction={store.retry} />
      </div>
    );
  }

  const accountScreen = ACCOUNT_SCREENS.includes(screen) && account.enabled;
  const data = store.data;

  if (!accountScreen && (store.status === 'new' || !data)) {
    return wrap(
      <div className="app">
        <div className="scroll">
          <Onboarding onSignIn={account.enabled ? () => go('signin') : undefined}
            onDone={(s, g) => { store.start(s, g); toast('All set. Press + to log your first purchase.'); }} />
        </div>
        {toastEl(16)}
      </div>,
    );
  }

  const showNav = TABS.includes(screen) && !!data;

  return wrap(
    <div className="app" data-screen-label={screen}>
      <div className="scroll" ref={scrollRef}>
        {screen === 'home' && <Home />}
        {screen === 'transactions' && <Transactions />}
        {screen === 'insights' && <Insights patternNames={SHOW_PATTERN_NAMES} />}
        {screen === 'goals' && <Goal />}
        {screen === 'thinking' && <Thinking />}
        {screen === 'parking' && <Parking />}
        {screen === 'lookback' && <Lookback />}
        {screen === 'goal-setup' && data && (
          <GoalSetup initial={data.goal} onCancel={() => go('goals')}
            onSave={g => { store.actions.setGoal(g); go('goals'); toast('Goal saved.'); }} />
        )}
        {accountScreen && <>
          {screen === 'settings' && <Settings onSignOut={() => setSignOutOpen(true)} />}
          {screen === 'signin' && <SignIn email={authEmail} setEmail={setAuthEmail} onBack={() => back('signin')} />}
          {screen === 'forgot' && <Forgot email={authEmail} setEmail={setAuthEmail} />}
          {screen === 'verify' && <Verify email={authEmail} />}
          {screen === 'new-password' && <NewPassword />}
          {screen === 'consent' && <Consent />}
          {screen === 'upload' && <Upload />}
          {screen === 'restore' && <Restore />}
          {screen === 'delete' && <DeleteAccount />}
          {screen === 'privacy' && <Privacy onBack={() => back('privacy')} />}
        </>}
      </div>

      {showNav && (
        <nav aria-label="Main" className="nav-bar">
          <NavItem label="Home" current={screen === 'home'} onClick={() => go('home')}><House /></NavItem>
          <NavItem label="Spending" current={screen === 'transactions'} onClick={() => go('transactions')}><List /></NavItem>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="nav-log" aria-label="Log a purchase" onClick={() => setLog({})}><Plus /></button>
          </div>
          <NavItem label="Insights" current={screen === 'insights'} onClick={() => go('insights')}><Chart /></NavItem>
          <NavItem label="Goal" current={screen === 'goals'} onClick={() => go('goals')}><Target /></NavItem>
        </nav>
      )}

      {toastEl(showNav ? 80 : 16)}
      {log && <QuickLog prefill={log.prefill} onClose={() => setLog(null)} />}
      {whyId && <WhySheet purchaseId={whyId} onClose={() => setWhyId(null)} />}
      {signOutOpen && <SignOutSheet onClose={() => setSignOutOpen(false)} />}
    </div>,
  );
}

function NavItem({ label, current, onClick, children }: { label: string; current: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="nav-item" aria-current={current ? 'page' : undefined} onClick={onClick}>
      {children}{label}
    </button>
  );
}

/**
 * Keeps one extra browser-history entry while any layer (sheet or non-home screen) is open,
 * so the phone's back gesture closes the layer instead of leaving the app.
 */
function useBackButton(layers: number, closeTop: () => void) {
  const hasEntry = useRef(false);
  const ignorePop = useRef(false);
  const closeRef = useRef(closeTop);
  closeRef.current = closeTop;

  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) { ignorePop.current = false; return; }
      hasEntry.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (layers > 0 && !hasEntry.current) {
      history.pushState({ pocketSenseLayer: true }, '');
      hasEntry.current = true;
    } else if (layers === 0 && hasEntry.current) {
      hasEntry.current = false;
      ignorePop.current = true;
      history.back();
    }
  }, [layers]);
}
