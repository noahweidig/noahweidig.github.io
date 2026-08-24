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
 * It also stamps the current year into the footer copyright notice (the
 * <span data-nw-copyright-year> element from _quarto.yml) on every rendered
 * page, so the year rolls over automatically with each render instead of
 * waiting for a manual bump every January.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.env.QUARTO_PROJECT_DIR ??
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
  stampCopyrightYear(outputDir);
}

/**
 * Publications page impact strip.
 *
 * Counts what publications/*index.qmd actually contains — total entries,
 * journal articles, works where the owner is first author (the citation
 * string starts with the bolded owner name), and the citation total that
 * scripts/update-pubs.js pulls from OpenAlex into `pub-citations`. The
 * numbers in the source are only fallbacks, same as the featured-projects
 * stat above.
 *
 * Non-fatal by design: the site renders fine with the fallback numbers, so a
 * missing page or marker warns rather than failing the whole render.
 */
function stampPublicationStats(projectRoot: string, outputDir: string): void {
  const pubsDir = path.join(projectRoot, "publications");
  if (!fs.existsSync(pubsDir)) return;

  let total = 0;
  let journal = 0;
  let first = 0;
  let citations = 0;
  for (const entry of fs.readdirSync(pubsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(pubsDir, entry.name, "index.qmd");
    if (!fs.existsSync(page)) continue;
    const fm = frontmatter(page);
    total++;
    if (/^categories:.*"Journal Article"/m.test(fm)) journal++;
    // "pub-authors: \"**Weidig, N. C.**, ...\"" — owner first means the
    // bolded name opens the author string.
    if (/^pub-authors:\s*"\*\*/m.test(fm)) first++;
    const cited = fm.match(/^pub-citations:\s*(\d+)\s*$/m);
    if (cited) citations += Number(cited[1]);
  }

  const page = path.join(outputDir, "publications", "index.html");
  if (!fs.existsSync(page)) {
    console.warn(`[stats] rendered publications page not found: ${page}`);
    return;
  }
  let html = fs.readFileSync(page, "utf8");
  const before = html;
  const set = (key: string, value: number) => {
    const re = new RegExp(`(<b data-nw-stat="${key}">)[^<]*(</b>)`);
    if (!re.test(html)) {
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
