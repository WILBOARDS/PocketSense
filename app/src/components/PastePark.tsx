import { useState } from 'react';
import { tr } from '../lib/i18n';
import { readLink } from '../lib/share';
import { useUi } from '../ui';
import { LinkIcon } from './icons';

/** "Paste a Shopee or Tokopedia link" + Park. On a computer this stands in for the phone's Share button. */
export function PastePark({ title, note }: { title?: boolean; note?: boolean }) {
  const { think, toast } = useUi();
  const [text, setText] = useState('');

  const park = () => {
    const found = readLink(text.trim());
    if (!found) return toast(tr("That doesn't look like a link.", 'Itu sepertinya bukan link.'));
    think({ ...found, price: found.price || undefined, pasted: true });
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && <div className="t16 w8">{tr('Park something from a link', 'Parkir barang dari link')}</div>}
      <form style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }} onSubmit={e => { e.preventDefault(); park(); }}>
        <label className="paste-box">
          <LinkIcon size={18} />
          <input value={text} onChange={e => setText(e.target.value)} placeholder={tr('Paste a Shopee or Tokopedia link', 'Tempel link Shopee atau Tokopedia')}
            aria-label={tr('Product link', 'Link produk')} autoComplete="off" />
        </label>
        <button type="submit" className="btn btn-secondary" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }} disabled={!text.trim()}>
          {tr('Park', 'Parkir')}
        </button>
      </form>
      {note && (
        <div className="t13 muted pretty" style={{ lineHeight: 1.45 }}>
          {tr('We fill in what we can read from the link. You check it.', 'Kami isi apa yang bisa dibaca dari link. Kamu tinggal cek.')}
        </div>
      )}
    </div>
  );
}
