// Fetch Dimensions and Altmetric attention stats for every DOI'd publication
// and cache them in src/data/citation-stats.json.
//
// Both vendors' *documented* APIs are paid/gated: Altmetric's Details Page
// API has required a registered key for everyone since Nov 2025, and Dimensions'
// Metrics API license asks unregistered users to contact them first. The
// endpoints below are the ones their own free client-side badge widgets call
// (found by recording the network traffic those widgets generate) — open,
// keyless, and working today, but unofficial: neither is documented for
// external use and either could change or start blocking scripted requests
// without notice. Best-effort by design, same as the OpenAlex citation-count
// lookup in update-pubs.js: a bad day here keeps whatever the last successful
// run wrote rather than wiping the numbers off the site.
import fs from 'fs';
import path from 'path';

const pubsDir = path.resolve('src/content/publications');
const outFile = path.resolve('src/data/citation-stats.json');

// The Altmetric embed widget calls a versioned "internal" endpoint baked into
// its own embed.js bundle rather than the public v1 API. If this starts
// 404ing, load any publications page with `?altmetric-debug` network
// inspection open (or just watch the Network tab), find the request to
// api.altmetric.com/v1/internal-<hash>/doi/..., and update the hash here.
const ALTMETRIC_INTERNAL_VERSION = 'internal-556fdf0f';

const normalizeDoi = (doi) =>
  String(doi || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

function collectDois() {
  const dois = new Set();
  if (!fs.existsSync(pubsDir)) return dois;
  for (const entry of fs.readdirSync(pubsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(pubsDir, entry.name, 'index.md');
    if (!fs.existsSync(file)) continue;
    const fm = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const m = fm[1].match(/^pub-doi:\s*"((?:[^"\\]|\\.)*)"\s*$/m);
    if (m) dois.add(normalizeDoi(m[1].replace(/\\(.)/g, '$1')));
  }
  dois.delete('');
  return dois;
}

async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchDimensions(doi) {
  const data = await fetchJson(`https://metrics-api.dimensions.ai/doi/${encodeURIComponent(doi)}`);
  if (!data || !Number.isFinite(data.times_cited)) return undefined;
  return {
    timesCited: data.times_cited,
    recentCitations: Number.isFinite(data.recent_citations) ? data.recent_citations : null,
    fieldCitationRatio: Number.isFinite(data.field_citation_ratio)
      ? data.field_citation_ratio
      : null,
    relativeCitationRatio: Number.isFinite(data.relative_citation_ratio)
      ? data.relative_citation_ratio
      : null,
    url: `https://badge.dimensions.ai/details/doi/${doi}`,
  };
}

async function fetchAltmetric(doi) {
  const data = await fetchJson(
    `https://api.altmetric.com/v1/${ALTMETRIC_INTERNAL_VERSION}/doi/${encodeURIComponent(doi)}`,
  );
  if (!data || !Number.isFinite(data.score)) return undefined;
  return {
    score: data.score,
    postsCount: Number.isFinite(data.cited_by_posts_count) ? data.cited_by_posts_count : 0,
    detailsUrl:
      data.details_url ||
      (data.altmetric_id
        ? `https://www.altmetric.com/details/${data.altmetric_id}`
        : `https://www.altmetric.com/details/doi/${doi}`),
    // The vendor's own pre-built donut image, colored per mention type — not
    // something we can reconstruct ourselves (the `types` param it carries is
    // a data-derived code, not a fixed string).
    imageUrl: data.images?.small,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetries(fn, label) {
  let lastErr;
  for (let i = 1; i <= 3; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < 3) await sleep(1000 * i);
    }
  }
  console.warn(`${label} failed after retries: ${lastErr?.message ?? lastErr}`);
  return undefined;
}

async function main() {
  const dois = [...collectDois()].sort((a, b) => a.localeCompare(b));
  if (!dois.length) {
    console.log('No DOIs found; nothing to fetch.');
    return;
  }

  let existing = {};
  if (fs.existsSync(outFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    } catch {
      existing = {};
    }
  }

  const out = {};
  let dimOk = 0;
  let altOk = 0;
  for (const doi of dois) {
    const dimensions = await withRetries(() => fetchDimensions(doi), `Dimensions(${doi})`);
    // One request every few hundred ms is plenty polite for ~a few dozen DOIs
    // and keeps us well under anything either vendor might rate-limit on.
    await sleep(350);
    const altmetric = await withRetries(() => fetchAltmetric(doi), `Altmetric(${doi})`);
    await sleep(350);

    const prev = existing[doi] || {};
    const entry = {
      dimensions: dimensions ?? prev.dimensions,
      altmetric: altmetric ?? prev.altmetric,
    };
    if (dimensions) dimOk++;
    if (altmetric) altOk++;
    if (entry.dimensions || entry.altmetric) out[doi] = entry;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `Wrote stats for ${Object.keys(out).length} DOIs (Dimensions: ${dimOk}/${dois.length}, Altmetric: ${altOk}/${dois.length}).`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
