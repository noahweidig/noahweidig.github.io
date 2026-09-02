/**
 * update-stats.ts — keep the landing-page hero stats honest.
 *
 * Runs as a Quarto post-render step (see `project.post-render` in
 * _quarto.yml). Quarto executes it with its bundled Deno, so there are no
 * dependencies to install; for local debugging it also runs under Node:
 *
 *   node --experimental-strip-types scripts/update-stats.ts
 *
 * It counts the project pages whose frontmatter sets `featured: true` and
 * writes that number into the "Featured Projects" stat on the rendered home
 * page (the <b data-nw-stat="featured-projects"> element in index.qmd). The
 * number in the source is only a fallback — deriving it here at every render
 * means the stat can't drift when projects are added or unfeatured.
 *
 * The stat strips on the publications, awards, and projects listing pages work
 * the same way: every number in those pages is a fallback, derived here from
 * the entries' own frontmatter on each render, so no strip has to be updated
 * by hand when an entry is added.
 *
 * It also stamps the current year into the footer copyright notice (the
 * <span data-nw-copyright-year> element from _quarto.yml) on every rendered
 * page, so the year rolls over automatically with each render instead of
 * waiting for a manual bump every January.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot =
  process.env.QUARTO_PROJECT_DIR ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outputDir = process.env.QUARTO_PROJECT_OUTPUT_DIR
  ? path.resolve(projectRoot, process.env.QUARTO_PROJECT_OUTPUT_DIR)
  : path.join(projectRoot, "_site");

function frontmatter(file: string): string {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : "";
}

function main(): void {
  const projectsDir = path.join(projectRoot, "projects");
  let featured = 0;
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(projectsDir, entry.name, "index.qmd");
    if (fs.existsSync(page) && /^featured:\s*true\s*$/m.test(frontmatter(page))) {
      featured++;
    }
  }

  const home = path.join(outputDir, "index.html");
  if (!fs.existsSync(home)) {
    console.error(`[stats] rendered home page not found: ${home}`);
    process.exit(1);
  }
  const html = fs.readFileSync(home, "utf8");
  const re = /(<b data-nw-stat="featured-projects">)[^<]*(<\/b>)/;
  if (!re.test(html)) {
    console.error("[stats] featured-projects stat marker not found in index.html");
    process.exit(1);
  }
  const out = html.replace(re, `$1${featured}$2`);
  if (out !== html) fs.writeFileSync(home, out);
  console.log(`[stats] featured projects: ${featured}`);

  stampPublicationStats(projectRoot, outputDir);
  stampAwardStats(projectRoot, outputDir);
  stampProjectStats(projectRoot, outputDir);
  stampCopyrightYear(outputDir);
}

/** Every entry page under a listing directory, as its front-matter block. */
function* entryFrontmatter(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(dir, entry.name, "index.qmd");
    if (fs.existsSync(page)) yield frontmatter(page);
  }
}

/**
 * One front-matter value, with Quarto's wrapped continuation lines folded
 * back in. Line-based rather than a multi-line regex: the values here run to
 * a couple of hundred characters and a backtracking pattern over them is a
 * needless risk.
 */
