/**
 * generate-post-covers.ts — on-brand cover art for blog posts.
 *
 * Run by hand when a post is added; the covers it writes are committed next to
 * the post they belong to, so `quarto render` stays the only build step and
 * nothing here runs in CI:
 *
 *   node --experimental-strip-types scripts/generate-post-covers.ts
 *
 * For every `blog/<slug>/index.qmd` it composes a 1200x675 card — the site's
 * brand gradient under the topographic texture from
 * assets/media/topography.svg, with the post's category and title set in
 * Inter — and writes it to `blog/<slug>/cover.webp`. Each post gets its own
 * gradient angle and hue rotation, derived from the slug, so three cards side
 * by side read as a family without looking like three copies.
 *
 * Rasterizing reuses the resvg WebAssembly build and the static Inter faces
 * already vendored under scripts/vendor for scripts/generate-og.ts. resvg
 * emits PNG, which for a full-bleed gradient is ~650 KB a card, so the PNG is
 * re-encoded to WebP (~50 KB) by whichever encoder the machine has — `cwebp`,
 * or Pillow through python3 — and only the WebP is kept. With neither
 * available the script stops rather than committing a heavyweight PNG.
 *
 * Existing covers are left alone unless --force is passed, so hand-made
 * artwork for a post is never overwritten.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { BRAND, esc, FONT, initRasterizer, rasterize, topoPath, wrap } from "./brand-art.ts";
import { projectRoot } from "./site-output.ts";

const W = 1200;
const H = 675;
const M = 78; // safe-area margin

/** Per-post variation: gradient direction plus which brand hue leads. */
const VARIANTS = [
  { x1: 0, y1: 0, x2: 1, y2: 1, stops: [BRAND.gradFrom, BRAND.gradMid, BRAND.gradTo] },
  { x1: 0, y1: 1, x2: 1, y2: 0, stops: [BRAND.gradTo, BRAND.gradFrom, BRAND.gradMid] },
  { x1: 0, y1: 0, x2: 1, y2: 0.4, stops: [BRAND.gradMid, BRAND.gradTo, BRAND.gradFrom] },
  { x1: 0.1, y1: 0, x2: 0.9, y2: 1, stops: [BRAND.gradMid, BRAND.gradFrom, BRAND.gradTo] },
];

function variantFor(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return VARIANTS[h % VARIANTS.length];
}

/**
 * Title and categories out of a post's YAML front matter. Scanned line by
 * line rather than matched with one big regex: the block form of
 * `categories:` is a repeated group, and a regex for it backtracks badly on a
 * long front matter.
 */
function readFrontMatter(file: string): { title: string; categories: string[] } {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  if (lines[0].trim() !== "---") throw new Error(`[covers] no front matter in ${file}`);

  const unquote = (v: string) => v.trim().replace(/^["']/, "").replace(/["']$/, "");
  let title = "";
  const categories: string[] = [];
  let inCategories = false;

  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;
    if (inCategories) {
      const item = line.match(/^\s*-\s*(.*)$/);
      if (item) {
        const value = unquote(item[1]);
        if (value) categories.push(value);
        continue;
      }
      inCategories = false;
    }
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!entry) continue;
    const [, key, rest] = entry;
    if (key === "title") title = unquote(rest);
    if (key !== "categories") continue;
    // Either `categories: [a, b]` on one line, or a block of `- a` below it.
    const inline = rest.trim();
    if (inline.startsWith("[")) {
      for (const c of inline.replace(/^\[/, "").replace(/\]$/, "").split(",")) {
        const value = unquote(c);
        if (value) categories.push(value);
      }
    } else if (!inline) {
      inCategories = true;
    }
  }
  return { title, categories };
}

