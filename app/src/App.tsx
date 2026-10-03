import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StateView } from './components/common';
import { Chart, House, List, MessageCircle, Plus } from './components/icons';
import { AccountContext, useAccountController } from './lib/account';
import { setCurrency } from './lib/format';
import { deviceLang, saveDeviceLang, setLang as setModuleLang, tr, type Lang } from './lib/i18n';
import { readShared } from './lib/share';
import { loadPhoto, resizePhoto, savePhoto } from './lib/storage';
import { useStore } from './lib/store';
import type { Currency } from './lib/types';
import { Consent, DeleteAccount, Forgot, NewPassword, Privacy, Restore, Settings, SignIn, Upload, Verify, type AuthForm } from './screens/Account';
import { Ask, AskAbout } from './screens/Ask';
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
import { UiContext, type LogPrefill, type ParkPrefill, type Screen, type Ui } from './ui';

/** Show pattern names ("Impulse spike", "Leak", "Saver streak") above the plain sentences. */
const SHOW_PATTERN_NAMES = true;
const TABS: Screen[] = ['home', 'transactions', 'insights', 'ask'];
/** Screens that work before onboarding is done, e.g. signing in on a new PC. */
const ACCOUNT_SCREENS: Screen[] = ['signin', 'forgot', 'verify', 'new-password', 'consent', 'upload', 'restore', 'delete'];
/** Screens whose back button returns to wherever they were opened from. */
const RETURNS: Screen[] = ['signin', 'privacy', 'ask-about'];

const params = new URLSearchParams(window.location.search);
/** The token from a parent's approval email link, if this page was opened from one. */
const consentToken = () => params.get('consent');

