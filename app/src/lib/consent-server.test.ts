import { describe, expect, it } from 'vitest';
import { consentEmail, parentKey } from '../../../supabase/functions/_shared/consent';
import { renderEmail } from '../../../supabase/functions/_shared/email';

describe('parentKey', () => {
  it('treats +tags and Gmail dots as the same inbox', () => {
    const same = ['mama@gmail.com', 'Mama@Gmail.com', 'mama+pocket@gmail.com', 'm.a.m.a@gmail.com', 'ma.ma+1@googlemail.com'];
    expect(new Set(same.map(parentKey))).toEqual(new Set(['mama@gmail.com']));
  });
  it('keeps dots at other providers, where they can matter', () => {
    expect(parentKey('ma.ma@example.co.id')).toBe('ma.ma@example.co.id');
    expect(parentKey('ma.ma@example.co.id')).not.toBe(parentKey('mama@example.co.id'));
  });
  it('still drops a +tag at other providers', () => {
    expect(parentKey('mama+x@example.co.id')).toBe('mama@example.co.id');
  });
  it('does not throw on odd input', () => {
    expect(parentKey('')).toBe('');
    expect(parentKey('no-at-sign')).toBe('no-at-sign');
    expect(parentKey('+@gmail.com')).toBe('+@gmail.com');
  });
});

describe('consentEmail', () => {
  const mail = consentEmail('kid@example.com', 'https://app.test/?consent=tok');
  const all = mail.paragraphs.join('\n');

  it('is in both languages in one message', () => {
    expect(mail.subject).toContain('Approve Pocket Sense');
    expect(mail.subject).toContain('Setujui Pocket Sense');
    expect(all).toContain('— Bahasa Indonesia —');
    expect(mail.button.label).toContain('Tinjau dan setujui');
  });

  it('does not say nothing is stored: the account details and the parent address already are', () => {
    expect(all).not.toMatch(/nothing is stored/i);
    expect(all).toMatch(/Already held: their email address and date of birth, and your email address/);
    expect(all).toMatch(/Yang sudah kami simpan: alamat email dan tanggal lahir/);
  });

  it('lists what policy section 2 lists, and says Ask is not for under-18s', () => {
    for (const word of ['purchases (name, amount', 'income and savings', 'look-back', 'shop link', 'mood tags']) expect(all).toContain(word);
    expect(all).toMatch(/only for people 18 or older/);
    expect(all).toMatch(/18 tahun ke atas/);
  });

  it('renders with the link and escapes the child address', () => {
    const { html, text } = renderEmail(consentEmail('<b>x</b>@e.co', 'https://app.test/?a=1&b=2').paragraphs, mail.button, undefined);
    expect(html).not.toContain('<b>x</b>');
    expect(text).toContain('https://app.test/?consent=tok');
  });
});
