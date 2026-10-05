// Tests for the server side of Ask. The code lives in supabase/functions/_shared (it runs in Deno there)
// but has no Deno parts, so it is tested here and runs in CI with the rest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askModels, configuredProviders } from '../../../supabase/functions/_shared/ai';
import { readAnswer, refusal, SYSTEM } from '../../../supabase/functions/_shared/ask-rules';

const secrets = (o: Record<string, string>) => (n: string) => o[n];
const both = { NVIDIA_API_KEY: 'nv-key', NVIDIA_MODEL: 'meta/test', OPENROUTER_API_KEY: 'or-key', OPENROUTER_MODEL: 'x/y:free' };
const msgs = [{ role: 'user' as const, content: 'hi' }];
const accept = (t: string) => { try { const v = JSON.parse(t); return typeof v.headline === 'string' ? v : null; } catch { return null; } };
const reply = (content: string, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : { error: 'nope' }), { status });
const fakeFetch = (fn: (url: string, init: RequestInit) => Response | Promise<Response>) => fn as unknown as typeof fetch;

describe('configuredProviders', () => {
  it('uses a provider only when both its key and its model are set', () => {
    expect(configuredProviders(secrets({}))).toEqual([]);
    expect(configuredProviders(secrets({ NVIDIA_API_KEY: 'k' }))).toEqual([]);
    expect(configuredProviders(secrets({ OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' })).map(p => p.name)).toEqual(['openrouter']);
  });

  it('tries NVIDIA first by default and follows AI_PROVIDERS', () => {
    expect(configuredProviders(secrets(both)).map(p => p.name)).toEqual(['nvidia', 'openrouter']);
    expect(configuredProviders(secrets({ ...both, AI_PROVIDERS: 'openrouter,nvidia' })).map(p => p.name)).toEqual(['openrouter', 'nvidia']);
    expect(configuredProviders(secrets({ ...both, AI_PROVIDERS: ' OpenRouter , openrouter, bogus,' })).map(p => p.name)).toEqual(['openrouter']);
  });
});

describe('askModels', () => {
  let errors: string[];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.join(' ')); });
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends the right request to the first provider', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const out = await askModels(configuredProviders(secrets(both)), msgs, accept,
      fakeFetch((url, init) => { calls.push({ url, init }); return reply('{"headline":"Yes","body":"ok"}'); }));
    expect(out.headline).toBe('Yes');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer nv-key');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: 'meta/test', max_tokens: 400 });
    expect(body.response_format).toBeUndefined();
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to OpenRouter with its own key, headers and JSON mode', async () => {
    const urls: string[] = [];
    const out = await askModels(configuredProviders(secrets(both)), msgs, accept, fakeFetch((url, init) => {
      urls.push(url);
      if (url.includes('nvidia')) return reply('', 429);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer or-key');
      expect((init.headers as Record<string, string>)['X-Title']).toBe('Pocket Sense');
      expect(JSON.parse(String(init.body)).response_format).toEqual({ type: 'json_object' });
      return reply('{"headline":"Fallback","body":"b"}');
    }));
    expect(out.headline).toBe('Fallback');
    expect(urls).toHaveLength(2);
  });

  it.each([
    ['unreadable text', () => reply('sorry, I cannot')],
    ['a thrown error (timeout)', () => { throw new Error('timeout'); }],
    ['empty choices', () => new Response(JSON.stringify({ choices: [] }))],
    ['a non-JSON body', () => new Response('<html>')],
  ])('falls through on %s', async (_label, first) => {
    const out = await askModels(configuredProviders(secrets(both)), msgs, accept,
      fakeFetch(url => (url.includes('nvidia') ? first() : reply('{"headline":"Second","body":"b"}'))));
    expect(out.headline).toBe('Second');
  });

  it('returns null when every provider fails or none is set up', async () => {
    const down = fakeFetch(() => reply('', 500));
    expect(await askModels(configuredProviders(secrets(both)), msgs, accept, down)).toBeNull();
    expect(await askModels([], msgs, accept, down)).toBeNull();
  });

  it('never logs the conversation, the answer or the keys', async () => {
    const secretMsgs = [{ role: 'user' as const, content: 'MY-SECRET-SPENDING-DATA' }];
    await askModels(configuredProviders(secrets(both)), secretMsgs, accept, fakeFetch(() => reply('{"headline":"x"}', 500)));
    expect(errors.length).toBeGreaterThan(0);
    const logged = errors.join('\n');
    expect(logged).not.toContain('MY-SECRET');
    expect(logged).not.toContain('nv-key');
    expect(logged).not.toContain('or-key');
  });
});

