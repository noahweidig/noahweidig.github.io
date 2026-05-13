import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { stripHtml } from "./sanitize.js";

const userID = 11988712;
const pubsDir = path.resolve("content/pubs");
const authorsDir = path.resolve("content/authors");

function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

function ensureAuthorProfile(name) {
  const slug = slugify(name);
  if (!slug) return;
  const dir = path.join(authorsDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "_index.md");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, `---\ntitle: "${name.replace(/"/g, '\\"')}"\n---\n`);
  }
}
const url = `https://api.zotero.org/users/${userID}/publications/items?format=json&include=data,bibtex&limit=200`;

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

const fetchWithRetry = async (u, { attempts = 3, delayMs = 1_000 } = {}) => {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(u);
      const body = await r.text();
      if (r.ok) return body;
      if (r.status >= 500 && i < attempts) {
        await new Promise((res) => setTimeout(res, delayMs * i));
        continue;
      }
      throw new Error(`Zotero API error (${r.status})`);
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await new Promise((res) => setTimeout(res, delayMs * i));
        continue;
      }
      throw new Error(`Zotero API request failed: ${err?.message ?? err}`);
    }
  }
  throw new Error(`Zotero API error: ${lastError?.message || "Transient failure"}`);
};

const extractYear = (s) => {
  const m = s?.match(/\b(19|20)\d{2}\b/);
  return m ? +m[0] : 0;
};

function categorizePubType(it) {
  const t = it.data.itemType;
  const haystack = [it.data.title, it.data.event, it.data.genre].filter(Boolean).join(" ");
  if (/\bwebinar\b/i.test(haystack)) return "manuscript";
  if (/referee report/i.test(it.data.title || "")) return "manuscript";
  return TYPE_MAP[t] || "manuscript";
}

function yamlEscape(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatAuthors(creators) {
  if (!Array.isArray(creators)) return [];
  return creators
    .filter((c) => c && (c.lastName || c.name))
    .map((c) => (c.name ? c.name : `${c.firstName || ""} ${c.lastName || ""}`.trim()));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearPubsDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
    } else if (entry.name !== "_index.md") {
      fs.unlinkSync(path.join(dir, entry.name));
    }
  }
}

function buildFrontmatter({ key, title, date, authors, publication_types, publication, abstract, summary, doi, url: link, tags }) {
  const lines = ["---"];
  lines.push(`title: "${yamlEscape(title)}"`);
  if (date) lines.push(`date: ${date}`);
  lines.push(`slug: "${key}"`);
  if (authors.length) {
    lines.push("authors:");
    authors.forEach((a) => lines.push(`  - "${yamlEscape(a)}"`));
  }
  lines.push("publication_types:");
  lines.push(`  - "${publication_types}"`);
  if (publication) lines.push(`publication: "${yamlEscape(publication)}"`);
  if (abstract) lines.push(`abstract: "${yamlEscape(abstract)}"`);
  if (summary) lines.push(`summary: "${yamlEscape(summary)}"`);
  if (doi) lines.push(`doi: "${yamlEscape(doi)}"`);
  if (link) lines.push(`url_source: "${yamlEscape(link)}"`);
  if (tags.length) {
    lines.push("tags:");
    tags.forEach((t) => lines.push(`  - "${yamlEscape(t)}"`));
  }
  lines.push("---");
  return lines.join("\n");
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
  const payload = await fetchWithRetry(url);
  let items;
  try {
    items = JSON.parse(payload);
  } catch {
    throw new Error("Unexpected Zotero API response (could not parse JSON).");
  }

  ensureDir(pubsDir);
  clearPubsDir(pubsDir);

  let written = 0;
  for (const it of items) {
    if (it.data.itemType === "attachment") continue;
    const key = it.key;
    if (!key) continue;

    const pubType = categorizePubType(it);
    const title = stripHtml(it.data.title || "Untitled");
    const year = extractYear(it.data.date);
    const date = year ? `${year}-01-01` : undefined;
    const authors = formatAuthors(it.data.creators);
    const doi = it.data.DOI || "";
    const link = it.data.url || (doi ? `https://doi.org/${doi}` : "");
    const publication = it.data.publicationTitle || it.data.bookTitle || it.data.proceedingsTitle || it.data.event || it.data.publisher || "";
    const abstract = stripHtml(it.data.abstractNote || "");
    const summary = abstract ? abstract.slice(0, 240) + (abstract.length > 240 ? "…" : "") : "";

    const isWebinar = /\bwebinar\b/i.test([it.data.title, it.data.event, it.data.genre].filter(Boolean).join(" "));
    const tags = [tagForType(pubType, it.data.itemType)];
    if (isWebinar) tags.push("Webinar");

    const fm = buildFrontmatter({
      key, title, date, authors,
      publication_types: pubType,
      publication, abstract, summary, doi, url: link, tags,
    });

    const dir = path.join(pubsDir, key);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, "index.md"), fm + "\n");

    if (it.bibtex) {
      fs.writeFileSync(path.join(dir, "cite.bib"), it.bibtex.trim() + "\n");
    }
    authors.forEach(ensureAuthorProfile);
    written++;
  }

  console.log(`Wrote ${written} publication entries under content/pubs/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
