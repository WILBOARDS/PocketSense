// Reading a product link that was shared from a shop app (Android's Share button) or pasted in.
// Shop pages can't be fetched from the browser, so this only uses the text the shop app sends:
// usually a title or sentence with the product name, sometimes a price, and a link.
// The user always checks the result before parking it.

export interface Shared {
  name: string;
  price: number;
  url: string;
  src: string;
}

const SHOPS: [RegExp, string][] = [
  [/tokopedia|tokop\.e|tk\.tokopedia/i, 'Tokopedia'],
  [/shopee|shp\.ee/i, 'Shopee'],
  [/gofood|gojek|gojek\.link/i, 'GoFood'],
  [/grab/i, 'Grab'],
  [/lazada|lzd\.co/i, 'Lazada'],
  [/blibli/i, 'Blibli'],
  [/tiktok/i, 'TikTok Shop'],
  [/gramedia/i, 'Gramedia'],
  [/amazon|amzn\./i, 'Amazon'],
];

const URL_RE = /https?:\/\/\S+/i;

/** "Tokopedia" from a Tokopedia link, else the site's name ("example.com"), else "". */
export function shopName(url: string): string {
  const hit = SHOPS.find(([re]) => re.test(url));
  if (hit) return hit[1];
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The first price written like "Rp189.000", "Rp 189.000" or "$24.99", as a number. */
export function findPrice(text: string): number {
  const rp = text.match(/Rp\s?([\d.]+)/i);
  if (rp) return Number(rp[1].replace(/\./g, '')) || 0;
  const usd = text.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/);
  return usd ? parseFloat(usd[1].replace(',', '.')) || 0 : 0;
}

/** Strips the link, the price and the shops' usual filler words, keeping the product name. */
function cleanName(text: string): string {
  let t = text.replace(URL_RE, '');
  // Shops put the name first and the price after it ("X seharga Rp189.000. Dapatkan sekarang…").
  const price = t.search(/\s(seharga|harga|only|for)?\s*(Rp\s?\d|\$\s?\d)/i);
  if (price > 2) t = t.slice(0, price);
  return t
    .replace(/(seharga|harga|only|for)?\s*(Rp\s?[\d.]+|\$\s?\d+(?:[.,]\d{1,2})?)/gi, '')
    .replace(/^(cek|lihat|check out|beli|look at)\s+/i, '')
    .replace(/\s*(di|on|at)\s+(tokopedia|shopee|lazada|blibli|gofood|tiktok shop)\b.*$/i, '')
    .replace(/[!.\s|-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Reads what a shop app sent. Null when there's nothing useful in it. */
export function readShared(title: string, text: string, url: string): Shared | null {
  const link = url || text.match(URL_RE)?.[0] || '';
  const name = cleanName(title) || cleanName(text);
  if (!link && !name) return null;
  return { name, price: findPrice(`${title} ${text}`), url: link, src: link ? shopName(link) : '' };
}

/** A pasted link on its own: the name comes from the readable part of the address, if any. */
export function readLink(pasted: string): Shared | null {
  const link = pasted.match(URL_RE)?.[0] ?? (/^[\w-]+(\.[\w-]+)+\//.test(pasted.trim()) ? `https://${pasted.trim()}` : '');
  if (!link) return readShared('', pasted, '');
  let name = '';
  try {
    // Shop links often end in the product's name: /tote-bag-kanvas-i.2291 → "Tote bag kanvas"
    const slug = new URL(link).pathname.split('/').filter(Boolean).pop() ?? '';
    const words = decodeURIComponent(slug).replace(/[-_]i\.\d.*$/, '').replace(/\.\w+$/, '').split(/[-_]+/)
      .filter(w => w && !/^\d+$/.test(w) && w.length < 30);
    if (words.length >= 2) name = (words.join(' ')[0].toUpperCase() + words.join(' ').slice(1)).slice(0, 60);
  } catch {
    // Not a valid address after all: leave the name for the user to type.
  }
  return { name, price: findPrice(pasted), url: link, src: shopName(link) };
}
