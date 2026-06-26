import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { stripHtml } from "./sanitize.js";

const userID = process.env.ZOTERO_USER_ID || 11988712;
const pubsDir = path.resolve("content/publications");
const dataAuthorsDir = path.resolve("data/authors");
const contentAuthorsDir = path.resolve("content/authors");

// Slug for the site owner — must match data/authors/me.yaml
const OWNER_SLUG = "me";
const OWNER_FAMILY = "weidig";
const OWNER_GIVEN_PREFIX = "noah";

function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

function isOwner(creator) {
  if (!creator) return false;
  const family = (creator.lastName || "").trim().toLowerCase();
  const given = (creator.firstName || "").trim().toLowerCase();
  if (family === OWNER_FAMILY && given.startsWith(OWNER_GIVEN_PREFIX)) return true;
  if (creator.name) {
    const slug = slugify(creator.name);
    if (slug === "noah-weidig" || slug === "noah-c-weidig" || slug === OWNER_SLUG) return true;
  }
  return false;
}

function authorSlug(creator) {
  if (isOwner(creator)) return OWNER_SLUG;
  const display = creator.name
    ? creator.name
    : `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
  return slugify(display);
}

function authorDisplay(creator) {
  if (creator.name) return creator.name;
  return `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
}

function writeDataAuthor(slug, display) {
  if (!slug || slug === OWNER_SLUG) return;
  fs.mkdirSync(dataAuthorsDir, { recursive: true });
  const p = path.join(dataAuthorsDir, `${slug}.yaml`);
  const body = [
    `schema: "hugoblox/author/v1"`,
    `slug: "${slug}"`,
    `name:`,
    `  display: "${display.replace(/"/g, '\\"')}"`,
    ``,
  ].join("\n");
  fs.writeFileSync(p, body);
}

