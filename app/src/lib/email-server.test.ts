import { describe, expect, it, vi } from 'vitest';
import { renderEmail, sendBrevoEmail } from '../../../supabase/functions/_shared/email';

const cfg = { apiKey: 'xkeysib-test', fromAddress: 'hello@example.com', fromName: 'Pocket Sense', replyTo: 'help@example.com' };

const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('sendBrevoEmail', () => {
  it("posts to Brevo's transactional endpoint with the api-key header and no Bearer token", async () => {
    const f = reply(201, { messageId: 'x' });
    await sendBrevoEmail(cfg, 'parent@example.org', 'Subject', ['One', 'Two'], { label: 'Open', url: 'https://app.test/?consent=abc' }, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const headers = init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('xkeysib-test');
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body.sender).toEqual({ name: 'Pocket Sense', email: 'hello@example.com' });
    expect(body.to).toEqual([{ email: 'parent@example.org' }]);
    expect(body.replyTo).toEqual({ email: 'help@example.com' });
    expect(body.subject).toBe('Subject');
    expect(body.htmlContent).toContain('https://app.test/?consent=abc');
    expect(body.textContent).toContain('Open: https://app.test/?consent=abc');
  });

  it('leaves replyTo out when there is no contact address yet', async () => {
    const f = reply(201);
    await sendBrevoEmail({ ...cfg, replyTo: undefined }, 'a@b.co', 'S', ['x'], undefined, f as unknown as typeof fetch);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).replyTo).toBeUndefined();
  });

  it("throws only Brevo's status and error code, never the reply body that can repeat the recipient", async () => {
    const f = reply(401, { code: 'unauthorized', message: 'Key not found for parent@example.org' });
    const err = await sendBrevoEmail(cfg, 'parent@example.org', 'S', ['x'], undefined, f as unknown as typeof fetch).catch(e => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Brevo 401 unauthorized');
    expect((err as Error).message).not.toContain('parent@example.org');
  });

  it('copes with a failure that is not JSON', async () => {
    const f = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    await expect(sendBrevoEmail(cfg, 'a@b.co', 'S', ['x'], undefined, f as unknown as typeof fetch)).rejects.toThrow('Brevo 502');
  });
});

describe('renderEmail', () => {
  it('escapes text and the link, so a hostile address or name cannot inject markup', () => {
    const { html } = renderEmail(['<script>alert(1)</script> & "quotes"'], { label: '<b>Go</b>', url: 'https://x.test/?a="b"' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Go</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;b&quot;');
  });

  it('says who sent it, and where to reply when a contact address is set', () => {
    expect(renderEmail(['x'], undefined, 'help@example.com').text).toContain('help@example.com');
    expect(renderEmail(['x'], undefined).text).toContain('Sent by Pocket Sense.');
  });
});
