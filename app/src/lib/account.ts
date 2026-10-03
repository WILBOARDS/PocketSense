// Accounts and sync. Signs in with Supabase, copies this phone's data to the account, and keeps
// both copies the same afterwards. Every screen reads it through useAccount().
//
// Rules:
// - Nothing leaves the phone until the server says can_sync (18+, or a parent approved).
// - The phone keeps working offline. Changes made then are counted and sent when it's back online.
// - "Linked" means this phone has copied its data to this account at least once (meta.userId).
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { shortDate } from './dates';
import { loadJson, saveJson } from './storage';
import type { useStore } from './store';
import { tr } from './i18n';
import { normalize } from './migrate';
import { authMessage, isFresh, isValidData, merge, offlineMsg, syncView, type AccountStatus, type SyncView } from './sync';
import type { Data } from './types';
import { supabase, urlAuth } from './supabase';
import type { Screen } from '../ui';

export interface Profile {
  birth_year: number | null;
  minor: boolean;
  parent_email: string | null;
  consent_approved: boolean;
  deletion_at: string | null;
  can_sync: boolean;
}

export interface LinkState {
  progress: number;
  /** 'down' when this phone had nothing yet and gets the account's data instead. */
  dir: 'up' | 'down';
  done: boolean;
  error: string | null;
}

/** Where this phone is with the account. Saved so it survives restarts. */
interface Meta { userId: string | null; rev: number; pending: number }
/** Small per-phone account preferences. */
interface Local {
  promptDismissed: boolean;
  /** The phone was cleared by signing out or deleting the account. */
  wiped: boolean;
  /** ISO date the account will be erased, shown in Settings after deleting. */
  deletionAt: string | null;
  /** The user started signing in; finish the flow when the page comes back from Google or an email link. */
  linking: boolean;
  /** Birth year typed before "Continue with Google" in Create account. */
  birthYear: number | null;
  /** The account whose data is on this phone. Another person's data is never merged into a different account. */
  ownerId: string | null;
}

const META_KEY = 'pocket-sense:sync';
const LOCAL_KEY = 'pocket-sense:account';
const EMPTY_META: Meta = { userId: null, rev: 0, pending: 0 };
const EMPTY_LOCAL: Local = { promptDismissed: false, wiped: false, deletionAt: null, linking: false, birthYear: null, ownerId: null };
const PULL_EVERY_MS = 60_000;
const PUSH_DELAY_MS = 1500;

type Store = ReturnType<typeof useStore>;
/** Error message for the screen, or null when it worked. */
type Result = Promise<string | null>;

export interface AccountValue {
  enabled: boolean;
  status: AccountStatus;
  email: string | null;
  profile: Profile | null;
  sync: SyncView & { online: boolean; pending: number };
  local: Local;
  link: LinkState | null;
  /** Signed in with Google but no birth year yet: the sign-in screen asks for it. */
  finishing: boolean;

  dismissPrompt: () => void;
  signIn: (email: string, password: string) => Result;
  signUp: (email: string, password: string, birthYear: number) => Result;
  google: (birthYear: number | null) => Result;
  finishProfile: (birthYear: number) => Result;
  cancelSignIn: () => Promise<void>;
  sendReset: (email: string) => Result;
  setNewPassword: (password: string) => Result;
  requestConsent: (parentEmail?: string) => Result;
  skipConsent: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Result;
  restore: () => Result;
  keepDeletion: () => Promise<void>;
  retryLink: () => void;
}

export const AccountContext = createContext<AccountValue | null>(null);

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error('useAccount must be used inside AccountContext');
  return v;
}

const appUrl = () => window.location.origin + window.location.pathname;
const isNetworkError = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  return !navigator.onLine || m.includes('fetch') || m.includes('network') || m.includes('load failed');
};

