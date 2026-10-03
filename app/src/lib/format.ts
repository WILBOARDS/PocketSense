import type { Currency } from './types';

// Like the language, the currency is a module value that App sets before rendering (see i18n.ts).
let currency: Currency = 'USD';
export const setCurrency = (c: Currency) => { currency = c; };
export const getCurrency = () => currency;
export const isRupiah = () => currency === 'IDR';

const usd = (n: number, digits: number) =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** Rupiah has no cents in daily use and groups thousands with dots: 25.000 */
const idr = (n: number) => Math.round(Math.abs(n)).toLocaleString('id-ID');

/** $12.50, -$3.00, $1,170.00 · Rp 25.000, -Rp 41.000 */
export const money = (n: number) =>
  currency === 'IDR' ? `${n < 0 ? '-' : ''}Rp ${idr(n)}` : (n < 0 ? '-$' : '$') + usd(n, 2);

/** $120 or $12.50: drops the cents when they are zero. Rupiah is always whole. */
export const money0 = (n: number) =>
  currency === 'IDR' ? money(n) : (n < 0 ? '-$' : '$') + usd(n, Math.round(n * 100) % 100 === 0 ? 0 : 2);

/** For "about …" estimates: Rupiah to the nearest thousand. Dollars stay as they are. */
export const roughly = (n: number) => (currency === 'IDR' ? Math.round(n / 1000) * 1000 : n);

/** The symbol in front of an amount field. */
export const currencySymbol = () => (currency === 'IDR' ? 'Rp' : '$');

export const pad = (n: number) => String(n).padStart(2, '0');

export const ord = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + 'th';
  return n + (n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
};

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Keeps digits and a single dot, at most 2 decimals. */
export const cleanAmount = (s: string) => {
  const [whole, ...rest] = s.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

/**
 * What an amount field keeps while typing. Dollars: digits and up to 2 decimals.
 * Rupiah: digits only, shown with thousands dots ("189.000"), because a dot is never a decimal there.
 */
export const typeAmount = (s: string) => {
  if (currency !== 'IDR') return cleanAmount(s);
  const digits = s.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
  return digits ? Number(digits).toLocaleString('id-ID') : '';
};

/** The number in an amount field typed with typeAmount. */
export const parseAmount = (s: string) =>
  currency === 'IDR' ? Number(s.replace(/\D/g, '')) || 0 : parseFloat(s) || 0;

/** A number as it appears in an amount field, the reverse of parseAmount. */
export const amountText = (n: number) => (n > 0 ? typeAmount(currency === 'IDR' ? String(Math.round(n)) : String(n)) : '');

export const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
