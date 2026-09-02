/**
 * page-headers.ts — give every main page the 404 page's header treatment.
 *
 * Runs as a Quarto post-render step (see `project.post-render` in
 * _quarto.yml). Quarto executes it with its bundled Deno; for local debugging
 * it also runs under Node:
 *
 *   node --experimental-strip-types scripts/page-headers.ts
 *
 * The 404 page hand-writes its header (kicker + centered h1 + centered
 * subtitle) because it has no Quarto title block. Every other page gets one
 * from Quarto, and the template gives no way to put anything above the <h1>,
 * so the kicker is stamped in here instead of being repeated by hand in ten
 * .qmd files. Nothing is hand-maintained: a new top-level section picks the
 * treatment up on its next render.
 *
 * Which pages: the site's main pages — a root-level page (`/cv.html`,
 * `/contact.html`, ...) or a section index (`/projects/`, `/blog/`, ...).
 * Detail pages (`/blog/<post>/`), the landing page and the 404 page are all
 * left alone; the first two keep their own headers, the third already is the
 * design being copied.
 *
 * The kicker's text comes from a `kicker:` key in the page's own front
 * matter, so it lives next to the title it labels. A page without one falls
 * back to its navbar label, and a page with neither is still centered — the
 * kicker line is simply omitted rather than the page being skipped.
 */

import fs from "node:fs";
import path from "node:path";
import { outputDir, projectRoot, walkHtml } from "./site-output.ts";

/** Rendered pages that are never given the treatment, as site-root URLs. */
const EXCLUDED = new Set(["/index.html", "/404.html"]);

/**
 * The `kicker:` value in a source .qmd's front matter, if it has one. Parsed
 * by hand rather than with a YAML dependency, the same way the other
 * post-render scripts read _quarto.yml: the key is a plain top-level scalar
 * and these scripts deliberately run with nothing to install.
 */
function frontMatterKicker(qmd: string): string | null {
  if (!fs.existsSync(qmd)) return null;
  const source = fs.readFileSync(qmd, "utf8");
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?$/m.exec(source);
  if (!fence) return null;
  const line = /^kicker:\s*(.*?)\s*$/m.exec(fence[1]);
  return line ? unquote(line[1]) || null : null;
}

/**
 * The navbar's `text:` for a site-root URL, used when a page sets no kicker
 * of its own. Same flat `- text:` / `href:` list build-404.ts reads.
 */
function navLabels(yml: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const lines = yml.split("\n");
  const start = lines.findIndex((line) => /^\s{4}left:\s*$/.test(line));
  if (start < 0) return labels;
  let text: string | null = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (!/^\s{6}/.test(line)) break;
    const entry = /^\s+-\s*text:\s*(.*?)\s*$/.exec(line);
    if (entry) {
      text = unquote(entry[1]);
      continue;
    }
    const href = /^\s+href:\s*(.*?)\s*$/.exec(line);
    if (href && text) {
      labels[toUrl(unquote(href[1]))] = text;
      text = null;
    }
  }
  return labels;
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

/** `foo/index.qmd` → `/foo/`, `foo.qmd` → `/foo.html` (see build-404.ts). */
function toUrl(href: string): string {
  const clean = href.replace(/^\//, "");
  if (clean.endsWith("/index.qmd")) return `/${clean.slice(0, -"index.qmd".length)}`;
  return `/${clean.replace(/\.qmd$/, ".html")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True for `<name>.html` at the root and `<section>/index.html`, and only those. */
function isMainPage(relative: string): boolean {
  const url = `/${relative.split(path.sep).join("/")}`;
  if (EXCLUDED.has(url)) return false;
  const depth = url.split("/").length - 1;
  if (depth === 1) return true;
  return depth === 2 && url.endsWith("/index.html");
}

function main(): void {
  const labels = navLabels(fs.readFileSync(path.join(projectRoot, "_quarto.yml"), "utf8"));
  const touched: string[] = [];

  for (const file of walkHtml(outputDir)) {
    const relative = path.relative(outputDir, file);
    if (!isMainPage(relative)) continue;

    const html = fs.readFileSync(file, "utf8");
    // Pages without a Quarto title block (the landing page's `pagetitle:`
    // pattern) have no header to treat, and one already stamped is left alone
    // so a re-render can't double the kicker.
    const header = /<header id="title-block-header" class="([^"]*)"/.exec(html);
    if (!header || header[1].includes("nw-page-head")) continue;

    const source = path.join(projectRoot, relative.replace(/\.html$/, ".qmd"));
    const url = `/${relative.split(path.sep).join("/")}`;
    const kicker =
      frontMatterKicker(source) ?? labels[url] ?? labels[url.replace(/index\.html$/, "")] ?? null;

    let out = html.replace(
      header[0],
      `<header id="title-block-header" class="${header[1]} nw-page-head"`,
    );
    if (kicker) {
      // Quarto's template puts nothing above the <h1>, so the kicker goes in
      // directly before it — inside .quarto-title, where the header's own
      // centering and spacing already apply.
      out = out.replace(
        /<h1 class="title"/,
        `<p class="nw-kicker">${escapeHtml(kicker)}</p>\n<h1 class="title"`,
      );
    }
    if (out !== html) {
      fs.writeFileSync(file, out);
      touched.push(`${url}${kicker ? ` (${kicker})` : ""}`);
    }
  }

  console.log(`[page-headers] ${touched.length} page(s): ${touched.join(", ")}`);
}

main();
