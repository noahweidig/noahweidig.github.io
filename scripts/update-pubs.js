import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { sanitizeHtml, stripHtml } from "./sanitize.js";

const userID = 11988712;
const pubsDir = path.resolve("content/pubs");
const url = `https://api.zotero.org/users/${userID}/publications/items?format=json&include=bib,data&style=apa&limit=200`;

const TYPE_FOLDERS = {
  "Journal Articles": "journal-articles",
  Thesis: "thesis",
  Presentations: "presentations",
  Webinars: "webinars",
  "Peer Reviews": "peer-reviews",
  "Media Coverage": "media-coverage",
};

const TYPE_ICONS = {
  "Journal Articles": "book-open",
  Thesis: "graduation-cap",
  Presentations: "person-chalkboard",
  Webinars: "video",
  "Peer Reviews": "circle-check",
  "Media Coverage": "newspaper",
};

const fetchWithRetry = async (url, { attempts = 3, delayMs = 1_000 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      const payload = await response.text();
      if (response.ok) return payload;
      if (response.status >= 500 && attempt < attempts) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw new Error(`Zotero API error (${response.status})`);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw new Error(
        `Zotero API request failed after ${attempts} attempts: ${err?.message ?? err}`
      );
    }
  }
  throw new Error(`Zotero API error: ${lastError?.message || "Transient failure"}`);
};

const doiRegex = /(?<!doi\.org\/)\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi;
const urlRegex = /(?<!href=")(https?:\/\/[^\s<"']+)/gi;
const hrefRegex = /href="(https?:\/\/[^"]+)"/i;

const extractYear = (s) => {
  const m = s?.match(/\b(19|20)\d{2}\b/);
  return m ? +m[0] : 0;
};

function normalizeBibDate(bib, rawDate) {
  const year = extractYear(rawDate) || extractYear(bib);
  if (!year) return bib;
  return bib.replace(/\([^()]*\b(?:19|20)\d{2}\b[^()]*\)/, `(${year})`);
}

function linkify(t) {
  return t
    .replace(
      doiRegex,
      (m, p1) =>
        `<a href="https://doi.org/${p1}" target="_blank" rel="noopener noreferrer">${p1}</a>`
    )
    .replace(
      urlRegex,
      (m, p1) =>
        `<a href="${p1}" target="_blank" rel="noopener noreferrer">${p1}</a>`
    );
}

