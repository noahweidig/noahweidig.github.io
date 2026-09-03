// Fetch the owner's Zotero "My Publications" library and regenerate
// src/content/publications/<slug>/index.md for the Astro site, plus the
// downloadable cite.bib / PDF under public/publications/<slug>/.
// No npm dependencies — plain Node 22+.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const userID = process.env.ZOTERO_USER_ID || 11988712;
const pubsDir = path.resolve('src/content/publications');
// The .bib and .pdf files are linked from the page, so they ship as static
// assets rather than living inside the content collection.
const assetsDir = path.resolve('public/publications');

const OWNER_FAMILY = 'weidig';
const OWNER_GIVEN_PREFIX = 'noah';

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function stripHtml(html) {
  if (!html) return '';
  // Strip tags until the output stabilizes: a single pass can leave markup
  // behind (e.g. "<scr<b></b>ipt>" → "<script>"), which CodeQL flags as
  // incomplete multi-character sanitization. The optional ">" keeps the
  // regex linear-time (no rescanning past unclosed "<") and drops dangling
  // unterminated tags too.
  let text = String(html);
  let prev;
  do {
    prev = text;
    text = text.replace(/<[^>]*>?/g, '');
  } while (text !== prev);
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/\s+/g, ' ')
    .trim();
}

// Cut a blurb to `budget` characters without ending mid-sentence.
//
// The description this produces is used three times — the card summary, the
// page's <meta name="description">, and the generated OG card — so a cut that
// lands mid-word ("However, the spatial…") is visible in search results and
// social previews (#253). Prefer the last complete sentence inside the budget;
// only when there is no sentence break worth keeping does it fall back to a
// word-boundary cut with an ellipsis.
function trimToSentence(text, budget = 240) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s.length <= budget) return s;
  const head = s.slice(0, budget + 1);
  let end = -1;
  for (const m of head.matchAll(/[.!?](?=["'’”)\]]{0,3}(?:\s|$))/g)) end = m.index + 1;
  // A single very short opening sentence would throw the blurb away, so only
  // accept a sentence cut that keeps a useful amount of text.
  if (end >= Math.min(80, budget)) return s.slice(0, end);
  const cut = s.slice(0, budget);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s.,;:]+$/, '') + '…';
}

function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

function isOwner(c) {
  if (!c) return false;
  const family = (c.lastName || '').trim().toLowerCase();
  const given = (c.firstName || '').trim().toLowerCase();
  if (family === OWNER_FAMILY && given.startsWith(OWNER_GIVEN_PREFIX)) return true;
  if (c.name) {
    const s = slugify(c.name);
    if (s === 'noah-weidig' || s === 'noah-c-weidig') return true;
  }
  return false;
}

// "Victoria M. Donovan" -> "Donovan, V. M."; owner is bolded.
function citeName(c) {
  let out;
  if (c.lastName) {
    const initials = (c.firstName || '')
      .split(/[\s.]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + '.')
      .join(' ');
    out = initials ? `${c.lastName}, ${initials}` : c.lastName;
  } else {
    out = (c.name || '').trim();
  }
  return isOwner(c) ? `**${out}**` : out;
}

function joinAuthors(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

const TYPE_MAP = {
  journalArticle: 'Journal Article',
  thesis: 'Thesis',
  presentation: 'Presentation',
  conferencePaper: 'Presentation',
  preprint: 'Preprint',
  magazineArticle: 'Media Coverage',
  newspaperArticle: 'Media Coverage',
  blogPost: 'Media Coverage',
  webpage: 'Media Coverage',
  book: 'Book',
  bookSection: 'Book Chapter',
  report: 'Report',
};

function categorize(it) {
  const hay = [it.data.title, it.data.event, it.data.genre, it.data.presentationType]
    .filter(Boolean)
    .join(' ');
  if (/\bwebinar\b/i.test(hay)) return 'Webinar';
  if (/referee report/i.test(it.data.title || '')) return 'Peer Review';
  return TYPE_MAP[it.data.itemType] || 'Publication';
}

async function fetchAllItems(startUrl) {
  const items = [];
  let url = startUrl;
  while (url) {
    let res, lastErr;
    for (let i = 1; i <= 3; i++) {
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (res.ok) break;
        if ((res.status === 429 || res.status >= 500) && i < 3) {
          const ra = +(res.headers.get('retry-after') || res.headers.get('backoff') || 0);
          await new Promise((r) => setTimeout(r, ra > 0 ? ra * 1000 : 1000 * i));
          continue;
        }
        throw new Error(`Zotero API error (${res.status})`);
      } catch (err) {
        lastErr = err;
        if (i < 3) {
          await new Promise((r) => setTimeout(r, 1000 * i));
          continue;
        }
        throw new Error(`Zotero API request failed: ${err?.message ?? err}`, { cause: err });
      }
    }
    if (!res?.ok) throw new Error(`Zotero API error: ${lastErr?.message || 'transient failure'}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error('Zotero API response was not a JSON array.');
    items.push(...page);
    const link = res.headers.get('link') || '';
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return items;
}

const extractYear = (s) => {
  const m = s?.match(/\b(19|20)\d{2}\b/);
  return m ? +m[0] : 0;
};

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const clampDay = (y, m, d) => Math.min(Math.max(d, 1), daysInMonth(y, m));

function parseZoteroDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) {
    const y = +m[1],
      mo = +m[2],
      d = m[3] ? +m[3] : 1;
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const mo = +m[1],
      d = +m[2],
      y = +m[3];
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }
  m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }
  const yearM = s.match(/\b(19|20)\d{2}\b/);
  const monthM = s.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
  );
  const dayM = s.match(/\b([0-3]?\d)(?:st|nd|rd|th)?\b/);
  if (yearM) {
    const y = +yearM[0];
    const mo = monthM ? MONTHS[monthM[1].toLowerCase()] : null;
    let d = null;
    if (dayM && monthM) {
      const c = +dayM[1];
      if (c >= 1 && c <= 31 && String(c) !== String(y)) d = c;
    }
    return { y, m: mo || 1, d: clampDay(y, mo || 1, d || 1) };
  }
  return null;
}

const FILLER = new Set([
  'a',
  'an',
  'the',
  'of',
  'and',
  'or',
  'but',
  'for',
  'to',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'is',
  'are',
  'be',
]);

function titleWords(title) {
  return String(title || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function firstAuthorLastName(creators) {
  for (const c of creators || []) {
    if (!c) continue;
    if (c.lastName) return c.lastName;
    if (c.name) {
      const p = c.name.trim().split(/\s+/);
      if (p.length) return p[p.length - 1];
    }
  }
  return '';
}

function buildSlug(creators, title, year) {
  const last = slugify(firstAuthorLastName(creators)) || 'anon';
  const words = titleWords(title)
    .filter((w) => !FILLER.has(w.toLowerCase()))
    .slice(0, 2)
    .map(slugify)
    .filter(Boolean);
  return `${last}-${words.length ? words.join('-') : 'untitled'}-${year ? String(year).slice(-2) : 'nd'}`;
}

// ---------------------------------------------------------------------------
// Citation counts (OpenAlex).
//
// OpenAlex is free and needs no key; a single filtered request covers every
// DOI in the library. Best-effort by design: if the lookup fails, the numbers
// already committed in the frontmatter are kept, so a bad API day can never
// wipe the impact numbers off the publications page. Entries without a DOI —
// talks, media, most presentations — simply have no count.
const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO || 'noah@noahweidig.com';

const normalizeDoi = (doi) =>
  String(doi || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

async function fetchCitationCounts(dois) {
  const unique = [...new Set(dois.map(normalizeDoi).filter(Boolean))];
  if (!unique.length) return new Map();
  const out = new Map();
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const url =
      `https://api.openalex.org/works?per-page=50&select=doi,cited_by_count,open_access` +
      `&filter=doi:${chunk.map(encodeURIComponent).join('|')}&mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`OpenAlex API error (${res.status})`);
    const page = await res.json();
    for (const work of page?.results || []) {
      const key = normalizeDoi(work.doi);
      if (!key) continue;
      out.set(key, {
        citations: Number.isFinite(work.cited_by_count) ? work.cited_by_count : 0,
        oa: !!work.open_access?.is_oa,
      });
    }
  }
  return out;
}

// Whatever the last successful run wrote, so a failed lookup keeps the page
// as it was instead of blanking it.
function readExistingMetrics(file) {
  if (!fs.existsSync(file)) return {};
  const fm = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return {};
  const cites = fm[1].match(/^pub-citations:\s*(\d+)\s*$/m);
  return {
    citations: cites ? Number(cites[1]) : undefined,
    oa: /^pub-oa:\s*true\s*$/m.test(fm[1]) || undefined,
  };
}

// Minimal YAML scalar quoting: always double-quote and escape.
const yq = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// ---------------------------------------------------------------------------
// Repeat appearances of one work (#253).
//
// Zotero exports one record per *appearance*, so a talk given at three
// conferences — or the same talk filed once as a Presentation and once as a
// Webinar — arrives as three separate items with the same title and the same
// abstract. Rendered one row each, the publications page reads as padding
// rather than as one well-travelled piece of work.
//
// Each cluster of same-title items therefore keeps its own page (URLs already
// published must not 404), but only the most recent one is listed, and it
// carries the whole run of venues in `pub-appearances`. Journal articles,
// preprints and theses are never clustered: a paper and a talk that share a
// title are genuinely different outputs and both belong on the page.
const NEVER_GROUPED = new Set(['Journal Article', 'Preprint', 'Thesis']);

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function whenLabel(date, year) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date || '');
  if (m) return `${MONTH_NAMES[+m[2] - 1]} ${m[1]}`;
  return year ? String(year) : '';
}

const workKey = (title) =>
  titleWords(title)
    .map((w) => w.toLowerCase())
    .join(' ');

function groupAppearances(records) {
  const groups = new Map();
  for (const rec of records) {
    if (NEVER_GROUPED.has(rec.category)) continue;
    const key = workKey(rec.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }

  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort(
      (a, b) => (a.date || '').localeCompare(b.date || '') || a.slug.localeCompare(b.slug),
    );
    // The most recent appearance is the listed one, so the row sorts by the
    // latest date the work was presented.
    const canonical = members[members.length - 1];
    canonical.appearances = members.map((m) => ({
      venue: m.venue,
      when: whenLabel(m.date, m.year),
      kind: m.category,
      url: m.link,
    }));
    canonical.categories = [
      canonical.category,
      ...members.map((m) => m.category).filter((c) => c !== canonical.category),
    ].filter((c, i, all) => all.indexOf(c) === i);
    for (const m of members) if (m !== canonical) m.appearanceOf = canonical;
  }
}

// The venue line: whichever of Zotero's many container fields this item type
// actually fills.
function venueOf(data) {
  const isThesis = data.itemType === 'thesis';
  return (
    data.publicationTitle ||
    data.bookTitle ||
    data.proceedingsTitle ||
    data.meetingName ||
    data.event ||
    (isThesis ? data.university || data.publisher : data.place || data.publisher) ||
    ''
  );
}

// Not every Zotero record carries an abstract, and a page with no
// `description` gets no <meta name="description"> and no Open Graph blurb —
// it just shows up bare in search results. Fall back to the citation the page
// already displays, which is at least an accurate summary.
function citationBlurb(category, authorsHtml, year, venue) {
  const who = stripHtml(authorsHtml).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return [
    `${category}${who ? ` by ${who}` : ''}${year ? ` (${year})` : ''}.`,
    venue ? `${venue.replace(/\*/g, '')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// "vol. 12, no. 3, pp. 1-20", from whichever parts the record has.
function detailsOf(data) {
  const str = (v) => (v == null ? '' : String(v).trim());
  const bits = [];
  if (str(data.volume)) bits.push(`vol. ${str(data.volume)}`);
  if (str(data.issue)) bits.push(`no. ${str(data.issue)}`);
  if (str(data.pages)) bits.push(`pp. ${str(data.pages)}`);
  return bits;
}

// ---------------------------------------------------------------------------
// Attachment PDFs.
//
// Zotero's My Publications feed carries the child attachments alongside the
// items, so a public PDF can be pulled straight into the publication's own
// directory and served from the site instead of sending readers off to a
// paywall. The file is named after the slug (weidig-fire-fringe-25.pdf), so
// the download has a short, recognizable name and the path never moves.
// Re-downloads are skipped when the MD5 Zotero reports already matches the
// copy on disk, which keeps the scheduled sync from rewriting megabytes of
// identical PDFs on every run.
function pdfAttachments(items) {
  const byParent = new Map();
  for (const it of items) {
    const d = it.data || {};
    if (d.itemType !== 'attachment' || !d.parentItem) continue;
    if (d.contentType !== 'application/pdf') continue;
    if (d.linkMode === 'linked_url') continue;
    if (!byParent.has(d.parentItem)) byParent.set(d.parentItem, it);
  }
  return byParent;
}

async function downloadPdf(userID, attachment, dest) {
  const md5 = attachment.data?.md5 || '';
  if (md5 && fs.existsSync(dest)) {
    // MD5 here only matches Zotero's own change-detection checksum (its API
    // exposes no other digest) to skip an unchanged download — not a
    // security use. NOSONAR: javascript:S4790 weak-hash warning is a false
    // positive in this context.
    const have = crypto.createHash('md5').update(fs.readFileSync(dest)).digest('hex'); // NOSONAR
    if (have === md5) return false;
  }
  const url = `https://api.zotero.org/users/${userID}/publications/items/${attachment.key}/file`;
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Zotero file download failed (${res.status}) for ${attachment.key}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
    throw new Error(`Zotero returned a non-PDF body for ${attachment.key}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return true;
}

// One entry's page data. Nothing is written here: groupAppearances() needs to
// see every record before any page is built.
function buildRecord(it) {
  const parsed = parseZoteroDate(it.data.date);
  const year = parsed ? parsed.y : extractYear(it.data.date);
  let date = '';
  if (parsed) date = `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
  else if (year) date = `${year}-01-01`;
  const doi = it.data.DOI || '';
  const venue = venueOf(it.data);
  const abstract = stripHtml(it.data.abstractNote || '');
  const category = categorize(it);
  const authorsHtml = joinAuthors(
    (it.data.creators || []).filter((c) => c && (c.lastName || c.name)).map(citeName),
  );

  return {
    it,
    slug: it.__slug,
    title: stripHtml(it.data.title || 'Untitled'),
    date,
    year,
    doi,
    link: it.data.url || (doi ? `https://doi.org/${doi}` : ''),
    venue,
    abstract,
    summary: trimToSentence(abstract) || citationBlurb(category, authorsHtml, year, venue),
    category,
    categories: [category],
    authorsHtml,
    detailBits: detailsOf(it.data),
    appearances: null,
    appearanceOf: null,
  };
}

async function main() {
  const items = await fetchAllItems(
    `https://api.zotero.org/users/${userID}/publications/items?format=json&include=data,bibtex&limit=100`,
  );
  // Never prune everything on a bad/empty response.
  if (!items.length) throw new Error('Zotero returned no items; aborting before prune.');

  fs.mkdirSync(pubsDir, { recursive: true });

  const pdfs = pdfAttachments(items);

  const entries = items
    .filter((it) => it.data.itemType !== 'attachment' && it.key)
    .sort((a, b) => a.key.localeCompare(b.key));

  // Collisions are disambiguated with a slice of the Zotero item key rather
  // than an ordinal. An ordinal depends on which *other* items exist, so
  // removing or renaming one member of a colliding pair silently renumbers the
  // survivor and 404s its published URL. The key is intrinsic to the item and
  // survives edits, so a page's URL stops moving underneath it. Only colliding
  // slugs take the suffix, so the common case stays clean.
  const slugCounts = new Map();
  for (const it of entries) {
    const base = buildSlug(
      it.data.creators,
      stripHtml(it.data.title || ''),
      extractYear(it.data.date),
    );
    slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
    it.__base = base;
  }
  for (const it of entries) {
    it.__slug =
      slugCounts.get(it.__base) === 1
        ? it.__base
        : `${it.__base}-${it.key.toLowerCase().slice(0, 4)}`;
  }

  let metrics = null;
  try {
    metrics = await fetchCitationCounts(entries.map((it) => it.data.DOI));
    console.log(`OpenAlex: citation counts for ${metrics.size} of ${entries.length} items.`);
  } catch (err) {
    console.warn(
      `OpenAlex lookup failed (${err?.message ?? err}); keeping the counts already on disk.`,
    );
  }

  // ---------------------------------------------------------------------
  // Pass 1: derive each entry's page data (nothing is written yet — the
  // grouping pass below needs to see every entry before any page is built).
  // ---------------------------------------------------------------------
  const records = entries.map(buildRecord);

  groupAppearances(records);

  // ---------------------------------------------------------------------
  // Pass 2: write the pages.
  // ---------------------------------------------------------------------
  let written = 0;
  let fetchedPdfs = 0;
  for (const rec of records) {
    const { it, slug, title, date, year, doi, link, venue, abstract, summary, detailBits } = rec;

    // The PDF has to be on disk before the frontmatter is written: `pub-pdf`
    // is what puts the View PDF button on the page, so it is only set for a
    // file that actually downloaded.
    const dir = path.join(pubsDir, slug);
    const assetDir = path.join(assetsDir, slug);
    const pdfName = `${slug}.pdf`;
    const pdfPath = path.join(assetDir, pdfName);
    fs.mkdirSync(assetDir, { recursive: true });
    const attachment = pdfs.get(it.key);
    let hasPdf = false;
    if (attachment) {
      try {
        if (await downloadPdf(userID, attachment, pdfPath)) fetchedPdfs++;
        hasPdf = true;
      } catch (err) {
        // A file that fails today should not drop a PDF the site already
        // serves, so an existing copy still counts.
        console.warn(`PDF download failed for ${slug} (${err?.message ?? err}).`);
        hasPdf = fs.existsSync(pdfPath);
      }
    } else if (fs.existsSync(pdfPath)) {
      // Attachment removed in Zotero — drop the stale copy from the repo.
      fs.rmSync(pdfPath, { force: true });
    }

    const fm = ['---', `title: ${yq(title)}`];
    if (date) fm.push(`date: ${yq(date)}`);
    if (summary) fm.push(`description: ${yq(summary)}`);
    fm.push(`categories: [${rec.categories.map(yq).join(', ')}]`);
    if (rec.authorsHtml) fm.push(`pub-authors: ${yq(rec.authorsHtml)}`);
    if (venue) fm.push(`pub-venue: ${yq(venue)}`);
    if (detailBits.length) fm.push(`pub-details: ${yq(detailBits.join(', '))}`);
    if (doi) fm.push(`pub-doi: ${yq(doi)}`);
    if (link) fm.push(`pub-url: ${yq(link)}`);
    // Root-relative: the citation row renders this page's PDF link from other
    // routes (the publications index, the homepage, the CV), where a relative
    // name would resolve against the wrong page.
    const pdfUrl = `/publications/${slug}/${pdfName}`;
    if (hasPdf) fm.push(`pub-pdf: ${yq(pdfUrl)}`);
    // The listings on publications/index.qmd include `pub-listed: "yes"`, so a
    // repeat appearance keeps its own page (and its URL) but does not add a
    // near-identical row to the index (#253).
    if (rec.appearanceOf) {
      fm.push(`pub-appearance-of: ${yq(`/publications/${rec.appearanceOf.slug}/`)}`);
      fm.push(`pub-appearance-count: ${rec.appearanceOf.appearances.length}`);
    } else {
      fm.push(`pub-listed: "yes"`);
      if (rec.appearances) {
        fm.push('pub-appearances:');
        for (const a of rec.appearances) {
          fm.push(`  - venue: ${yq(a.venue)}`);
          fm.push(`    when: ${yq(a.when)}`);
          fm.push(`    kind: ${yq(a.kind)}`);
          if (a.url) fm.push(`    url: ${yq(a.url)}`);
        }
      }
    }

    const previous = readExistingMetrics(path.join(pubsDir, slug, 'index.md'));
    // A fresh lookup wins; anything it didn't cover (lookup failed, or the DOI
    // isn't in OpenAlex yet) keeps whatever the last run committed.
    const fetched = metrics?.get(normalizeDoi(doi));
    const citations = fetched?.citations ?? previous.citations;
    const openAccess = fetched?.oa ?? previous.oa;
    if (citations > 0) fm.push(`pub-citations: ${citations}`);
    if (openAccess) fm.push('pub-oa: true');
    // The citation line and the action buttons are frontmatter, not body
    // markup: the Astro page renders both, and the body stays plain prose.
    const citation = `${rec.authorsHtml}${year ? ` (${year}).` : ''}${
      venue
        ? ` *${venue.replace(/\*/g, '')}*${detailBits.length ? ', ' + detailBits.join(', ') : ''}.`
        : ''
    }`.trim();
    fm.push(`citation: ${yq(citation)}`);

    const links = [];
    if (doi)
      links.push({
        label: 'DOI',
        href: `https://doi.org/${doi}`,
        variant: 'primary',
        external: true,
      });
    if (link && !doi)
      links.push({ label: 'Source', href: link, variant: 'primary', external: true });
    if (hasPdf) links.push({ label: 'View PDF', href: pdfUrl, variant: 'ghost', external: true });
    links.push({ label: 'BibTeX', href: `/publications/${slug}/cite.bib`, variant: 'ghost' });
    fm.push('links:');
    for (const l of links) {
      fm.push(`  - label: ${yq(l.label)}`);
      fm.push(`    href: ${yq(l.href)}`);
      fm.push(`    variant: ${l.variant}`);
      if (l.external) fm.push(`    external: true`);
    }

    fm.push('---', '');

    const body = [];
    if (rec.appearances) {
      body.push('## Presented at', '');
      for (const a of rec.appearances) {
        const label = [a.venue, a.when].filter(Boolean).join(' — ');
        body.push(`- ${a.url ? `[${label}](${a.url})` : label} · ${a.kind}`);
      }
      body.push('');
    } else if (rec.appearanceOf) {
      body.push(
        '> [!NOTE]',
        `> One of ${rec.appearanceOf.appearances.length} appearances of the same work. [See the full record and the other venues](/publications/${rec.appearanceOf.slug}/).`,
        '',
      );
    }

    if (abstract) body.push('## Abstract', '', abstract, '');

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.md'), fm.join('\n') + '\n' + body.join('\n'));
    if (it.bibtex) fs.writeFileSync(path.join(assetDir, 'cite.bib'), it.bibtex.trim() + '\n');
    written++;
  }

  // Prune publication dirs no longer in Zotero, content and assets alike.
  const active = new Set(entries.map((it) => it.__slug));
  let removed = 0;
  for (const base of [pubsDir, assetsDir]) {
    if (!fs.existsSync(base)) continue;
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || active.has(e.name)) continue;
      fs.rmSync(path.join(base, e.name), { recursive: true, force: true });
      if (base === pubsDir) removed++;
    }
  }

  console.log(`Wrote ${written} publications; ${fetchedPdfs} PDFs downloaded; pruned ${removed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
