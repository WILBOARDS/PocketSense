import { useSyncExternalStore } from 'react';

/**
 * The layout follows the window's width, not the device: under 600px is the phone layout,
 * 600–1023px is half screen (a window snapped next to another app), 1024px and up is the full window.
 */
export type Layout = 'phone' | 'half' | 'full';

const half = typeof window !== 'undefined' ? window.matchMedia('(min-width: 600px)') : null;
const full = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;

const current = (): Layout => (full?.matches ? 'full' : half?.matches ? 'half' : 'phone');

function subscribe(onChange: () => void) {
  half?.addEventListener('change', onChange);
  full?.addEventListener('change', onChange);
  return () => {
    half?.removeEventListener('change', onChange);
    full?.removeEventListener('change', onChange);
  };
}

export const useLayout = () => useSyncExternalStore(subscribe, current, () => 'phone' as Layout);
