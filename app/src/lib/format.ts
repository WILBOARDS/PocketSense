const fmt = (n: number, digits: number) =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** $12.50, -$3.00, $1,170.00 */
export const money = (n: number) => (n < 0 ? '-$' : '$') + fmt(n, 2);

/** $120 or $12.50: drops the cents when they are zero. */
export const money0 = (n: number) => (n < 0 ? '-$' : '$') + fmt(n, Math.round(n * 100) % 100 === 0 ? 0 : 2);

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

export const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
