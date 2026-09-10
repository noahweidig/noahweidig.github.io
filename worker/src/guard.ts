import { AI_QUERY_MAX } from '../../src/lib/ai-search';

/**
 * Where the dialog is allowed to call from. This is not a security control —
 * any non-browser client sets whatever Origin it likes — it only stops the
 * endpoint being wired into someone else's page. The real bill ceiling is the
 * spend cap in the Groq dashboard; the real abuse control is the rate limiter.
 */
const ALLOWED_ORIGINS = new Set(['https://noahweidig.com', 'https://www.noahweidig.com']);

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const originAllowed = (req: Request, allowLocal = false): boolean => {
  const origin = req.headers.get('origin');
  // Absent Origin means a non-browser caller: allowed through to the rate
  // limiter, since a same-origin POST from the dialog always sends one.
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Netlify builds a preview per pull request; the host is generated.
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;

  // `astro dev` proxies /api to `wrangler dev` and the browser sends its own
  // localhost origin, so a strict list refuses every local request. The Worker
  // cannot tell it is local from the request: `wrangler dev` rewrites
  // request.url to the route's host (noahweidig.com). So this is opt-in through
  // .dev.vars, which is gitignored and never deployed.
  if (allowLocal) {
    try {
      return LOCAL_HOST.test(new URL(origin).host);
    } catch {
      return false;
    }
  }
  return false;
};

/** Null when the query is not worth forwarding. */
export function cleanQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw.trim().replace(/\s+/g, ' ');
  if (!q || q.length > AI_QUERY_MAX) return null;
  // A query of punctuation or digits alone has nothing for the model to match.
  if (!/[a-z]/i.test(q)) return null;
  return q;
}
