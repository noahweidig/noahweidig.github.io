/**
 * Wire contract between the search dialog and the Groq-backed Worker at
 * /api/ai-search.
 *
 * The Worker answers with catalog *indices*, never URLs. The client resolves
 * them against the array it already holds from /search-index.json, so a model
 * that invents a page has no path into the DOM at all: an index outside the
 * array is dropped, and there is no field a fabricated href could arrive in.
 */

/** POST body. `q` is trimmed and capped by the Worker before it reaches Groq. */
export type AiSearchRequest = { q: string };

/** 200 response. Any other status means "no AI for this query" — see the
    degrade table in worker/README.md; the dialog hides the panel either way. */
export type AiSearchResponse = {
  /** Bumped when the shape changes, so an old cached reply is ignored. */
  v: 1;
  /** Plain text, at most two sentences. Never HTML. */
  answer: string;
  /** Indices into /search-index.json, most relevant first. */
  picks: number[];
};

/** The contract version the client sends and accepts. */
export const AI_SEARCH_VERSION = 1;

/** Longest query the Worker will forward. Also bounds the prompt. */
export const AI_QUERY_MAX = 200;

/** Most pages one answer may cite. */
export const AI_PICKS_MAX = 3;

/**
 * True when a query is worth an AI call at all.
 *
 * A bare noun ("publications") is navigation: the result list answers it and a
 * paragraph above it is an obstacle. A question, or anything with enough words
 * to carry a relationship, is where the deterministic engines fall short —
 * `scoreDoc` needs every term to match and the index holds no body text.
 *
 * Deliberately no character-count rule: "publications" is 12 characters.
 */
const QUESTION_WORD =
  /^(what|whats|who|whos|how|why|when|where|which|is|are|was|were|does|do|did|can|could|should|tell|explain|summar|compare|list|find)\b/i;

export const isAiWorthy = (q: string): boolean => {
  const trimmed = q.trim();
  if (trimmed.length < 6 || trimmed.length > AI_QUERY_MAX) return false;
  if (trimmed.endsWith('?')) return true;
  if (QUESTION_WORD.test(trimmed)) return true;
  return trimmed.split(/\s+/).filter(Boolean).length >= 3;
};

/** One canonical form for the client memo and the Worker's cache key. */
export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

/** Narrows an untrusted JSON body, clamping picks to `docCount`. */
export function parseAiResponse(body: unknown, docCount: number): AiSearchResponse | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (raw.v !== AI_SEARCH_VERSION) return null;
  if (typeof raw.answer !== 'string' || !raw.answer.trim()) return null;
  const picks = Array.isArray(raw.picks)
    ? raw.picks.filter(
        (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < docCount,
      )
    : [];
  return {
    v: AI_SEARCH_VERSION,
    answer: raw.answer.trim(),
    picks: [...new Set(picks)].slice(0, AI_PICKS_MAX),
  };
}
