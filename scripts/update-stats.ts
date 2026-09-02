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

interface PublicationTotals {
  total: number;
  journal: number;
  first: number;
  citations: number;
}

/** Tallies read straight out of the publications/*\/index.qmd frontmatter. */
function countPublications(pubsDir: string): PublicationTotals {
  const totals: PublicationTotals = { total: 0, journal: 0, first: 0, citations: 0 };
  for (const entry of fs.readdirSync(pubsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(pubsDir, entry.name, "index.qmd");
    if (!fs.existsSync(page)) continue;
    const fm = frontmatter(page);
    // Repeat appearances of one work keep their own page but are not listed
    // (#253); counting them would inflate "Publications & Talks" the same way
    // the duplicated rows used to inflate the list.
    if (/^pub-appearance-of:/m.test(fm)) continue;
    totals.total++;
    if (/^categories:.*"Journal Article"/m.test(fm)) totals.journal++;
    // "pub-authors: \"**Weidig, N. C.**, ...\"" — owner first means the
    // bolded name opens the author string.
    if (/^pub-authors:\s*"\*\*/m.test(fm)) totals.first++;
    const cited = /^pub-citations:\s*(\d+)\s*$/m.exec(fm);
    if (cited) totals.citations += Number(cited[1]);
  }
  return totals;
}

/**
 * Publications page impact strip.
 *
 * Stamps the counts from countPublications() — total entries, journal
 * articles, works where the owner is first author, and the citation total
 * scripts/update-pubs.js pulls from OpenAlex into `pub-citations` — over the
 * fallback numbers in the page source, same as the featured-projects stat
 * above.
 *
 * Non-fatal by design: the site renders fine with the fallback numbers, so a
 * missing page or marker warns rather than failing the whole render.
 */
function stampPublicationStats(projectRoot: string, outputDir: string): void {
  const pubsDir = path.join(projectRoot, "publications");
  if (!fs.existsSync(pubsDir)) return;

  const { total, journal, first, citations } = countPublications(pubsDir);

  const page = path.join(outputDir, "publications", "index.html");
  if (!fs.existsSync(page)) {
    console.warn(`[stats] rendered publications page not found: ${page}`);
    return;
  }
  let html = fs.readFileSync(page, "utf8");
  const before = html;
  const set = (key: string, value: number) => {
    const re = new RegExp(`(<b data-nw-stat="${key}">)[^<]*(</b>)`);
    if (!re.exec(html)) {
      console.warn(`[stats] publications stat marker "${key}" not found`);
      return;
    }
    html = html.replace(re, `$1${value}$2`);
  };
  set("pub-total", total);
  set("pub-journal", journal);
  set("pub-first", first);
  if (citations > 0) {
    set("pub-citations", citations);
  } else {
    // No citation counts synced yet (or the OpenAlex lookup came back empty):
    // drop the stat rather than advertising a zero.
    html = html.replace(
      /<div class="nw-stat" data-nw-stat-block="pub-citations">[\s\S]*?<\/div>\s*<\/div>/,
      "</div>",
    );
  }
  if (html !== before) fs.writeFileSync(page, html);
  console.log(
    `[stats] publications: ${total} total, ${journal} journal, ${first} first-author, ${citations} citations`,
  );
}

interface AwardTotals {
  total: number;
  funding: number;
  institutions: number;
  years: number;
}

/**
 * Tallies read straight out of the awards/*\/index.qmd frontmatter.
 *
 * The `description` line carries the awarding body and, where the honor came
 * with money, the amount: "Institution, Unit · $1,650". So the institution is
 * whatever precedes the first comma or the middle dot, and the funding is the
 * dollar figure — multiplied out when the award recurs ("$27,500 annually for
 * two years").
 */
function countAwards(awardsDir: string): AwardTotals {
  let total = 0;
  let funding = 0;
  const institutions = new Set<string>();
  const years = new Set<string>();
  for (const entry of fs.readdirSync(awardsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(awardsDir, entry.name, "index.qmd");
    if (!fs.existsSync(page)) continue;
    const fm = frontmatter(page);
    total++;

    const date = /^date:\s*'?(\d{4})/m.exec(fm);
    if (date) years.add(date[1]);

    // Quarto wraps long frontmatter values across lines, so fold the
    // continuation lines back in before reading the description.
    const desc = /^description:\s*([\s\S]*?)(?=\n\S)/m.exec(fm);
    if (!desc) continue;
    const text = desc[1].replace(/\s+/g, " ").trim();

    const institution = text.split("\u00b7")[0].split(",")[0].trim();
    if (institution) institutions.add(institution);

    const amount = /\$([\d,]+)/.exec(text);
    if (amount) {
      const value = Number(amount[1].replace(/,/g, ""));
      // "$27,500 annually for two years" is $55,000 of support, not $27,500.
      const recurring = /annually for (\w+) years?/i.exec(text);
      const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
      const spelled = recurring ? words[recurring[1].toLowerCase()] : undefined;
      const digits = recurring ? Number(recurring[1]) : NaN;
      const times = spelled ?? (Number.isFinite(digits) && digits > 0 ? digits : 1);
      funding += value * times;
    }
  }
  return { total, funding, institutions: institutions.size, years: years.size };
}

/** "$64k" from 63,625 — round figures, since that is how the strip reads. */
function formatFunding(dollars: number): string {
  if (dollars >= 1000) return `$${Math.round(dollars / 1000)}k`;
  return `$${dollars}`;
}

/**
 * Awards page impact strip.
 *
 * Same contract as stampPublicationStats(): the numbers in awards/index.qmd
 * are fallbacks, and these derived ones replace them at render time so they
 * can't drift as awards are added. Non-fatal by design.
 */
function stampAwardStats(projectRoot: string, outputDir: string): void {
  const awardsDir = path.join(projectRoot, "awards");
  if (!fs.existsSync(awardsDir)) return;

  const { total, funding, institutions, years } = countAwards(awardsDir);

  const page = path.join(outputDir, "awards", "index.html");
  if (!fs.existsSync(page)) {
    console.warn(`[stats] rendered awards page not found: ${page}`);
    return;
  }
  let html = fs.readFileSync(page, "utf8");
  const before = html;
  const set = (key: string, value: string | number) => {
    const re = new RegExp(`(<b data-nw-stat="${key}">)[^<]*(</b>)`);
    if (!re.exec(html)) {
      console.warn(`[stats] awards stat marker "${key}" not found`);
      return;
    }
    html = html.replace(re, `$1${value}$2`);
  };
  set("award-total", total);
  set("award-funding", formatFunding(funding));
  set("award-institutions", institutions);
  set("award-years", years);
  if (html !== before) fs.writeFileSync(page, html);
  console.log(
    `[stats] awards: ${total} total, ${formatFunding(funding)} awarded, ${institutions} institutions, ${years} years`,
  );
}

interface ProjectTotals {
  total: number;
  featured: number;
  categories: number;
  latest: string;
}

/** Tallies read straight out of the projects/*\/index.qmd frontmatter. */
function countProjects(projectsDir: string): ProjectTotals {
  let total = 0;
  let featured = 0;
  const categories = new Set<string>();
  let latest = "";
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(projectsDir, entry.name, "index.qmd");
    if (!fs.existsSync(page)) continue;
    const fm = frontmatter(page);
    total++;
    if (/^featured:\s*true\s*$/m.test(fm)) featured++;

    const date = /^date:\s*'?(\d{4})/m.exec(fm);
    if (date && date[1] > latest) latest = date[1];

    // categories:\n- R\n- Data Science — the block runs until the next
    // top-level key.
    const block = /^categories:\s*\n((?:\s*-\s.*\n?)+)/m.exec(fm);
    if (block) {
      for (const line of block[1].split("\n")) {
        const name = /^\s*-\s*(.+?)\s*$/.exec(line);
        if (name) categories.add(name[1].replace(/^["']|["']$/g, ""));
      }
    }
  }
  return { total, featured, categories: categories.size, latest };
}

/**
 * Projects page stat strip.
 *
 * Same contract as the two above: the numbers in projects/index.qmd are
 * fallbacks, replaced at render time by these derived ones. Non-fatal.
 */
function stampProjectStats(projectRoot: string, outputDir: string): void {
  const projectsDir = path.join(projectRoot, "projects");
  if (!fs.existsSync(projectsDir)) return;

  const { total, featured, categories, latest } = countProjects(projectsDir);

  const page = path.join(outputDir, "projects", "index.html");
  if (!fs.existsSync(page)) {
    console.warn(`[stats] rendered projects page not found: ${page}`);
    return;
  }
  let html = fs.readFileSync(page, "utf8");
  const before = html;
  const set = (key: string, value: string | number) => {
    const re = new RegExp(`(<b data-nw-stat="${key}">)[^<]*(</b>)`);
    if (!re.exec(html)) {
      console.warn(`[stats] projects stat marker "${key}" not found`);
      return;
    }
    html = html.replace(re, `$1${value}$2`);
  };
  set("project-total", total);
  set("project-featured", featured);
  set("project-categories", categories);
  if (latest) set("project-latest", latest);
  if (html !== before) fs.writeFileSync(page, html);
  console.log(
    `[stats] projects: ${total} total, ${featured} featured, ${categories} categories, latest ${latest}`,
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
