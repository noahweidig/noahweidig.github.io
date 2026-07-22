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
}

main();