/** Something shared from a shop app's Share button (see share_target in the manifest). */
function takeShared(): ParkPrefill | null {
  if (!params.has('share')) return null;
  const shared = readShared(params.get('title') ?? '', params.get('text') ?? '', params.get('url') ?? '');
  history.replaceState(null, '', window.location.pathname);
  return shared && { ...shared, price: shared.price || undefined };
}

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
  /** Kept here so opening the privacy policy from Create account and coming back keeps the form. */
  const [authForm, setAuthForm] = useState<AuthForm>({ mode: null, year: '' });
  const [parentToken, setParentToken] = useState(consentToken);
  const [from, setFrom] = useState<Partial<Record<Screen, Screen>>>({});
  const [parkPrefill, setParkPrefill] = useState<ParkPrefill | null>(null);
  const [shared, setShared] = useState(takeShared);
  const [localLang, setLocalLang] = useState(deviceLang);
  /** Currency picked during setup, before there are settings to keep it in. */
  const [setupCurrency, setSetupCurrency] = useState<Currency>('IDR');
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

  // Every screen reads these while rendering, so they're set before anything below renders.
  const lang: Lang = store.data?.settings.lang ?? localLang;
  setModuleLang(lang);
  setCurrency(store.data?.settings.currency ?? setupCurrency);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    if (store.saveFailed) toast(tr("Couldn't save to this phone. Storage may be full.", 'Tidak bisa menyimpan di HP ini. Penyimpanan mungkin penuh.'));
  }, [store.saveFailed, toast]);

  const go = useCallback((s: Screen) => {
    const cur = screenRef.current;
    // Remember where sign-in, the privacy policy and About Ask were opened from, but not the steps
    // inside sign-in (so Back from "Reset password" → Sign in still returns to the original screen).
    const inside = s === 'signin' ? ['forgot', 'verify', 'privacy'] : [];
    if (RETURNS.includes(s) && s !== cur && !inside.includes(cur)) {
      setFrom(f => ({ ...f, [s]: cur }));
    }
    // A shared link fills in "Thinking of buying" once; opening it again later starts empty.
    if (s !== 'thinking') setParkPrefill(null);
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

  const { setPrefs } = store.actions;
  const hasData = !!store.data;
  const ui = useMemo<Ui>(() => ({
    now, screen, go, toast, photo, lang,
    openLog: prefill => setLog({ prefill }),
    openWhy: id => setWhyId(id),
    think: prefill => { setParkPrefill(prefill ?? null); go('thinking'); },
    setPhoto: file => {
      resizePhoto(file)
        .then(url => {
          if (savePhoto(url)) setPhotoState(url);
          else toast(tr('That photo is too big to save on this phone.', 'Foto itu terlalu besar untuk disimpan di HP ini.'));
        })
        .catch(() => toast(tr("Couldn't read that image.", 'Gambar itu tidak bisa dibaca.')));
    },
    setLang: l => {
      saveDeviceLang(l);
      setLocalLang(l);
      if (hasData) setPrefs({ lang: l });
    },
  }), [now, screen, go, toast, photo, lang, hasData, setPrefs]);

  // A link shared from a shop app opens "Thinking of buying" once the app has data to work with.
  useEffect(() => {
    if (shared && store.status === 'ready' && store.data) {
      ui.think(shared);
      setShared(null);
    }
  }, [shared, store.status, store.data, ui]);

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
        <StateView title="Pocket Sense" heading={tr("Couldn't read your saved data", 'Data tersimpan tidak bisa dibaca')}
          body={tr('Your purchases are still on this phone. Nothing was deleted.', 'Pembelianmu masih ada di HP ini. Tidak ada yang dihapus.')}
          action={tr('Try again', 'Coba lagi')} onAction={store.retry} />
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
            currency={setupCurrency} onCurrency={setSetupCurrency}
            onDone={(s, g) => {
              store.start({ ...s, lang }, g);
              toast(tr('All set. Press + to log your first purchase.', 'Siap. Tekan + untuk mencatat pembelian pertamamu.'));
            }} />
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
        {screen === 'ask' && <Ask />}
        {screen === 'ask-about' && <AskAbout onBack={() => back('ask-about')} />}
        {screen === 'goals' && <Goal />}
        {screen === 'thinking' && <Thinking key={JSON.stringify(parkPrefill)} prefill={parkPrefill ?? undefined} />}
        {screen === 'parking' && <Parking />}
        {screen === 'lookback' && <Lookback />}
        {screen === 'goal-setup' && data && (
          <GoalSetup initial={data.goal} onCancel={() => go('goals')}
            onSave={g => { store.actions.setGoal(g); go('goals'); toast(tr('Goal saved.', 'Target disimpan.')); }} />
        )}
        {screen === 'settings' && <Settings onSignOut={() => setSignOutOpen(true)} />}
        {screen === 'privacy' && <Privacy onBack={() => back('privacy')} />}
        {accountScreen && <>
          {screen === 'signin' && <SignIn email={authEmail} setEmail={setAuthEmail} form={authForm} setForm={setAuthForm} onBack={() => back('signin')} />}
          {screen === 'forgot' && <Forgot email={authEmail} setEmail={setAuthEmail} />}
          {screen === 'verify' && <Verify email={authEmail} />}
          {screen === 'new-password' && <NewPassword />}
          {screen === 'consent' && <Consent />}
          {screen === 'upload' && <Upload />}
          {screen === 'restore' && <Restore />}
          {screen === 'delete' && <DeleteAccount />}
        </>}
      </div>

      {showNav && (
        <nav aria-label={tr('Main', 'Utama')} className="nav-bar">
          <NavItem label={tr('Home', 'Beranda')} current={screen === 'home'} onClick={() => go('home')}><House /></NavItem>
          <NavItem label={tr('Spending', 'Belanja')} current={screen === 'transactions'} onClick={() => go('transactions')}><List /></NavItem>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="nav-log" aria-label={tr('Log a purchase', 'Catat pembelian')} onClick={() => setLog({})}><Plus /></button>
          </div>
          <NavItem label={tr('Week', 'Mingguan')} current={screen === 'insights'} onClick={() => go('insights')}><Chart /></NavItem>
          <NavItem label={tr('Ask', 'Tanya')} current={screen === 'ask'} onClick={() => go('ask')}><MessageCircle /></NavItem>
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