function pruneDataAuthors(activeSlugs) {
  if (!fs.existsSync(dataAuthorsDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dataAuthorsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
    const slug = entry.name.replace(/\.yaml$/, "");
    if (slug === OWNER_SLUG || activeSlugs.has(slug)) continue;
    fs.unlinkSync(path.join(dataAuthorsDir, entry.name));
    removed++;
  }
  return removed;
}

// Author taxonomy term pages need a content file so Hugo derives .Title from the
// real display name instead of humanizing the slug ("Amber-L-Miller").
function writeContentAuthor(slug, display) {
  if (!slug || slug === OWNER_SLUG) return;
  const dir = path.join(contentAuthorsDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const body = `---\ntitle: "${display.replace(/"/g, '\\"')}"\n---\n`;
  fs.writeFileSync(path.join(dir, "_index.md"), body);
}

function pruneContentAuthors(activeSlugs) {
  if (!fs.existsSync(contentAuthorsDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(contentAuthorsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (slug === OWNER_SLUG || activeSlugs.has(slug)) continue;
    fs.rmSync(path.join(contentAuthorsDir, slug), { recursive: true, force: true });
    removed++;
  }
  return removed;
}

const baseUrl = `https://api.zotero.org/users/${userID}/publications/items?format=json&include=data,bibtex&limit=100`;

const TYPE_MAP = {
  journalArticle: "article-journal",
  thesis: "thesis",
  presentation: "paper-conference",
  conferencePaper: "paper-conference",
  preprint: "manuscript",
  magazineArticle: "article-magazine",
  newspaperArticle: "article-newspaper",
  blogPost: "post-weblog",
  webpage: "webpage",
  book: "book",
  bookSection: "chapter",
  report: "report",
};

async function fetchAllItems(startUrl) {
  const items = [];
  let url = startUrl;
  while (url) {
    let lastErr;
    let res;
    for (let i = 1; i <= 3; i++) {
      try {
        // Abort a stalled connection so the workflow can't hang indefinitely.
        res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (res.ok) break;
        // Honor 429 rate-limiting (and Zotero's Backoff header) before retrying.
        if ((res.status === 429 || res.status >= 500) && i < 3) {
          const retryAfter = +(res.headers.get("retry-after") || res.headers.get("backoff") || 0);
          const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * i;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(`Zotero API error (${res.status})`);
      } catch (err) {
        lastErr = err;
        if (i < 3) { await new Promise(r => setTimeout(r, 1000 * i)); continue; }
        throw new Error(`Zotero API request failed: ${err?.message ?? err}`);
      }
    }
    if (!res?.ok) throw new Error(`Zotero API error: ${lastErr?.message || "Transient failure"}`);
    let page;
    try {
      page = await res.json();
    } catch (err) {
      throw new Error(`Zotero API returned a non-JSON response: ${err?.message ?? err}`);
    }
    if (!Array.isArray(page)) {
      throw new Error("Zotero API response was not a JSON array of items.");
    }
    items.push(...page);
    const link = res.headers.get("link") || "";
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return items;
}

const extractYear = (s) => {
  const m = s?.match(/\b(19|20)\d{2}\b/);
  return m ? +m[0] : 0;
};

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad2 = (n) => String(n).padStart(2, "0");

// Days in a given month (1-indexed); handles leap years via Date rollover.
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const clampDay = (y, m, d) => Math.min(Math.max(d, 1), daysInMonth(y, m));

function parseZoteroDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = m[3] ? +m[3] : 1;
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }

  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const mo = +m[1], d = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }

  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12) return { y, m: mo, d: clampDay(y, mo, d) };
  }

  const yearM = s.match(/\b(19|20)\d{2}\b/);
  const monthM = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  const dayM = s.match(/\b([0-3]?\d)(?:st|nd|rd|th)?\b/);
  if (yearM) {
    const y = +yearM[0];
    const mo = monthM ? MONTHS[monthM[1].toLowerCase()] : null;
    let d = null;
    if (dayM && monthM) {
      const candidate = +dayM[1];
      if (candidate >= 1 && candidate <= 31 && String(candidate) !== String(y)) d = candidate;
    }
    return { y, m: mo || 1, d: clampDay(y, mo || 1, d || 1) };
  }

  return null;
}

function formatDate(parsed) {
  if (!parsed) return undefined;
  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
}

function categorizePubType(it) {
  const t = it.data.itemType;
  const haystack = [it.data.title, it.data.event, it.data.genre, it.data.presentationType].filter(Boolean).join(" ");
  if (/\bwebinar\b/i.test(haystack)) return "paper-conference";
  if (/referee report/i.test(it.data.title || "")) return "manuscript";
  return TYPE_MAP[t] || "manuscript";
}


function firstAuthorLastName(creators) {
  if (!Array.isArray(creators)) return "";
  for (const c of creators) {
    if (!c) continue;
    if (c.lastName) return c.lastName;
    if (c.name) {
      const parts = c.name.trim().split(/\s+/);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return "";
}

const FILLER_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "but", "for", "to", "in", "on",
  "at", "by", "with", "from", "as", "is", "are", "be",
]);

function titleWords(title) {
  if (!title) return [];
  return String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function firstNonFillerWords(title, n) {
  const words = titleWords(title).filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  return words.slice(0, n);
}

function buildReadableSlug(creators, title, year) {
  const last = slugify(firstAuthorLastName(creators)) || "anon";
  const slugWords = firstNonFillerWords(title, 2).map(slugify).filter(Boolean);
  const wordPart = slugWords.length ? slugWords.join("-") : "untitled";
  const yy = year ? String(year).slice(-2) : "nd";
  return `${last}-${wordPart}-${yy}`;
}

function breadcrumbTitle(title) {
  return titleWords(title).slice(0, 3).join(" ");
}

function authorsFromCreators(creators) {
  if (!Array.isArray(creators)) return [];
  return creators
    .filter((c) => c && (c.lastName || c.name))
    .map((c) => ({ slug: authorSlug(c), display: authorDisplay(c) }))
    .filter((a) => a.slug);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Frontmatter keys written by this script; all others are manually curated and must be preserved.
// `publication_short` is the legacy companion to the flat `publication` string; it is
// superseded by `publication.short_name`, so it is owned (and dropped) by the script.
const SCRIPT_KEYS = new Set([
  "title", "linkTitle", "date", "slug", "authors",
  "publication_types", "publication", "publication_short", "abstract", "summary",
  "doi", "url_source", "hugoblox", "links", "tags",
]);

function parseExistingFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return matter(fs.readFileSync(filePath, "utf8")).data;
  } catch (err) {
    console.warn(`Warning: could not parse existing frontmatter in ${filePath}: ${err?.message ?? err}`);
    return null;
  }
}

function pruneObsoletePubs(dir, activeSlugs) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
    fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
    removed++;
  }
  return removed;
}