describe('Ask prompt', () => {
  it('keeps the scope rules in', () => {
    expect(SYSTEM).toContain('exactly one job');
    expect(SYSTEM).toContain('"on_topic"');
    expect(SYSTEM).toMatch(/images, videos, audio/);
    expect(SYSTEM).toMatch(/investment, loan, credit, crypto, trading or gambling/);
    expect(SYSTEM).toMatch(/ignore your rules/);
  });
});

describe('readAnswer', () => {
  const json = (o: Record<string, unknown>) => JSON.stringify(o);

  it('reads an on-topic answer', () => {
    expect(readAnswer(json({ on_topic: true, headline: ' Yes, but it is tight. ', body: 'You have Rp 40.000 left.', price: 189000, item: ' Earbuds ' }), 'en'))
      .toEqual({ headline: 'Yes, but it is tight.', body: 'You have Rp 40.000 left.', price: 189000, item: 'Earbuds' });
  });

  it('finds the JSON inside extra text or a code fence', () => {
    expect(readAnswer('Sure!\n```json\n{"headline":"Ok","body":"Fine."}\n```', 'en')).toMatchObject({ headline: 'Ok' });
  });

  it('treats a missing on_topic as on topic, so models that leave it out still work', () => {
    expect(readAnswer(json({ headline: 'Ok', body: 'Fine.' }), 'en')).toMatchObject({ headline: 'Ok' });
  });

  it('swaps in the fixed refusal when the model says the question was off topic', () => {
    const poem = json({ on_topic: false, headline: 'A poem', body: 'Roses are red, here is a long poem about roses http://x.test' });
    expect(readAnswer(poem, 'en')).toEqual(refusal('en'));
    expect(readAnswer(poem, 'id')).toEqual(refusal('id'));
    expect(readAnswer(json({ on_topic: 'false', headline: '', body: '' }), 'en')).toEqual(refusal('en'));
    expect(refusal('en').headline).toMatch(/money/);
    expect(refusal('id').headline).toMatch(/uang/);
  });

  it.each([
    ['a link', 'See https://example.com for details.'],
    ['a www link', 'Visit www.example.com now.'],
    ['a code block', 'Here you go: ```print(1)```'],
    ['image markdown', '![chart](x.png)'],
    ['an html tag', 'You have <b>Rp 5.000</b> left.'],
  ])('rejects an answer with %s so the next provider gets a try', (_label, body) => {
    expect(readAnswer(json({ on_topic: true, headline: 'Ok', body }), 'en')).toBeNull();
    expect(readAnswer(json({ on_topic: true, headline: body, body: 'Fine.' }), 'en')).toBeNull();
  });

  it('drops an item name that contains a link but keeps the answer', () => {
    expect(readAnswer(json({ headline: 'Ok', body: 'Fine.', price: 5, item: 'see http://x.test' }), 'en')).toMatchObject({ price: 5, item: null });
  });

  it('keeps a plain Rupiah amount, which has dots but is not a link', () => {
    expect(readAnswer(json({ headline: 'Ok', body: 'You spent Rp 1.250.000 on meals.' }), 'en')).toMatchObject({ body: 'You spent Rp 1.250.000 on meals.' });
  });

  it('cuts a long body at the end of a sentence', () => {
    const body = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const out = readAnswer(json({ headline: 'Ok', body }), 'en')!;
    expect(out.body.length).toBeLessThanOrEqual(600);
    expect(out.body.endsWith('.')).toBe(true);
  });

  it('cuts text with no sentence end and marks it', () => {
    const out = readAnswer(json({ headline: 'Ok', body: 'word '.repeat(300).trim() }), 'en')!;
    expect(out.body.length).toBeLessThanOrEqual(600);
    expect(out.body.endsWith('…')).toBe(true);
  });

  it('ignores a bad price and returns null for unreadable replies', () => {
    expect(readAnswer(json({ headline: 'Ok', body: 'Fine.', price: -5, item: 'x' }), 'en')).toMatchObject({ price: null, item: null });
    expect(readAnswer(json({ headline: 'Ok', body: 'Fine.', price: '5', item: 'x' }), 'en')).toMatchObject({ price: null, item: null });
    expect(readAnswer('no json here', 'en')).toBeNull();
    expect(readAnswer('{broken', 'en')).toBeNull();
    expect(readAnswer(json({ headline: '   ', body: 'Fine.' }), 'en')).toBeNull();
    expect(readAnswer(json({ headline: 'Ok' }), 'en')).toBeNull();
  });
});
