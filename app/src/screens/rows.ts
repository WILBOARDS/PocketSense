import type { RowData } from '../components/common';
import { catShort } from '../lib/constants';
import { clock } from '../lib/dates';
import { classifier } from '../lib/derive';
import { money } from '../lib/format';
import type { Data, Purchase } from '../lib/types';

export function toRows(data: Data, purchases: Purchase[]): RowData[] {
  const cls = classifier(data);
  return purchases.map(p => ({
    id: p.id,
    name: p.name,
    amtStr: money(p.amt),
    meta: [catShort(p.cat), p.wallet, clock(p.at), p.mood].filter(Boolean).join(' · '),
    cls: cls(p).cls,
  }));
}

export const newestFirst = (a: Purchase, b: Purchase) => b.at - a.at;
