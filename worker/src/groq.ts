import { SYSTEM_PROMPT } from './prompt';
import { DOCS } from './catalog';
import { AI_SEARCH_VERSION, parseAiResponse, type AiSearchResponse } from '../../src/lib/ai-search';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * gpt-oss-20b is the fastest production model on Groq (~1000 tok/s) and one of
 * the three that prompt caching covers at all.
 *
 * reasoning_effort matters more than anything else here: left at its default
 * the model spent 94 reasoning tokens deciding that a one-line catalog entry
 * answered the question. At "low" the same queries came back in 39-61
 * reasoning tokens and ~115 ms of server time.
 */
const MODEL = 'openai/gpt-oss-20b';

/** Prose is capped at two sentences, but the JSON envelope and the reasoning
    tokens are billed from the same budget — 160 truncated whole answers. */
const MAX_TOKENS = 220;

const TIMEOUT_MS = 6000;

type GroqReply = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens_details?: { cached_tokens?: number } };
};

export type AskResult =
  | { ok: true; value: AiSearchResponse; cachedTokens: number }
  | { ok: false; status: 204 | 429 | 502 };

/**
 * When Groq's quota bucket is empty, stop calling until it refills.
 *
 * The limit that binds is tokens per minute, not requests: a free key is capped
 * at 8,000 TPM and this prompt is ~3,300 tokens, so the third call in a minute
 * is refused. Without this, every query during a throttle spends a request on a
 * guaranteed 429 and waits on the round trip to learn it. Module scope, so it
 * is per isolate rather than global — good enough to stop a burst, and it
 * cannot wrongly refuse for longer than Groq asked for.
 */
let cooldownUntil = 0;

const enterCooldown = (retryAfter: string | null) => {
  const seconds = Number(retryAfter);
  cooldownUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 10_000);
};

/** One call, strictly validated. Anything unexpected degrades to "no answer"
    rather than to an error the dialog would have to render. */
export async function ask(query: string, apiKey: string): Promise<AskResult> {
  if (Date.now() < cooldownUntil) return { ok: false, status: 429 };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          // Static first, dynamic last: the prompt cache matches on a prefix.
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  if (res.status === 429) {
    enterCooldown(res.headers.get('retry-after'));
    return { ok: false, status: 429 };
  }
  if (!res.ok) return { ok: false, status: 502 };

  let reply: GroqReply;
  try {
    reply = (await res.json()) as GroqReply;
  } catch {
    return { ok: false, status: 502 };
  }

  const content = reply.choices?.[0]?.message?.content;
  if (!content) return { ok: false, status: 204 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, status: 204 };
  }

  // The model returns { answer, picks }; the version is ours to stamp.
  const value = parseAiResponse(
    { ...(parsed as Record<string, unknown>), v: AI_SEARCH_VERSION },
    DOCS.length,
  );
  if (!value) return { ok: false, status: 204 };

  return { ok: true, value, cachedTokens: reply.usage?.prompt_tokens_details?.cached_tokens ?? 0 };
}