function renderCoverSvg(title: string, kicker: string, slug: string, topo: string): string {
  const v = variantFor(slug);
  const textW = W - 2 * M;

  // Largest size whose wrapped title still fits the three-line text block.
  let size = 70;
  let lines = wrap(title, size, 0.53, textW, 3);
  for (const candidate of [70, 60, 50, 42]) {
    size = candidate;
    lines = wrap(title, candidate, 0.53, textW, 3);
    if (lines.length <= 3) break;
  }
  const lineH = Math.round(size * 1.16);
  // Text block is bottom-anchored, above the rule at the foot of the card.
  const lastBaseline = H - M - 70;
  const firstBaseline = lastBaseline - (lines.length - 1) * lineH;
  const spans = lines
    .map((l, i) => `<tspan x="${M}" y="${firstBaseline + i * lineH}">${esc(l)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="nw-grad" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}">
      <stop offset="0" stop-color="${v.stops[0]}"/>
      <stop offset="0.5" stop-color="${v.stops[1]}"/>
      <stop offset="1" stop-color="${v.stops[2]}"/>
    </linearGradient>
    <linearGradient id="nw-scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.06"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.42"/>
    </linearGradient>
    <pattern id="nw-topo" width="900" height="900" patternUnits="userSpaceOnUse">
      <path d="${topo}" transform="scale(1.5)" fill="${BRAND.contour}" fill-opacity="0.22"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#nw-grad)"/>
  <rect width="${W}" height="${H}" fill="url(#nw-topo)"/>
  <rect width="${W}" height="${H}" fill="url(#nw-scrim)"/>
  <text x="${M}" y="${M + 26}" font-family="${FONT}" font-size="23" font-weight="800" letter-spacing="5" fill="${BRAND.fg}" fill-opacity="0.9">${esc(kicker.toUpperCase())}</text>
  <text font-family="${FONT}" font-size="${size}" font-weight="800" letter-spacing="${(-0.02 * size).toFixed(2)}" fill="${BRAND.fg}">${spans}</text>
  <rect x="${M}" y="${H - M - 40}" width="86" height="5" rx="2.5" fill="${BRAND.fg}" fill-opacity="0.85"/>
  <text x="${W - M}" y="${H - M - 28}" text-anchor="end" font-family="${FONT}" font-size="23" font-weight="800" fill="${BRAND.fg}" fill-opacity="0.9">noahweidig.com</text>
</svg>
`;
}

/** Where libwebp installs `cwebp` — the same lookup optimize-output.ts uses —
 *  and where a python3 carrying Pillow is likely to be. Both lists are
 *  absolute: an encoder is never resolved through PATH. */
const CWEBP_PATHS = ["/usr/bin/cwebp", "/usr/local/bin/cwebp", "/opt/homebrew/bin/cwebp"];
const PYTHON_PATHS = ["/usr/bin/python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3"];

const PILLOW_ENCODE =
  "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB')" +
  ".save(sys.argv[2],'WEBP',quality=82,method=6)";

/** Re-encode `png` as WebP at `out`, via cwebp or Pillow, whichever exists. */
function toWebp(png: string, out: string): void {
  const cwebp = CWEBP_PATHS.find((p) => fs.existsSync(p));
  if (cwebp) {
    execFileSync(cwebp, ["-quiet", "-q", "82", "-m", "6", png, "-o", out]);
    return;
  }
  for (const python of PYTHON_PATHS.filter((p) => fs.existsSync(p))) {
    try {
      execFileSync(python, ["-c", PILLOW_ENCODE, png, out], { stdio: "ignore" });
      if (fs.existsSync(out)) return;
    } catch {
      // no Pillow in this interpreter — try the next one
    }
  }
  fs.rmSync(png, { force: true });
  throw new Error(
    "[covers] no WebP encoder found — install libwebp (cwebp) or python3 Pillow and re-run",
  );
}

async function main() {
  const force = process.argv.includes("--force");
  const blogDir = path.join(projectRoot, "blog");
  const topo = topoPath();
  const fonts = await initRasterizer();

  for (const slug of fs.readdirSync(blogDir).sort()) {
    const postDir = path.join(blogDir, slug);
    const qmd = path.join(postDir, "index.qmd");
    if (!fs.statSync(postDir).isDirectory() || !fs.existsSync(qmd)) continue;

    const out = path.join(postDir, "cover.webp");
    if (fs.existsSync(out) && !force) {
      console.log(`[covers] ${slug}/cover.webp exists — skipped (--force to redraw)`);
      continue;
    }
    const { title, categories } = readFrontMatter(qmd);
    const svg = renderCoverSvg(title, categories[0] || "Writing", slug, topo);
    const png = path.join(postDir, "cover.png");
    fs.writeFileSync(png, rasterize(svg, fonts, W));
    toWebp(png, out);
    fs.rmSync(png);
    console.log(`[covers] wrote blog/${slug}/cover.webp`);
  }
}

await main();
