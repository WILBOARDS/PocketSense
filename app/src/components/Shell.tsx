// The frame around the screens on bigger windows: a top bar with tabs at half screen,
// a sidebar at full window. The phone keeps its bottom bar (in App.tsx).
import type { ReactNode } from 'react';
import { useAccount } from '../lib/account';
import { parkingStats } from '../lib/derive';
import { tr } from '../lib/i18n';
import { useData } from '../lib/store';
import { maskEmail } from '../lib/sync';
import { useUi, type Screen } from '../ui';
import { Chart, Gear, List, MessageCircle, Target, Timer } from './icons';

/** "■ Synced" in a small box; nothing when accounts are off or nobody is signed in. */
export function SyncPill() {
  const acc = useAccount();
  if (!acc.enabled || !acc.sync.label) return null;
  return (
    <div role="status" className="sync-pill" style={{ color: acc.sync.fg }}>
      <span className="sync-dot" style={{ background: acc.sync.dot }} />{acc.sync.label}
    </div>
  );
}

interface Tab { screen: Screen; label: string; icon: ReactNode; badge?: number }

function useTabs(): Tab[] {
  const { data } = useData();
  const { now } = useUi();
  const pk = parkingStats(data, now);
  return [
    { screen: 'home', label: tr('History', 'Riwayat'), icon: <List /> },
    { screen: 'parking', label: tr('Parking lot', 'Parkiran'), icon: <Timer />, badge: pk.ready.length || undefined },
    { screen: 'insights', label: tr('Week', 'Mingguan'), icon: <Chart /> },
    { screen: 'ask', label: tr('Ask', 'Tanya'), icon: <MessageCircle /> },
    { screen: 'goals', label: tr('Goal', 'Target'), icon: <Target /> },
  ];
}

/** Which tab a screen belongs to, so sub-screens (Thinking, Goal setup) keep their tab lit. */
export function tabOf(s: Screen): Screen | null {
  if (s === 'home' || s === 'transactions') return 'home';
  if (s === 'thinking' || s === 'parking') return 'parking';
  if (s === 'goal-setup' || s === 'goals') return 'goals';
  if (s === 'ask-about' || s === 'ask') return 'ask';
  if (s === 'insights') return 'insights';
  return null;
}

/** Half screen: app name, sync and the gear on top, then the tabs. */
export function HalfBar({ screen }: { screen: Screen }) {
  const { go, now } = useUi();
  const { data } = useData();
  const tabs = useTabs();
  const pk = parkingStats(data, now);
  const live = pk.ready.length + pk.waiting.length;
  const current = tabOf(screen);
  return (
    <>
      <div className="half-head">
        <div className="t18 w8">Pocket Sense</div>
        <SyncPill />
        <div className="grow" />
        <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label={tr('Settings', 'Pengaturan')}
          aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => go('settings')}><Gear /></button>
      </div>
      <nav aria-label={tr('Main', 'Utama')} className="half-tabs">
        {tabs.map(t => (
          <button key={t.screen} aria-current={current === t.screen ? 'page' : undefined} onClick={() => go(t.screen)}>
            {t.label}{t.screen === 'parking' && live ? ` · ${live}` : ''}
          </button>
        ))}
      </nav>
    </>
  );
}

/** Full window: app name and sync, the pages, and Settings at the bottom. */
export function Sidebar({ screen }: { screen: Screen }) {
  const { go } = useUi();
  const acc = useAccount();
  const tabs = useTabs();
  const current = tabOf(screen);
  return (
    <aside className="sidebar">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <div className="t20 w8">Pocket Sense</div>
        <SyncPill />
      </div>
      <div className="rule" />
      <nav aria-label={tr('Main', 'Utama')} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
        {tabs.map(t => (
          <button key={t.screen} className="side-link" aria-current={current === t.screen ? 'page' : undefined} onClick={() => go(t.screen)}>
            {t.icon}<span className="grow">{t.label}</span>
            {t.badge && <span className="side-badge" aria-label={tr(`${t.badge} ready`, `${t.badge} siap`)}>{t.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="grow" />
      <div className="rule" />
      <div style={{ padding: '16px 20px 20px' }}>
        <button className="side-settings" aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
          <Gear />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{tr('Settings', 'Pengaturan')}</span>
            {acc.enabled && acc.status === 'in' && <span className="t12 muted">{maskEmail(acc.email)}</span>}
          </span>
        </button>
      </div>
    </aside>
  );
}