function buildFrontmatter({ key, title, linkTitle, date, authors, publication_types, publication, abstract, summary, doi, url: link, tags, extra = {} }) {
  const data = {};
  data.title = title;
  if (linkTitle) data.linkTitle = linkTitle;
  if (date) data.date = date;
  data.slug = key;
  if (authors.length) data.authors = authors.map((a) => a.slug);
  data.publication_types = [publication_types];
  // Hugoblox expects the structured `publication: {name, short_name, volume, issue,
  // pages, publisher}` shape; only emit it when there is at least a venue name.
  if (publication && publication.name) data.publication = publication;
  if (abstract) data.abstract = abstract;
  if (summary) data.summary = summary;
  if (doi) data.hugoblox = { ids: { doi } };
  if (link) data.links = [{ type: "source", url: link }];
  if (tags.length) data.tags = tags;
  Object.assign(data, extra);
  return matter.stringify("", data).trimEnd();
}

// Assemble the structured Hugoblox `publication` map from Zotero fields. Only
// populated keys are included so the emitted frontmatter stays minimal.
function buildPublication(it, name) {
  const pub = {};
  const str = (v) => (v == null ? "" : String(v).trim());
  if (name) pub.name = name;
  const shortName = str(it.data.journalAbbreviation);
  if (shortName) pub.short_name = shortName;
  const volume = str(it.data.volume);
  if (volume) pub.volume = volume;
  const issue = str(it.data.issue);
  if (issue) pub.issue = issue;
  const pages = str(it.data.pages);
  if (pages) pub.pages = pages;
  // A thesis already carries its institution in `name`; don't duplicate it as a
  // publisher. For other types, include `publisher` only when it adds new info.
  if (it.data.itemType !== "thesis") {
    const publisher = str(it.data.publisher);
    if (publisher && publisher !== name) pub.publisher = publisher;
  }
  return pub;
}

function tagForType(pubType, itemType) {
  switch (pubType) {
    case "article-journal": return "Journal Article";
    case "thesis": return "Thesis";
    case "paper-conference": return "Presentation";
    case "manuscript": return itemType === "preprint" ? "Preprint" : "Manuscript";
    case "article-magazine":
    case "article-newspaper":
    case "post-weblog":
    case "webpage": return "Media Coverage";
    case "report": return "Report";
    case "book": return "Book";
    case "chapter": return "Book Chapter";
    default: return "Publication";
  }
}

