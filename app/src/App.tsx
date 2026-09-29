import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StateView } from './components/common';
import { Chart, House, List, Plus, Target } from './components/icons';
import { loadPhoto, resizePhoto, savePhoto } from './lib/storage';
import { useStore } from './lib/store';
import { Goal } from './screens/Goal';
import { Home } from './screens/Home';
import { Insights } from './screens/Insights';
import { Lookback } from './screens/Lookback';
import { GoalSetup, Onboarding } from './screens/Onboarding';
import { Parking } from './screens/Parking';
import { Thinking } from './screens/Thinking';
import { Transactions } from './screens/Transactions';
import { QuickLog } from './sheets/QuickLog';
import { WhySheet } from './sheets/WhySheet';
import { UiContext, type LogPrefill, type Screen, type Ui } from './ui';

/** Show pattern names ("Impulse spike", "Leak", "Saver streak") above the plain sentences. */
const SHOW_PATTERN_NAMES = true;
const TABS: Screen[] = ['home', 'transactions', 'insights', 'goals'];

export function App() {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>('home');
  const [log, setLog] = useState<{ prefill?: LogPrefill } | null>(null);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [photo, setPhotoState] = useState(loadPhoto);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number>(undefined);

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
    setScreen(s);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  // Escape and the Android back button close the top layer first: Why sheet, then Quick log, then the screen.
  const closeTop = useCallback(() => {
    if (whyId) setWhyId(null);
    else if (log) setLog(null);
    else if (screen !== 'home') go('home');
  }, [whyId, log, screen, go]);
  useBackButton((whyId ? 1 : 0) + (log ? 1 : 0) + (screen !== 'home' ? 1 : 0), closeTop);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (whyId || log)) closeTop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [whyId, log, closeTop]);

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

  if (store.status === 'error') {
    return (
      <div className="app">
        <StateView title="Pocket Sense" heading="Couldn't read your saved data"
          body="Your purchases are still on this phone. Nothing was deleted." action="Try again" onAction={store.retry} />
      </div>
    );
  }

  if (store.status === 'new' || !store.data) {
    return (
      <div className="app">
        <div className="scroll"><Onboarding onDone={(s, g) => { store.start(s, g); toast('All set. Press + to log your first purchase.'); }} /></div>
        {toastMsg && <div role="status" className="toast" style={{ bottom: 16 }}>{toastMsg}</div>}
      </div>
    );
  }

  const data = store.data;
  const showNav = TABS.includes(screen);

  return (
    <UiContext.Provider value={ui}>
      <div className="app" data-screen-label={screen}>
        <div className="scroll" ref={scrollRef}>
          {screen === 'home' && <Home />}
          {screen === 'transactions' && <Transactions />}
          {screen === 'insights' && <Insights patternNames={SHOW_PATTERN_NAMES} />}
          {screen === 'goals' && <Goal />}
          {screen === 'thinking' && <Thinking />}
          {screen === 'parking' && <Parking />}
          {screen === 'lookback' && <Lookback />}
          {screen === 'goal-setup' && (
            <GoalSetup initial={data.goal} onCancel={() => go('goals')}
              onSave={g => { store.actions.setGoal(g); go('goals'); toast('Goal saved.'); }} />
          )}
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

        {toastMsg && <div role="status" className="toast" style={{ bottom: showNav ? 80 : 16 }}>{toastMsg}</div>}
        {log && <QuickLog prefill={log.prefill} onClose={() => setLog(null)} />}
        {whyId && <WhySheet purchaseId={whyId} onClose={() => setWhyId(null)} />}
      </div>
    </UiContext.Provider>
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
