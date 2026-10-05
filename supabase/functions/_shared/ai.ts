// Calls a free AI model for "Ask": NVIDIA NIM and OpenRouter, tried in the order set by the AI_PROVIDERS
// secret (default "nvidia,openrouter"). The first answer the caller accepts wins; if a provider is down,
// rate-limited or answers with something unreadable, the next one gets the same question.
//
// A provider is used only when both its key and its model secret are set, so removing a key switches it off.
// Nothing here knows about Deno: the caller passes in how to read a secret, which keeps it testable.

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface Provider {
  name: 'nvidia' | 'openrouter';
  url: string;
  key: string;
  model: string;
  /** Request fields this provider is known to accept, on top of the common ones. */
  extra: Record<string, unknown>;
  headers: Record<string, string>;
}

const TIMEOUT_MS = 20_000;

/** The providers that are switched on, in the order they will be tried. */
export function configuredProviders(get: (name: string) => string | undefined): Provider[] {
  const order = (get('AI_PROVIDERS') || 'nvidia,openrouter').split(',').map(s => s.trim().toLowerCase());
  const out: Provider[] = [];
  for (const name of order) {
    if (out.some(p => p.name === name)) continue;
    if (name === 'nvidia') {
      const key = get('NVIDIA_API_KEY'), model = get('NVIDIA_MODEL');
      if (key && model) {
        out.push({ name, url: 'https://integrate.api.nvidia.com/v1/chat/completions', key, model, extra: {}, headers: {} });
      }
    } else if (name === 'openrouter') {
      const key = get('OPENROUTER_API_KEY'), model = get('OPENROUTER_MODEL');
      if (key && model) {
        out.push({
          name, url: 'https://openrouter.ai/api/v1/chat/completions', key, model,
          extra: { response_format: { type: 'json_object' } },
          headers: { 'X-Title': 'Pocket Sense' },
        });
      }
    }
  }
  return out;
}

/**
 * Sends the conversation to each provider in turn and returns the first reply `accept` turns into a value.
 * Returns null when every provider failed. Logs only the provider, the status and a short error: never the
 * conversation or the model's answer, because both contain what the user logged.
 */
export async function askModels<T>(
  providers: Provider[],
  messages: ChatMessage[],
  accept: (text: string) => T | null,
  doFetch: typeof fetch = fetch,
): Promise<T | null> {
  for (const p of providers) {
    try {
      const res = await doFetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json', ...p.headers },
        body: JSON.stringify({ model: p.model, messages, max_tokens: 400, temperature: 0.3, ...p.extra }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(p.name, 'HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300));
        continue;
      }
      const out = await res.json().catch(() => null);
      const choice = out?.choices?.[0];
      const result = accept(String(choice?.message?.content ?? ''));
      if (result !== null) return result;
      console.error(p.name, 'unreadable answer, finish_reason', choice?.finish_reason ?? 'none');
    } catch (e) {
      console.error(p.name, 'failed:', e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}
