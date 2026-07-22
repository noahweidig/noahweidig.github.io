// Fetch the owner's Zotero "My Publications" library and regenerate
// publications/<slug>/index.qmd (+ cite.bib) for the Quarto site.
// No npm dependencies — plain Node 20+.
import fs from "fs";
import path from "path";

const userID = process.env.ZOTERO_USER_ID || 11988712;
const pubsDir = path.resolve("publications");

const OWNER_FAMILY = "weidig";
const OWNER_GIVEN_PREFIX = "noah";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function stripHtml(html) {
  if (!html) return "";
  // Strip tags until the output stabilizes: a single pass can leave markup
  // behind (e.g. "<scr<b></b>ipt>" → "<script>"), which CodeQL flags as
  // incomplete multi-character sanitization.
  let text = String(html);
  let prev;
  do {
    prev = text;
    text = text.replace(/<[^>]*>/g, "");
  } while (text !== prev);
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

function isOwner(c) {
  if (!c) return false;
  const family = (c.lastName || "").trim().toLowerCase();
  const given = (c.firstName || "").trim().toLowerCase();
  if (family === OWNER_FAMILY && given.startsWith(OWNER_GIVEN_PREFIX)) return true;
  if (c.name) {
    const s = slugify(c.name);
    if (s === "noah-weidig" || s === "noah-c-weidig") return true;
  }
  return false;
}

// "Victoria M. Donovan" -> "Donovan, V. M."; owner is bolded.
function citeName(c) {
  let out;
  if (c.lastName) {
    const initials = (c.firstName || "")
      .split(/[\s.]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + ".")
      .join(" ");
    out = initials ? `${c.lastName}, ${initials}` : c.lastName;
  } else {
    out = (c.name || "").trim();
  }
  return isOwner(c) ? `**${out}**` : out;
}

function joinAuthors(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}

const TYPE_MAP = {
  journalArticle: "Journal Article",
  thesis: "Thesis",
  presentation: "Presentation",
  conferencePaper: "Presentation",
  preprint: "Preprint",
  magazineArticle: "Media Coverage",
  newspaperArticle: "Media Coverage",
  blogPost: "Media Coverage",
  webpage: "Media Coverage",
  book: "Book",
  bookSection: "Book Chapter",
  report: "Report",
};

function categorize(it) {
  const hay = [it.data.title, it.data.event, it.data.genre, it.data.presentationType].filter(Boolean).join(" ");
  if (/\bwebinar\b/i.test(hay)) return "Webinar";
  if (/referee report/i.test(it.data.title || "")) return "Peer Review";
  return TYPE_MAP[it.data.itemType] || "Publication";
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
          const ra = +(res.headers.get("retry-after") || res.headers.get("backoff") || 0);
          await new Promise((r) => setTimeout(r, ra > 0 ? ra * 1000 : 1000 * i));
          continue;
        }
        throw new Error(`Zotero API error (${res.status})`);
      } catch (err) {
        lastErr = err;
        if (i < 3) { await new Promise((r) => setTimeout(r, 1000 * i)); continue; }
        throw new Error(`Zotero API request failed: ${err?.message ?? err}`);
      }
    }
    if (!res?.ok) throw new Error(`Zotero API error: ${lastErr?.message || "transient failure"}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error("Zotero API response was not a JSON array.");
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
      const c = +dayM[1];
      if (c >= 1 && c <= 31 && String(c) !== String(y)) d = c;
    }
    return { y, m: mo || 1, d: clampDay(y, mo || 1, d || 1) };
  }
  return null;
}

const FILLER = new Set(["a", "an", "the", "of", "and", "or", "but", "for", "to", "in", "on", "at", "by", "with", "from", "as", "is", "are", "be"]);

function titleWords(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
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
  return "";
}

function buildSlug(creators, title, year) {
  const last = slugify(firstAuthorLastName(creators)) || "anon";
  const words = titleWords(title).filter((w) => !FILLER.has(w.toLowerCase())).slice(0, 2).map(slugify).filter(Boolean);
  return `${last}-${words.length ? words.join("-") : "untitled"}-${year ? String(year).slice(-2) : "nd"}`;
}

// Minimal YAML scalar quoting: always double-quote and escape.
const yq = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function main() {
  const items = await fetchAllItems(
    `https://api.zotero.org/users/${userID}/publications/items?format=json&include=data,bibtex&limit=100`
  );
  // Never prune everything on a bad/empty response.
  if (!items.length) throw new Error("Zotero returned no items; aborting before prune.");

  fs.mkdirSync(pubsDir, { recursive: true });

  const entries = items
    .filter((it) => it.data.itemType !== "attachment" && it.key)
    .sort((a, b) => a.key.localeCompare(b.key));

  const slugCounts = new Map();
  for (const it of entries) {
    const base = buildSlug(it.data.creators, stripHtml(it.data.title || ""), extractYear(it.data.date));
    const n = (slugCounts.get(base) || 0) + 1;
    slugCounts.set(base, n);
    it.__slug = n === 1 ? base : `${base}-${n}`;
  }

  let written = 0;
  for (const it of entries) {
    const slug = it.__slug;
    const title = stripHtml(it.data.title || "Untitled");
    const parsed = parseZoteroDate(it.data.date);
    const year = parsed ? parsed.y : extractYear(it.data.date);
    const date = parsed ? `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}` : year ? `${year}-01-01` : "";
    const doi = it.data.DOI || "";
    const link = it.data.url || (doi ? `https://doi.org/${doi}` : "");
    const isThesis = it.data.itemType === "thesis";
    const venue =
      it.data.publicationTitle || it.data.bookTitle || it.data.proceedingsTitle || it.data.meetingName || it.data.event ||
      (isThesis ? it.data.university || it.data.publisher : it.data.place || it.data.publisher) || "";
    const abstract = stripHtml(it.data.abstractNote || "");
    let summary = "";
    if (abstract) {
      if (abstract.length > 240) {
        const cut = abstract.slice(0, 240);
        const sp = cut.lastIndexOf(" ");
        summary = (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s.,;:]+$/, "") + "…";
      } else summary = abstract;
    }
    const category = categorize(it);
    const authorsHtml = joinAuthors((it.data.creators || []).filter((c) => c && (c.lastName || c.name)).map(citeName));

    const detailBits = [];
    const str = (v) => (v == null ? "" : String(v).trim());
    if (str(it.data.volume)) detailBits.push(`vol. ${str(it.data.volume)}`);
    if (str(it.data.issue)) detailBits.push(`no. ${str(it.data.issue)}`);
    if (str(it.data.pages)) detailBits.push(`pp. ${str(it.data.pages)}`);

    const fm = ["---", `title: ${yq(title)}`];
    if (date) fm.push(`date: ${yq(date)}`);
    if (summary) fm.push(`description: ${yq(summary)}`);
    fm.push(`categories: [${yq(category)}]`);
    if (authorsHtml) fm.push(`pub-authors: ${yq(authorsHtml)}`);
    if (venue) fm.push(`pub-venue: ${yq(venue)}`);
    if (detailBits.length) fm.push(`pub-details: ${yq(detailBits.join(", "))}`);
    if (doi) fm.push(`pub-doi: ${yq(doi)}`);
    if (link) fm.push(`pub-url: ${yq(link)}`);
    fm.push("---", "");

    const body = [];
    body.push(`::: {.nw-cite-meta}`);
    body.push(`${authorsHtml}${year ? ` (${year}).` : ""} ${venue ? `*${venue.replace(/\*/g, "")}*${detailBits.length ? ", " + detailBits.join(", ") : ""}.` : ""}`);
    body.push(`:::`, "");
    const btns = [];
    if (doi) btns.push(`[DOI](https://doi.org/${doi}){.nw-btn .nw-btn-primary target="_blank"}`);
    if (link && !doi) btns.push(`[Source](${link}){.nw-btn .nw-btn-primary target="_blank"}`);
    btns.push(`[BibTeX](cite.bib){.nw-btn .nw-btn-ghost}`);
    body.push(btns.join(" "), "");
    if (abstract) body.push("## Abstract", "", abstract, "");

    const dir = path.join(pubsDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.qmd"), fm.join("\n") + "\n" + body.join("\n"));
    if (it.bibtex) fs.writeFileSync(path.join(dir, "cite.bib"), it.bibtex.trim() + "\n");
    written++;
  }

  // Prune publication dirs no longer in Zotero.
  const active = new Set(entries.map((it) => it.__slug));
  let removed = 0;
  for (const e of fs.readdirSync(pubsDir, { withFileTypes: true })) {
    if (!e.isDirectory() || active.has(e.name)) continue;
    fs.rmSync(path.join(pubsDir, e.name), { recursive: true, force: true });
    removed++;
  }

  console.log(`Wrote ${written} publications; pruned ${removed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
