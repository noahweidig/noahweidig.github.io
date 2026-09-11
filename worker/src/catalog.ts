import catalog from './catalog.json';

/** One record of /search-index.json. Kept local so the Worker has no runtime
    dependency on the site's source tree. */
type Doc = { t: string; u: string; s: string; d?: string; g?: string[] };

export const DOCS = catalog as Doc[];

/** Descriptions run to 240 chars in the index. Half that is enough to tell one
    paper from another, and it takes the prompt from ~6k tokens to ~4k — less
    prefill on every call, cached or not. */
const DESC_MAX = 140;

/**
 * The catalog as numbered lines, built once per isolate.
 *
 * Tags are dropped: they repeat what section and description already say, and
 * every token here is paid for on every request.
 */
export const CATALOG_LINES = DOCS.map((d, i) => {
  const desc = (d.d ?? '').slice(0, DESC_MAX);
  return desc ? `${i} | ${d.s} | ${d.t} - ${desc}` : `${i} | ${d.s} | ${d.t}`;
}).join('\n');