async function main() {
  const items = await fetchAllItems(baseUrl);

  ensureDir(pubsDir);

  const entries = items
    .filter((it) => it.data.itemType !== "attachment" && it.key)
    .sort((a, b) => a.key.localeCompare(b.key));

  const slugCounts = new Map();
  for (const it of entries) {
    const base = buildReadableSlug(
      it.data.creators,
      stripHtml(it.data.title || ""),
      extractYear(it.data.date),
    );
    const n = (slugCounts.get(base) || 0) + 1;
    slugCounts.set(base, n);
    it.__slug = n === 1 ? base : `${base}-${n}`;
  }

  const activeAuthors = new Map();
  let written = 0;
  for (const it of entries) {
    const slug = it.__slug;

    const pubType = categorizePubType(it);
    const title = stripHtml(it.data.title || "Untitled");
    const parsedDate = parseZoteroDate(it.data.date);
    const year = parsedDate ? parsedDate.y : extractYear(it.data.date);
    const date = formatDate(parsedDate) || (year ? `${year}-01-01` : undefined);
    const authors = authorsFromCreators(it.data.creators);
    const doi = it.data.DOI || "";
    const link = it.data.url || (doi ? `https://doi.org/${doi}` : "");
    // For a thesis, prefer the awarding institution; never fall back to `place`
    // (a city), which would render as the citation venue. Other item types keep
    // `place` as a last-resort venue.
    const isThesisType = it.data.itemType === "thesis";
    const publication = it.data.publicationTitle || it.data.bookTitle || it.data.proceedingsTitle || it.data.meetingName || it.data.event
      || (isThesisType ? (it.data.university || it.data.publisher) : (it.data.place || it.data.publisher))
      || "";
    const abstract = stripHtml(it.data.abstractNote || "");
    const summary = abstract ? abstract.slice(0, 240) + (abstract.length > 240 ? "…" : "") : "";

    const isWebinar = /\bwebinar\b/i.test([it.data.title, it.data.event, it.data.genre, it.data.presentationType].filter(Boolean).join(" "));
    const isPeerReview = /referee report/i.test(it.data.title || "");
    let tags;
    if (isWebinar) tags = ["Webinar"];
    else if (isPeerReview) tags = ["Peer Review"];
    else tags = [tagForType(pubType, it.data.itemType)];

    const dir = path.join(pubsDir, slug);
    const existing = parseExistingFrontmatter(path.join(dir, "index.md"));

    // Preserve a hand-curated venue name when Zotero supplies none, supporting both
    // the structured map and the legacy flat-string shapes of an existing file.
    const existingPubName = existing?.publication && typeof existing.publication === "object"
      ? (existing.publication.name || "")
      : (typeof existing?.publication === "string" ? existing.publication : "");
    const mergedPublication = buildPublication(it, publication || existingPubName);
    const mergedAbstract = abstract || (typeof existing?.abstract === "string" ? existing.abstract : "");
    const mergedSummary = summary || (typeof existing?.summary === "string" ? existing.summary : "");
    const scriptTag = tags[0];
    const existingTags = Array.isArray(existing?.tags) ? existing.tags : [];
    const mergedTags = [scriptTag, ...existingTags.filter((t) => t !== scriptTag)];
    const extra = existing
      ? Object.fromEntries(Object.entries(existing).filter(([k]) => !SCRIPT_KEYS.has(k)))
      : {};

    const fm = buildFrontmatter({
      key: slug, title, linkTitle: breadcrumbTitle(title), date, authors,
      publication_types: pubType,
      publication: mergedPublication, abstract: mergedAbstract, summary: mergedSummary,
      doi, url: link, tags: mergedTags, extra,
    });

    try {
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, "index.md"), fm + "\n");

      if (it.bibtex) {
        fs.writeFileSync(path.join(dir, "cite.bib"), it.bibtex.trim() + "\n");
      }
    } catch (err) {
      throw new Error(`Failed to write publication "${slug}" (Zotero key ${it.key}): ${err?.message ?? err}`);
    }
    authors.forEach((a) => activeAuthors.set(a.slug, a.display));
    written++;
  }

  for (const [slug, display] of activeAuthors) {
    writeDataAuthor(slug, display);
    writeContentAuthor(slug, display);
  }
  const activeAuthorSlugs = new Set(activeAuthors.keys());
  const removedAuthors = pruneDataAuthors(activeAuthorSlugs);
  pruneContentAuthors(activeAuthorSlugs);
  const removedPubs = pruneObsoletePubs(pubsDir, new Set(entries.map((it) => it.__slug)));

  console.log(`Wrote ${written} publication entries under content/publications/`);
  if (removedPubs) console.log(`Removed ${removedPubs} obsolete publication director${removedPubs === 1 ? "y" : "ies"}.`);
  console.log(`Synced ${activeAuthors.size} author profile(s); pruned ${removedAuthors} stale.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
