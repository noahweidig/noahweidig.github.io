/**
 * Bakes the search catalog into the Worker bundle.
 *
 * The Worker could fetch /search-index.json at runtime, but it is bound to
 * noahweidig.com/api/*, so that is a subrequest back into its own zone: a full
 * HTTPS round trip on the cold path, and under `wrangler dev` it silently
 * reads production. Baking it is deterministic, costs nothing at request time,
 * and makes the bundle hash the cache version.
 *
 * Run before every dev session and every deploy, so the staleness window is
 * one deploy.
 */
import { writeFile } from 'node:fs/promises';

const SOURCE = process.env.CATALOG_URL ?? 'https://noahweidig.com/search-index.json';
const OUT = new URL('../src/catalog.json', import.meta.url);
const MIN_DOCS = 50;

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} returned ${res.status}`);

const docs = await res.json();
if (!Array.isArray(docs)) throw new Error('catalog is not an array');
// A deploy carrying an empty catalog would answer every query with "not on
// this site", which is worse than no AI at all.
if (docs.length < MIN_DOCS)
  throw new Error(`catalog has ${docs.length} docs, expected >= ${MIN_DOCS}`);
// Counted here rather than read back off `docs`: everything reachable from the
// fetch is external input, and the log line is built from a local integer that
// nothing but this loop can write to. It is also the more useful number, since
// it counts documents that passed validation.
let valid = 0;
for (const [i, d] of docs.entries()) {
  if (!d || typeof d.t !== 'string' || typeof d.u !== 'string') {
    throw new Error(`doc ${i} is missing a title or url`);
  }
  valid += 1;
}

await writeFile(OUT, JSON.stringify(docs));
console.log(`catalog: ${valid} docs`);
