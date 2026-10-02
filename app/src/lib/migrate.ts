import type { Data } from './types';

/**
 * Fills in what older saved data doesn't have. Data saved before V1 has no currency, and every
 * amount in it was typed in dollars, so it stays in dollars rather than suddenly reading as Rupiah.
 */
export function normalize(d: Data): Data {
  if (d.settings.currency) return d;
  return { ...d, settings: { ...d.settings, currency: 'USD' } };
}