function fmValue(fm: string, key: string): string {
  const lines = fm.split("\n");
  const head = `${key}:`;
  const at = lines.findIndex((line) => line.startsWith(head));
  if (at < 0) return "";
  const parts = [lines[at].slice(head.length)];
  // A continuation line is indented; the next top-level key is not.
  for (let i = at + 1; i < lines.length && /^\s/.test(lines[i]); i++) parts.push(lines[i]);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** The items of a front-matter list ("categories:\n- R\n- Data Science"). */
function fmList(fm: string, key: string): string[] {
  const lines = fm.split("\n");
  const at = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (at < 0) return [];
  const items: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const item = /^\s*-\s*(.*?)\s*$/.exec(lines[i]);
    if (!item) break;
    items.push(item[1].replace(/^["']|["']$/g, ""));
  }
  return items;
}

/**
 * Stamps derived numbers over the fallbacks in one rendered stat strip.
 *
 * Every strip on the site works the same way: the numbers in the page source
 * are placeholders, and the <b data-nw-stat="..."> markers are rewritten here
 * at render time from the entries' own front matter, so a strip can't drift
 * as entries are added or changed.
 *
 * Non-fatal by design: the site renders fine with the fallback numbers, so a
 * missing page or marker warns rather than failing the whole render. `edit`
 * is for a strip that needs more than a number swapped — see the citations
 * stat below.
 */
function stampStrip(
  page: string,
  label: string,
  values: Record<string, string | number>,
  edit?: (_html: string) => string,
): void {
  if (!fs.existsSync(page)) {
    console.warn(`[stats] rendered ${label} page not found: ${page}`);
    return;
  }
  let html = fs.readFileSync(page, "utf8");
  const before = html;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`(<b data-nw-stat="${key}">)[^<]*(</b>)`);
    if (!re.exec(html)) {
      console.warn(`[stats] ${label} stat marker "${key}" not found`);
      continue;
    }
    html = html.replace(re, `$1${value}$2`);
  }
  if (edit) html = edit(html);
  if (html !== before) fs.writeFileSync(page, html);
}

/**
 * Publications page impact strip: total entries, journal articles, works
 * where the owner is first author, and the citation total
 * scripts/update-pubs.js pulls from OpenAlex into `pub-citations`.
 */
function stampPublicationStats(projectRoot: string, outputDir: string): void {
  const pubsDir = path.join(projectRoot, "publications");
  if (!fs.existsSync(pubsDir)) return;

  let total = 0;
  let journal = 0;
  let first = 0;
  let citations = 0;
  for (const fm of entryFrontmatter(pubsDir)) {
    // Repeat appearances of one work keep their own page but are not listed
    // (#253); counting them would inflate "Publications & Talks" the same way
    // the duplicated rows used to inflate the list.
    if (fmValue(fm, "pub-appearance-of")) continue;
    total++;
    if (fmValue(fm, "categories").includes('"Journal Article"')) journal++;
    // 'pub-authors: "**Weidig, N. C.**, ..."' — owner first means the bolded
    // name opens the author string.
    if (fmValue(fm, "pub-authors").startsWith('"**')) first++;
    const cited = Number(fmValue(fm, "pub-citations"));
    if (Number.isFinite(cited)) citations += cited;
  }

  const values: Record<string, number> = {
    "pub-total": total,
    "pub-journal": journal,
    "pub-first": first,
  };
  if (citations > 0) values["pub-citations"] = citations;
  stampStrip(
    path.join(outputDir, "publications", "index.html"),
    "publications",
    values,
    citations > 0
      ? undefined
      : // No citation counts synced yet (or the OpenAlex lookup came back
        // empty): drop the stat rather than advertising a zero.
        (html) =>
          html.replace(
            /<div class="nw-stat" data-nw-stat-block="pub-citations">[\s\S]*?<\/div>\s*<\/div>/,
            "</div>",
          ),
  );
  console.log(
    `[stats] publications: ${total} total, ${journal} journal, ${first} first-author, ${citations} citations`,
  );
}

/** The four-digit year of an entry's `date`, or "" when it has none. */
function fmYear(fm: string): string {
  const date = /^'?(\d{4})/.exec(fmValue(fm, "date"));
  return date ? date[1] : "";
}

/** "$64k" from 63,625 — round figures, since that is how the strip reads. */
function formatFunding(dollars: number): string {
  return dollars >= 1000 ? `$${Math.round(dollars / 1000)}k` : `$${dollars}`;
}

/**
 * Awards page impact strip.
 *
 * The `description` carries the awarding body and, where the honor came with
 * money, the amount: "Institution, Unit · $1,650". So the institution is
 * whatever precedes the first comma or the middle dot, and the funding is the
 * dollar figure — multiplied out when the award recurs ("$27,500 annually for
 * two years" is $55,000 of support, not $27,500).
 */
function stampAwardStats(projectRoot: string, outputDir: string): void {
  const awardsDir = path.join(projectRoot, "awards");
  if (!fs.existsSync(awardsDir)) return;

  const spelled: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
  let total = 0;
  let funding = 0;
  const institutions = new Set<string>();
  const years = new Set<string>();
  for (const fm of entryFrontmatter(awardsDir)) {
    total++;
    const year = fmYear(fm);
    if (year) years.add(year);

    const desc = fmValue(fm, "description");
    const institution = desc.split("·")[0].split(",")[0].trim();
    if (institution) institutions.add(institution);

    const amount = /\$([\d,]+)/.exec(desc);
    if (!amount) continue;
    const recurring = /annually for (\w+) years?/i.exec(desc);
    const digits = recurring ? Number(recurring[1]) : NaN;
    const times = recurring
      ? (spelled[recurring[1].toLowerCase()] ??
        (Number.isFinite(digits) && digits > 0 ? digits : 1))
      : 1;
    funding += Number(amount[1].replace(/,/g, "")) * times;
  }

  stampStrip(path.join(outputDir, "awards", "index.html"), "awards", {
    "award-total": total,
    "award-funding": formatFunding(funding),
    "award-institutions": institutions.size,
    "award-years": years.size,
  });
  console.log(
    `[stats] awards: ${total} total, ${formatFunding(funding)} awarded, ${institutions.size} institutions, ${years.size} years`,
  );
}

/**
 * Projects page stat strip: how many projects there are, how many are
 * featured, how many topic areas they span, and the year of the most recent
 * one.
 */
function stampProjectStats(projectRoot: string, outputDir: string): void {
  const projectsDir = path.join(projectRoot, "projects");
  if (!fs.existsSync(projectsDir)) return;

  let total = 0;
  let featured = 0;
  let latest = "";
  const categories = new Set<string>();
  for (const fm of entryFrontmatter(projectsDir)) {
    total++;
    if (fmValue(fm, "featured") === "true") featured++;
    const year = fmYear(fm);
    if (year > latest) latest = year;
    for (const category of fmList(fm, "categories")) categories.add(category);
  }

  const values: Record<string, string | number> = {
    "project-total": total,
    "project-featured": featured,
    "project-categories": categories.size,
  };
  if (latest) values["project-latest"] = latest;
  stampStrip(path.join(outputDir, "projects", "index.html"), "projects", values);
  console.log(
    `[stats] projects: ${total} total, ${featured} featured, ${categories.size} categories, latest ${latest}`,
  );
}

function* htmlFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) yield full;
  }
}

function stampCopyrightYear(dir: string): void {
  const year = String(new Date().getFullYear());
  const re = /(<span data-nw-copyright-year[^>]*>)[^<]*(<\/span>)/g;
  let stamped = 0;
  for (const file of htmlFiles(dir)) {
    const html = fs.readFileSync(file, "utf8");
    const out = html.replace(re, `$1${year}$2`);
    if (out !== html) {
      fs.writeFileSync(file, out);
      stamped++;
    }
  }
  console.log(`[stats] copyright year ${year} stamped on ${stamped} page(s)`);
}

main();
