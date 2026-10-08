// "Ask": answers a question about the user's own logged money with a free AI model, through NVIDIA NIM
// and/or OpenRouter (see _shared/ai.ts for the order and the secrets).
// POST { question, lang, context, history } with the user's session → { headline, body, price, item }
//
// The API keys stay here on the server; the app never sees them.
// What Ask may talk about, and the checks on its answers, are in _shared/ask-rules.ts.
// Ask is for 18+ only: nothing is sent to the AI for an under-18 user.
import { askModels, configuredProviders, type ChatMessage } from '../_shared/ai.ts';
import { readAnswer, SYSTEM } from '../_shared/ask-rules.ts';
import { isMinorOn } from '../_shared/age.ts';
import { admin, caller, fail, json, serve } from '../_shared/util.ts';

const DAILY_LIMIT = 30;
const MAX_QUESTION = 300;
const MAX_CONTEXT_CHARS = 16_000;
const MAX_HISTORY = 3;

const msg = (lang: string, en: string, id: string) => (lang === 'id' ? id : en);

serve(async req => {
  const db = admin();
  const user = await caller(req, db);
  if (!user) return fail('Sign in first.', 401);

  const body = await req.json().catch(() => null);
  const lang = body?.lang === 'id' ? 'id' : 'en';

  const { data: profile } = await db.from('profiles')
    .select('date_of_birth, deletion_at').eq('id', user.id).single();
  if (!profile || profile.date_of_birth == null || profile.deletion_at) {
    return fail(msg(lang, 'Finish setting up your account first.', 'Selesaikan pengaturan akunmu dulu.'), 403);
  }
  if (isMinorOn(profile.date_of_birth)) {
    return fail(msg(lang, 'Ask is for 18+', 'Tanya khusus usia 18+'), 403);
  }

  const question = String(body?.question ?? '').trim();
  if (!question) return fail(msg(lang, 'Type a question first.', 'Ketik pertanyaannya dulu.'));
  if (question.length > MAX_QUESTION) return fail(msg(lang, 'That question is too long.', 'Pertanyaannya terlalu panjang.'));
  const context = JSON.stringify(body?.context ?? {});
  if (context.length > MAX_CONTEXT_CHARS) return fail(msg(lang, 'Too much data to send. Try again later.', 'Datanya terlalu banyak. Coba lagi nanti.'));
  const history: { q: string; a: string }[] = Array.isArray(body?.history)
    ? body.history.slice(-MAX_HISTORY).map((t: { q?: unknown; a?: unknown }) => ({ q: String(t?.q ?? '').slice(0, MAX_QUESTION), a: String(t?.a ?? '').slice(0, 800) }))
    : [];

  // Checked before counting, so a missing key doesn't use up one of today's 30.
  const providers = configuredProviders(name => Deno.env.get(name));
  if (!providers.length) {
    console.error('Ask: no AI provider set up. Add NVIDIA_API_KEY + NVIDIA_MODEL and/or OPENROUTER_API_KEY + OPENROUTER_MODEL.');
    return fail(msg(lang, "Ask isn't switched on yet.", 'Fitur Tanya belum diaktifkan.'), 503);
  }

  // Counts the question before calling the model, so a failed call still uses one of today's 30.
  const { data: allowed, error } = await db.rpc('ask_take', { p_user: user.id, p_limit: DAILY_LIMIT });
  if (error) throw error;
  if (!allowed) {
    return fail(msg(lang, `That's ${DAILY_LIMIT} questions today. Ask again tomorrow.`, `Sudah ${DAILY_LIMIT} pertanyaan hari ini. Tanya lagi besok.`), 429);
  }

  // The history comes from the app, so anyone can forge it. It goes in as plain user text, never as
  // earlier "assistant" turns, or a made-up assistant reply could talk the model out of its rules.
  const earlier = history.map(t => `Q: ${t.q}\nA: ${t.a}`).join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `lang: ${lang}\ndata: ${context}` },
    ...(earlier ? [{ role: 'user', content: `Earlier in this chat, only for follow-up questions:\n${earlier}` } as const] : []),
    { role: 'user', content: question },
  ];

  const answer = await askModels(providers, messages, text => readAnswer(text, lang));
  if (!answer) {
    return fail(msg(lang, "Ask couldn't answer right now. Try again in a minute.", 'Fitur Tanya belum bisa menjawab sekarang. Coba lagi sebentar lagi.'), 502);
  }
  return json(answer);
});
