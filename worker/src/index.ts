/**
 * noahweidig.com/api/* — the Groq-backed half of the search dialog.
 *
 * The dialog's own engines (Pagefind and the fuzzy title index) never touch
 * this Worker. It adds a two-sentence answer and up to three cited pages on
 * top, so every failure path here is a silent 204/4xx/5xx that the client
 * turns into a hidden panel. See README.md for the degrade table.
 */
import { DOCS } from './catalog';
import { ask } from './groq';
import { cleanQuery, originAllowed } from './guard';
import { SYSTEM_PROMPT } from './prompt';
import { normalizeQuery } from '../../src/lib/ai-search';

type RateLimiter = { limit: (opts: { key: string }) => Promise<{ success: boolean }> };

export type Env = {
  GROQ_API_KEY?: string;
  AI_RATE_LIMIT?: RateLimiter;
  /** Set in .dev.vars only, so `astro dev`'s localhost origin is accepted
      locally. Never deployed: .dev.vars is gitignored and wrangler does not
      upload it. */
  ALLOW_LOCAL_ORIGINS?: string;
};

/** The cache namespace is derived from the prompt rather than hand-maintained:
    editing a rule in prompt.ts changes this, so yesterday's answers are never
    served against today's rules and there is no version constant to forget. */
let promptVersion: Promise<string> | null = null;
const cacheNamespace = () =>
  (promptVersion ??= sha256(SYSTEM_PROMPT).then((hex) => `v2-${hex.slice(0, 12)}`));

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers });

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** The cache key is a GET on a synthetic URL: Cache API keys are requests, and
    the real request is a POST, which it refuses to store. */
const cacheKey = async (query: string) =>
  new Request(`https://ai-search.invalid/${await cacheNamespace()}/${await sha256(query)}`);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/health') {
      return json({ ok: true, docs: DOCS.length, key: Boolean(env.GROQ_API_KEY) });
    }

    if (pathname !== '/api/ai-search') return empty(404);
    if (request.method !== 'POST') return empty(405, { allow: 'POST' });
    if (!originAllowed(request, env.ALLOW_LOCAL_ORIGINS === '1')) return empty(403);
    if (!env.GROQ_API_KEY) return empty(503);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return empty(400);
    }

    const query = cleanQuery((body as { q?: unknown } | null)?.q);
    if (!query) return empty(400);

    // Colo-local, no binding, no write limits. Workers KV was the obvious
    // alternative and the wrong one: a cold KV read costs 100-200 ms, which on
    // a miss is added to the Groq call, and its writes take up to a minute to
    // propagate — so the one case that would hit (a reader retyping the same
    // query) often misses anyway. The client's sessionStorage covers that case
    // properly; this covers "someone nearby already asked".
    const cache = caches.default;
    const key = await cacheKey(normalizeQuery(query));
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, hit);

    if (env.AI_RATE_LIMIT) {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await env.AI_RATE_LIMIT.limit({ key: ip });
      if (!success) return empty(429, { 'retry-after': '10' });
    }

    const result = await ask(query, env.GROQ_API_KEY);
    if (!result.ok) {
      return result.status === 429 ? empty(429, { 'retry-after': '10' }) : empty(result.status);
    }

    const res = json(result.value, 200, {
      'cache-control': 'public, max-age=604800',
      // Useful from `curl -i` when checking that the static prefix is actually
      // being cached upstream; costs one header.
      'x-groq-cached-tokens': String(result.cachedTokens),
    });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
} satisfies ExportedHandler<Env>;
