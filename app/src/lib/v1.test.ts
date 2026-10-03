import { afterEach, describe, expect, it } from 'vitest';
import { askContext, isAnswer } from './ask';
import { classify } from './classify';
import { catShort, purchaseName } from './constants';
import { dayLabel, headDate, timeLeft, weekRange } from './dates';
import { money, money0, parseAmount, setCurrency, typeAmount } from './format';
import { setLang } from './i18n';
import { normalize } from './migrate';
import { findPrice, readLink, readShared, shopName } from './share';
import { emptyData } from './store';
import { maskEmail } from './sync';
import type { Data } from './types';

// Thu 1 Oct 2026, 14:00 local
const NOW = new Date(2026, 9, 1, 14, 0).getTime();
const base = (): Data => emptyData({ weekMoney: 350000, incomeSources: [], wallets: [], threshold: 15, currency: 'IDR' }, null);

afterEach(() => {
  setLang('en');
  setCurrency('USD');
});

describe('Rupiah', () => {
  it('formats whole Rupiah with dots for thousands', () => {
    setCurrency('IDR');
    expect(money(148000)).toBe('Rp 148.000');
    expect(money0(1200000)).toBe('Rp 1.200.000');
    expect(money(-41000)).toBe('-Rp 41.000');
    expect(money(25000.4)).toBe('Rp 25.000');
  });
  it('types and reads amounts', () => {
    setCurrency('IDR');
    expect(typeAmount('189000')).toBe('189.000');
    expect(typeAmount('Rp 1.250.000')).toBe('1.250.000');
    expect(typeAmount('007')).toBe('7');
    expect(parseAmount('189.000')).toBe(189000);
    setCurrency('USD');
    expect(typeAmount('12.345')).toBe('12.34');
    expect(parseAmount('12.5')).toBe(12.5);
  });
});

describe('Indonesian', () => {
  it('dates and times', () => {
    setLang('id');
    expect(headDate(NOW)).toBe('Kam, 1 Okt');
    expect(weekRange(NOW)).toBe('28 Sep–4 Okt');
    expect(dayLabel(NOW, NOW)).toBe('Hari ini · Kam 1 Okt');
    expect(timeLeft(18 * 60 * 60000)).toBe('18 jam lagi');
    expect(timeLeft(40 * 60000)).toBe('40 mnt lagi');
    expect(timeLeft((2 * 1440 + 4 * 60) * 60000)).toBe('2 hr 4 jam lagi');
  });
  it('category names and reasons', () => {
    setLang('id');
    expect(catShort('snacks')).toBe('Jajan');
    const d = base();
    const p = { id: 'p1', name: 'Snacks', cat: 'snacks' as const, amt: 18000, wallet: 'GoPay', mood: 'Bored', at: NOW };
    d.purchases = [p];
    // Saved under the English category name, shown in Indonesian.
    expect(purchaseName(p)).toBe('Jajan');
    expect(purchaseName({ ...p, name: 'Kopi susu' })).toBe('Kopi susu');
    const c = classify(p, { all: d.purchases, rules: {}, lessons: [] });
    expect(c.cls).toBe('want');
    expect(c.reasons[0]).toBe('Jajan & minuman biasanya Ingin');
  });
});

describe('older data', () => {
  it('stays in dollars', () => {
    const d = base();
    delete d.settings.currency;
    expect(normalize(d).settings.currency).toBe('USD');
    expect(normalize(base()).settings.currency).toBe('IDR');
  });
});

describe('shared links', () => {
  it('names the shop', () => {
    expect(shopName('https://tk.tokopedia.com/ZSabc/')).toBe('Tokopedia');
    expect(shopName('https://id.shp.ee/xyz')).toBe('Shopee');
    expect(shopName('https://www.example.com/a')).toBe('example.com');
  });
  it('finds a price', () => {
    expect(findPrice('Earbuds TWS seharga Rp189.000. Dapatkan sekarang')).toBe(189000);
    expect(findPrice('Only $24.99 today')).toBe(24.99);
    expect(findPrice('no price here')).toBe(0);
  });
  it('reads what a shop app shares', () => {
    expect(readShared('', 'Lihat Earbuds TWS BT 5.3 seharga Rp189.000. Dapatkan sekarang di Shopee! https://id.shp.ee/abc', ''))
      .toEqual({ name: 'Earbuds TWS BT 5.3', price: 189000, url: 'https://id.shp.ee/abc', src: 'Shopee' });
    expect(readShared('Sneakers putih', '', 'https://tokopedia.com/toko/sneakers-putih'))
      .toEqual({ name: 'Sneakers putih', price: 0, url: 'https://tokopedia.com/toko/sneakers-putih', src: 'Tokopedia' });
    expect(readShared('', '', '')).toBeNull();
  });
  it('reads a pasted link', () => {
    expect(readLink('shopee.co.id/tote-bag-kanvas-i.2291.12345')).toEqual({
      name: 'Tote bag kanvas', price: 0, url: 'https://shopee.co.id/tote-bag-kanvas-i.2291.12345', src: 'Shopee',
    });
  });
});

describe('Ask', () => {
  it('sends a summary without account details', () => {
    setCurrency('IDR');
    const d = base();
    d.goal = { name: 'Concert ticket', target: 1200000 };
    d.purchases = [{ id: 'p1', name: 'Nasi padang', cat: 'meals', amt: 22000, wallet: 'OVO', mood: null, at: NOW - 3600_000 }];
    const ctx = askContext(d, NOW);
    expect(ctx.currency).toBe('IDR');
    expect(ctx.week).toMatchObject({ money: 350000, spent: 22000, left: 328000, day: 4 });
    expect(ctx.purchases[0]).toMatchObject({ name: 'Nasi padang', category: 'Meals', class: 'need', amount: 22000 });
    expect(JSON.stringify(ctx)).not.toMatch(/@|birth/i);
  });
  it('only accepts well-formed answers', () => {
    expect(isAnswer({ headline: "Yes, but it's tight.", body: 'You have Rp 148.000 left.', price: 189000, item: 'Earbuds' })).toBe(true);
    expect(isAnswer({ headline: 'Sure', body: 'ok', price: null, item: null })).toBe(true);
    expect(isAnswer({ headline: 'Sure', body: 'ok', price: -5, item: null })).toBe(false);
    expect(isAnswer({ headline: 'Sure' })).toBe(false);
    expect(isAnswer('Yes')).toBe(false);
  });
});

describe('Settings', () => {
  it('masks the email', () => {
    expect(maskEmail('rina@example.com')).toBe('r***@example.com');
    expect(maskEmail(null)).toBe('');
  });
});