function stripInlineUrls(bib) {
  return bib
    .replace(/\s*<a\b[^>]*>\s*https?:\/\/[^<]+<\/a>\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function categorize(it) {
  const t = it.data.itemType;
  const webinarText = [it.data.title, it.data.event, it.data.genre, it.bib]
    .filter(Boolean)
    .join(" ");
  if (/\bwebinar\b/i.test(webinarText)) return "Webinars";
  if (t === "journalArticle") return "Journal Articles";
  if (t === "presentation" || t === "conferencePaper") return "Presentations";
  if (t === "thesis") return "Thesis";
  if (t === "preprint" || /referee report/i.test(it.data.title || ""))
    return "Peer Reviews";
  return "Media Coverage";
}

function slugify(s) {
  return (s || "untitled")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
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

function boldName(html) {
  return html.replace(
    /Weidig,\s*N\.?\s*C\.?/g,
    (m) => `<strong>${m}</strong>`
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearTypeFolder(folder) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.rmSync(path.join(folder, entry.name), { recursive: true, force: true });
    } else if (entry.name !== "_index.md") {
      fs.unlinkSync(path.join(folder, entry.name));
    }
  }
}

function writeTypeIndex(typeName, folder) {
  const indexPath = path.join(folder, "_index.md");
  const content = `---
title: "${typeName}"
type: landing
cascade:
  show_breadcrumb: true
---
`;
  fs.writeFileSync(indexPath, content);
}

function writeEntry(folder, slug, frontmatter, body) {
  const dir = path.join(folder, slug);
  ensureDir(dir);
  const fmLines = ["---", frontmatter.trim(), "---", "", body.trim(), ""].join("\n");
  fs.writeFileSync(path.join(dir, "index.md"), fmLines);
}

function buildFrontmatter({ title, date, authors, summary, tags, icon, link, doi }) {
  const lines = [];
  lines.push(`title: "${yamlEscape(title)}"`);
  if (date) lines.push(`date: ${date}`);
  if (summary) lines.push(`summary: "${yamlEscape(summary)}"`);
  if (authors.length) {
    lines.push("authors:");
    authors.forEach((a) => lines.push(`  - "${yamlEscape(a)}"`));
  }
  if (tags?.length) {
    lines.push("tags:");
    tags.forEach((t) => lines.push(`  - "${yamlEscape(t)}"`));
  }
  const linkEntries = [];
  if (link) {
    linkEntries.push({
      icon,
      icon_pack: "fas",
      name: tags?.includes("Webinar") ? "Watch Now" : "View Online",
      url: link,
    });
  }
  if (doi && (!link || !link.includes("doi.org"))) {
    linkEntries.push({
      icon: "link",
      icon_pack: "fas",
      name: "DOI",
      url: `https://doi.org/${doi}`,
    });
  }
  if (linkEntries.length) {
    lines.push("links:");
    for (const l of linkEntries) {
      lines.push(`  - icon: ${l.icon}`);
      lines.push(`    icon_pack: ${l.icon_pack}`);
      lines.push(`    name: "${yamlEscape(l.name)}"`);
      lines.push(`    url: "${yamlEscape(l.url)}"`);
    }
  }
  return lines.join("\n");
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

  // Reset all known type folders so deleted Zotero items disappear from the site.
  for (const folder of Object.values(TYPE_FOLDERS)) {
    const fullFolder = path.join(pubsDir, folder);
    ensureDir(fullFolder);
    clearTypeFolder(fullFolder);
  }

  const usedSlugs = {};
  let written = 0;

  for (const it of items) {
    if (it.data.itemType === "attachment") continue;
    const typeName = categorize(it);
    const folderName = TYPE_FOLDERS[typeName];
    if (!folderName) continue;
    const folder = path.join(pubsDir, folderName);

    const normalizedBib = normalizeBibDate(it.bib || "", it.data.date);
    let linkedBib = linkify(normalizedBib);
    let safeBib = sanitizeHtml(linkedBib);
    if (typeName === "Presentations") safeBib = stripInlineUrls(safeBib);
    safeBib = boldName(safeBib);

    const title = stripHtml(it.data.title || "Untitled");
    const year = extractYear(it.data.date) || extractYear(it.bib || "");
    const date = year ? `${year}-01-01` : undefined;
    const authors = formatAuthors(it.data.creators);
    const link = safeBib.match(hrefRegex)?.[1] || it.data.url || "";
    const doi = it.data.DOI || "";
    const abstract = stripHtml(it.data.abstractNote || "");
    const citationPlain = stripHtml(safeBib);
    const summary = abstract
      ? abstract.slice(0, 240) + (abstract.length > 240 ? "…" : "")
      : citationPlain.slice(0, 240) + (citationPlain.length > 240 ? "…" : "");

    const tags = [typeName.replace(/s$/, "")];
    if (typeName === "Webinars") tags.push("Webinar");

    const icon = TYPE_ICONS[typeName] || "file-lines";

    const fm = buildFrontmatter({
      title,
      date,
      authors,
      summary,
      tags,
      icon,
      link,
      doi,
    });

    const body = [
      `{{< citation >}}`,
      safeBib,
      `{{< /citation >}}`,
      "",
      abstract ? `## Abstract\n\n${abstract}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let slug = slugify(title) || `item-${it.key}`;
    usedSlugs[folderName] ??= new Set();
    let unique = slug;
    let n = 2;
    while (usedSlugs[folderName].has(unique)) {
      unique = `${slug}-${n++}`;
    }
    usedSlugs[folderName].add(unique);

    writeEntry(folder, unique, fm, body);
    written++;
  }

  for (const [typeName, folderName] of Object.entries(TYPE_FOLDERS)) {
    writeTypeIndex(typeName, path.join(pubsDir, folderName));
  }

  console.log(`Wrote ${written} publication entries under content/pubs/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