/** Reads { error } from an Edge Function's reply, which supabase-js hides inside the error. */
export async function functionError(error: unknown): Promise<string> {
  const res = (error as { context?: Response })?.context;
  if (res && typeof res.json === 'function') {
    const body = await res.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return isNetworkError(error) ? offlineMsg() : tr('Something went wrong. Try again.', 'Ada yang salah. Coba lagi.');
}

export function useAccountController(store: Store, go: (s: Screen) => void, toast: (m: string) => void, clearPhoto: () => void): AccountValue {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meta, setMetaState] = useState<Meta>(() => loadJson(META_KEY, EMPTY_META));
  const [local, setLocalState] = useState<Local>(() => loadJson(LOCAL_KEY, EMPTY_LOCAL));
  const [online, setOnlineState] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [link, setLink] = useState<LinkState | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Refs mirror state so async code always sees the latest values.
  const metaRef = useRef(meta);
  const localRef = useRef(local);
  const sessionRef = useRef(session);
  const onlineRef = useRef(online);
  const profileRef = useRef(profile);
  const busy = useRef(false);
  const linkRunning = useRef(false);
  const recoveryPending = useRef(urlAuth.recovery);
  const handledUid = useRef<string | null>(null);
  const pushTimer = useRef<number>(undefined);
  const deps = useRef({ store, go, toast, clearPhoto });
  deps.current = { store, go, toast, clearPhoto };
  sessionRef.current = session;
  profileRef.current = profile;

  const setMeta = useCallback((patch: Partial<Meta>) => {
    metaRef.current = { ...metaRef.current, ...patch };
    saveJson(META_KEY, metaRef.current);
    setMetaState(metaRef.current);
  }, []);
  const setLocal = useCallback((patch: Partial<Local>) => {
    localRef.current = { ...localRef.current, ...patch };
    saveJson(LOCAL_KEY, localRef.current);
    setLocalState(localRef.current);
  }, []);
  const setOnline = useCallback((v: boolean) => { onlineRef.current = v; setOnlineState(v); }, []);

  const uid = () => sessionRef.current?.user.id ?? null;
  const isLinked = () => !!uid() && metaRef.current.userId === uid();

  const fetchProfile = useCallback(async (): Promise<Profile | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('account_status');
    if (error) throw error;
    const p = (data as Profile | null) ?? null;
    profileRef.current = p;
    setProfile(p);
    return p;
  }, []);

  const fetchRow = useCallback(async (): Promise<{ data: Data; rev: number } | null> => {
    const { data, error } = await supabase!.from('user_data').select('data, rev').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (!isValidData(data.data)) {
      throw new Error(tr('The data in your account is from a newer version of the app. Update Pocket Sense and try again.',
        'Data di akunmu dari versi aplikasi yang lebih baru. Perbarui Pocket Sense lalu coba lagi.'));
    }
    return { data: normalize(data.data), rev: data.rev as number };
  }, []);

  /** Saves `data` on top of server version `base`. If someone saved in between, merges and tries again. */
  const pushLoop = useCallback(async (data: Data, base: number): Promise<number> => {
    const { store } = deps.current;
    for (let i = 0; i < 4; i++) {
      const { data: rev, error } = await supabase!.rpc('push_data', { p_data: data, p_base_rev: base });
      if (error) throw error;
      if ((rev as number) > 0) return rev as number;
      const row = await fetchRow();
      if (!row) { base = 0; continue; }
      data = merge(store.getData() ?? data, row.data);
      store.replace(data);
      base = row.rev;
    }
    throw new Error(tr('Your data kept changing on another device. Try again.', 'Datamu terus berubah di perangkat lain. Coba lagi.'));
  }, [fetchRow]);

  /** Background sync for a linked phone: take the account's changes, then send this phone's. */
  const syncNow = useCallback(async () => {
    if (!supabase || busy.current || !isLinked() || !onlineRef.current) return;
    const { store } = deps.current;
    busy.current = true;
    setSyncing(true);
    const pendingAtStart = metaRef.current.pending;
    const editsAtStart = store.getEdits();
    try {
      const row = await fetchRow();
      const m = metaRef.current;
      const localData = store.getData();
      if (row && row.rev > m.rev) {
        if (m.pending === 0 && store.getEdits() === editsAtStart) {
          store.replace(row.data);
          setMeta({ rev: row.rev });
        } else if (localData) {
          const merged = merge(localData, row.data);
          store.replace(merged);
          const rev = await pushLoop(merged, row.rev);
          setMeta({ rev, pending: Math.max(0, metaRef.current.pending - pendingAtStart) });
        }
      } else if (m.pending > 0 && localData) {
        const rev = await pushLoop(localData, row ? row.rev : 0);
        setMeta({ rev, pending: Math.max(0, metaRef.current.pending - pendingAtStart) });
      }
    } catch (e) {
      if (isNetworkError(e)) setOnline(false);
      else console.warn('Sync failed', e);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
    // Edits made while this ran go out in the next round.
    if (metaRef.current.pending > 0 && onlineRef.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS);
    }
  }, [fetchRow, pushLoop, setMeta, setOnline]);

  /** The first copy after signing in, shown on the upload screen. */
  const startLink = useCallback(async () => {
    const { store, go } = deps.current;
    const id = uid();
    if (!supabase || !id || linkRunning.current) return;
    linkRunning.current = true;
    const owner = localRef.current.ownerId;
    if (owner && owner !== id) { store.wipe(); deps.current.clearPhoto(); }
    const before = store.getData();
    const dir: LinkState['dir'] = isFresh(before) ? 'down' : 'up';
    let progress = 4;
    setLink({ progress, dir, done: false, error: null });
    go('upload');
    // The request is one save, so the bar fills on a timer and finishes when the server answers.
    const timer = window.setInterval(() => {
      progress = Math.min(90, progress + 4);
      setLink(l => (l && !l.done && !l.error ? { ...l, progress } : l));
    }, 110);
    try {
      const row = await fetchRow();
      const localData = store.getData();
      let rev = 0;
      if (row && isFresh(localData)) {
        store.replace(row.data);
        rev = row.rev;
      } else if (row && localData) {
        const merged = merge(localData, row.data);
        store.replace(merged);
        rev = await pushLoop(merged, row.rev);
      } else if (localData) {
        rev = await pushLoop(localData, 0);
      }
      setMeta({ userId: id, rev, pending: 0 });
      setLocal({ wiped: false, linking: false, birthYear: null, deletionAt: null, ownerId: id });
      setLink({ progress: 100, dir, done: true, error: null });
    } catch (e) {
      const msg = e instanceof Error && !isNetworkError(e) ? e.message : offlineMsg();
      setLink(l => ({ progress: l?.progress ?? 0, dir, done: false, error: msg }));
    } finally {
      clearInterval(timer);
      linkRunning.current = false;
    }
  }, [fetchRow, pushLoop, setMeta, setLocal]);

  /** Clears this phone's data and forgets the account link. The account itself is untouched. */
  const clearPhone = useCallback((extra: Partial<Local> = {}) => {
    const { store, clearPhoto, go } = deps.current;
    store.wipe();
    clearPhoto();
    setMeta(EMPTY_META);
    setLocal({ wiped: true, linking: false, birthYear: null, ownerId: null, ...extra });
    setProfile(null);
    setFinishing(false);
    handledUid.current = null;
    go('home');
  }, [setMeta, setLocal]);

  /** Decides where to go once a session exists. `interactive` means the user just signed in. */
  const afterSignIn = useCallback(async (interactive: boolean) => {
    const { go, toast } = deps.current;
    let p: Profile | null;
    try {
      p = await fetchProfile();
    } catch (e) {
      if (interactive) toast(isNetworkError(e) ? offlineMsg() : tr("Couldn't load your account. Try again.", 'Akunmu tidak bisa dimuat. Coba lagi.'));
      return;
    }
    if (!p) return;

    if (p.deletion_at) {
      if (interactive) { setLocal({ linking: false }); go('restore'); }
      else if (isLinked()) {
        // Deleted on another device: this phone follows.
        await supabase!.auth.signOut({ scope: 'local' });
        clearPhone({ deletionAt: p.deletion_at });
        toast(tr('This account is set to be deleted. This phone is cleared.', 'Akun ini dijadwalkan untuk dihapus. HP ini sudah dikosongkan.'));
      }
      return;
    }

    if (p.birth_year == null) {
      const y = localRef.current.birthYear;
      if (y) {
        const { data, error } = await supabase!.rpc('set_birth_year', { p_birth_year: y });
        if (error) { toast(authMessage(error)); return; }
        p = data as Profile;
        setProfile(p);
      } else {
        if (interactive) { setFinishing(true); go('signin'); }
        return;
      }
    }

    if (!p.can_sync) {
      if (interactive) {
        setLocal({ linking: false, birthYear: null });
        if (!p.parent_email) go('consent');
        else { go('home'); toast(tr('Waiting for a parent to approve. Your data stays on this phone.', 'Menunggu persetujuan orang tua. Datamu tetap di HP ini.')); }
      }
      return;
    }

    if (interactive || !isLinked()) {
      if (!interactive && p.minor) toast(tr('A parent approved. Copying this phone to your account.', 'Orang tua sudah setuju. Menyalin HP ini ke akunmu.'));
      await startLink();
    } else {
      await syncNow();
    }
  }, [fetchProfile, setLocal, startLink, syncNow, clearPhone]);

  // Session changes: first load, coming back from Google or an email link, signing out.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      sessionRef.current = s;
      setSession(s);
      // Supabase asks not to call it from inside this callback, so the work runs right after.
      window.setTimeout(() => {
        // A reset link signs the user in; they choose a new password before anything else happens.
        if (s && (event === 'PASSWORD_RECOVERY' || recoveryPending.current)) {
          recoveryPending.current = false;
          handledUid.current = s.user.id;
          deps.current.go('new-password');
          return;
        }
        if (!s) {
          handledUid.current = null;
          setProfile(null);
          // Signed out without us asking (session expired): keep the data, drop the link.
          if (metaRef.current.userId) setMeta(EMPTY_META);
          return;
        }
        if (handledUid.current === s.user.id) return;
        handledUid.current = s.user.id;
        void afterSignIn(localRef.current.linking);
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [afterSignIn, setMeta]);

  // A sign-in link that failed (expired or already used) comes back with an error in the URL.
  useEffect(() => {
    if (!supabase || !urlAuth.error) return;
    deps.current.toast(tr(`That link didn't work: ${urlAuth.error}. Try again.`, `Link itu tidak berfungsi: ${urlAuth.error}. Coba lagi.`));
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
    setLocal({ linking: false });
  }, [setLocal]);

  // Count edits made on this phone while linked, and send them shortly after.
  const lastEdits = useRef(store.edits);
  useEffect(() => {
    const added = store.edits - lastEdits.current;
    lastEdits.current = store.edits;
    if (added <= 0 || !isLinked()) return;
    setMeta({ pending: metaRef.current.pending + added });
    clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS);
  }, [store.edits, setMeta, syncNow]);

  // Online/offline, coming back to the app, and a slow pull for changes made on the PC.
  useEffect(() => {
    if (!supabase) return;
    const check = () => {
      if (document.visibilityState !== 'visible' || !sessionRef.current) return;
      if (isLinked()) void syncNow();
      else if (profileRef.current && !profileRef.current.can_sync && profileRef.current.parent_email) void afterSignIn(false);
    };
    const goOnline = () => { setOnline(true); check(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', check);
    const id = window.setInterval(() => {
      // Also retries after a failed request marked us offline without an 'offline' event.
      if (!onlineRef.current && navigator.onLine) setOnline(true);
      check();
    }, PULL_EVERY_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
      clearTimeout(pushTimer.current);
    };
  }, [syncNow, afterSignIn, setOnline]);

  const status: AccountStatus = !supabase ? 'off'
    : !session ? 'out'
    : meta.userId === session.user.id && (!profile || profile.can_sync) ? 'in'
    : profile && !profile.can_sync && profile.minor && profile.parent_email && profile.birth_year && !profile.deletion_at ? 'pendingConsent'
    : 'out';

  return useMemo<AccountValue>(() => {
    const sb = supabase!;
    const signedIn = async (s: Session | null) => {
      // The auth event may already have started the same flow.
      if (!s || handledUid.current === s.user.id) return;
      handledUid.current = s.user.id;
      await afterSignIn(true);
    };
    return {
      enabled: !!supabase,
      status,
      email: session?.user.email ?? null,
      profile,
      sync: { ...syncView(status, online, meta.pending, syncing), online, pending: meta.pending },
      local,
      link,
      finishing,

      dismissPrompt: () => setLocal({ promptDismissed: true }),

      signIn: async (email, password) => {
        setLocal({ linking: true, birthYear: null });
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setLocal({ linking: false }); return authMessage(error); }
        await signedIn(data.session);
        return null;
      },
      signUp: async (email, password, birthYear) => {
        setLocal({ linking: true, birthYear });
        const { data, error } = await sb.auth.signUp({
          email: email.trim(), password,
          options: { data: { birth_year: birthYear, privacy_agreed: true }, emailRedirectTo: appUrl() },
        });
        if (error) { setLocal({ linking: false, birthYear: null }); return authMessage(error); }
        // Email confirmation is on: the rest happens when they open the link.
        if (!data.session) { deps.current.go('verify'); return null; }
        await signedIn(data.session);
        return null;
      },
      google: async birthYear => {
        setLocal({ linking: true, birthYear });
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
        if (error) { setLocal({ linking: false, birthYear: null }); return authMessage(error); }
        return null; // The page now leaves for Google.
      },
      finishProfile: async birthYear => {
        const { error } = await sb.rpc('set_birth_year', { p_birth_year: birthYear });
        if (error) return authMessage(error);
        setFinishing(false);
        await afterSignIn(true);
        return null;
      },
      cancelSignIn: async () => {
        setFinishing(false);
        setLocal({ linking: false, birthYear: null });
        if (sessionRef.current && !isLinked()) await sb.auth.signOut({ scope: 'local' });
      },
      sendReset: async email => {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
        if (error) return authMessage(error);
        setLocal({ linking: true });
        return null;
      },
      setNewPassword: async password => {
        const { error } = await sb.auth.updateUser({ password });
        if (error) return authMessage(error);
        deps.current.toast(tr('Password changed.', 'Kata sandi sudah diganti.'));
        await afterSignIn(true);
        return null;
      },
      requestConsent: async parentEmail => {
        const { error } = await sb.functions.invoke('request-consent', { body: parentEmail ? { parentEmail: parentEmail.trim() } : {} });
        if (error) return functionError(error);
        await fetchProfile().catch(() => null);
        return null;
      },
      skipConsent: async () => {
        setLocal({ linking: false, birthYear: null });
        await sb.auth.signOut({ scope: 'local' });
        deps.current.go('home');
        deps.current.toast(tr('Saved on this phone only. You can sign in later from Settings.', 'Disimpan di HP ini saja. Kamu bisa masuk nanti dari Pengaturan.'));
      },
      signOut: async () => {
        await sb.auth.signOut({ scope: 'local' });
        clearPhone();
        deps.current.toast(tr('Signed out. This phone is cleared.', 'Sudah keluar. HP ini sudah dikosongkan.'));
      },
      deleteAccount: async () => {
        const { data, error } = await sb.functions.invoke('delete-account', { body: {} });
        if (error) return functionError(error);
        const at = (data as { deletionAt: string }).deletionAt;
        await sb.auth.signOut({ scope: 'local' });
        clearPhone({ deletionAt: at });
        deps.current.toast(tr(`Account set to be deleted on ${formatDay(at)}.`, `Akun dijadwalkan dihapus pada ${formatDay(at)}.`));
        return null;
      },
      restore: async () => {
        const { error } = await sb.rpc('cancel_deletion');
        if (error) return authMessage(error);
        setLocal({ deletionAt: null });
        deps.current.toast(tr('Deletion cancelled. Welcome back.', 'Penghapusan dibatalkan. Selamat datang kembali.'));
        await afterSignIn(true);
        return null;
      },
      keepDeletion: async () => {
        const at = profileRef.current?.deletion_at ?? null;
        setLocal({ deletionAt: at, linking: false });
        await sb.auth.signOut({ scope: 'local' });
        deps.current.go('home');
        deps.current.toast(tr(`Still scheduled for ${formatDay(at)}.`, `Tetap dijadwalkan pada ${formatDay(at)}.`));
      },
      retryLink: () => void startLink(),
    };
  }, [status, session, profile, online, meta.pending, syncing, local, link, finishing,
    setLocal, afterSignIn, fetchProfile, clearPhone, startLink]);
}

/** "Sat 3 Oct" from an ISO date. */
export const formatDay = (iso: string | null) => (iso ? shortDate(Date.parse(iso)) : '');
