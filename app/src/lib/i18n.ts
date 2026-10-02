// English / Indonesian. Strings sit next to the code that shows them as tr('English', 'Indonesia'),
// so each screen reads top to bottom without looking anything up.
//
// The current language is a module value, not React state: App sets it on every render before
// any screen renders, and everything re-renders when it changes because App's state changed.

export type Lang = 'en' | 'id';

const LANG_KEY = 'pocket-sense:lang';
let current: Lang = 'en';

export const setLang = (l: Lang) => { current = l; };
export const getLang = () => current;
export const isId = () => current === 'id';

/** The string for the current language. */
export const tr = (en: string, id: string) => (current === 'id' ? id : en);

/** Language saved on this device, or the browser's language. Used before there is any app data. */
export function deviceLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'id') return saved;
  } catch {
    // Private mode: fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}

export function saveDeviceLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // Only means the next first launch guesses from the browser again.
  }
}

