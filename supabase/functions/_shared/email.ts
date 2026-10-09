// Sends one plain email through Brevo's transactional API (https://developers.brevo.com).
// Nothing here knows about Deno: the caller passes the settings and, in tests, a fake fetch.
//
// Errors carry only Brevo's status and error code. Brevo's full reply can repeat the recipient's address,
// and the caller logs whatever is thrown.

export interface EmailConfig {
  apiKey: string;
  /** Must be a sender verified in Brevo. */
  fromAddress: string;
  fromName: string;
  /** Where replies go, shown in the footer. Optional until the project has a contact address. */
  replyTo?: string;
}

export interface EmailButton { label: string; url: string }

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderEmail(paragraphs: string[], button: EmailButton | undefined, replyTo?: string) {
  const footer = replyTo
    ? `Sent by Pocket Sense. Questions about this email: ${replyTo}`
    : 'Sent by Pocket Sense.';
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">',
    '<p style="font-size:18px;font-weight:800;margin:0 0 16px">Pocket Sense</p>',
    ...paragraphs.map(p => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`),
    button
      ? `<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
      : '',
    `<p style="margin:24px 0 0;font-size:13px;color:#555">${escapeHtml(footer)}</p>`,
    '</div>',
  ].join('');
  const text = [...paragraphs, button ? `${button.label}: ${button.url}` : '', footer].filter(Boolean).join('\n\n');
  return { html, text };
}

export async function sendBrevoEmail(
  cfg: EmailConfig,
  to: string,
  subject: string,
  paragraphs: string[],
  button?: EmailButton,
  doFetch: typeof fetch = fetch,
): Promise<void> {
  const { html, text } = renderEmail(paragraphs, button, cfg.replyTo);
  const res = await doFetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: cfg.fromName, email: cfg.fromAddress },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(cfg.replyTo ? { replyTo: { email: cfg.replyTo } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const code = await res.json().then(b => (typeof b?.code === 'string' ? b.code : ''), () => '');
    throw new Error(`Brevo ${res.status}${code ? ` ${code}` : ''}`);
  }
}
