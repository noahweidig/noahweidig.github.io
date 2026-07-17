/**
 * generate-og.ts — automatic Open Graph card generation.
 *
 * Runs as a Quarto post-render step (see `project.post-render` in
 * _quarto.yml). Quarto executes it with its bundled Deno, so there are no
 * dependencies to install; for local debugging it also runs under Node:
 *
 *   node --experimental-strip-types scripts/generate-og.ts
 *
 * For every rendered HTML page in the output directory it:
 *   1. reads the page's title, description, author, and category/section
 *      straight out of the rendered <head> (so cards always match what
 *      Quarto rendered — nothing to update by hand);
 *   2. writes a deterministic 1200x630 pure-SVG card (text + procedural
 *      topographic contour lines seeded from the page's slug — no raster
 *      images, no external assets) to <output-dir>/assets/og/<slug>.svg;
 *   3. rewrites the page's og:image / twitter:image metadata to point at
 *      that card, using the absolute site-url from _quarto.yml.
 *
 * Design tokens mirror assets/theme.scss + theme-dark.scss: Inter, brand
 * blue #0076DF, background #0a0a0f, foreground #e5e7eb, muted #9ca3af,
 * contour/grid tints matching --nw-topo / --nw-grid-line.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------- config

const W = 1200;
const H = 630;

const BRAND = {
  bg: "#0a0a0f", // --nw-bg (dark)
  fg: "#f3f4f6", // near --nw-fg, brightened for card contrast
  body: "#e5e7eb", // --nw-fg (dark)
  muted: "#9ca3af", // --nw-muted (dark)
  primary: "#0076DF", // --nw-primary
  border: "#26262f", // --nw-border (dark)
  topo: "rgba(229,231,235,0.09)", // --nw-topo (dark), nudged for 630px canvas
  grid: "rgba(229,231,235,0.045)", // --nw-grid-line (dark)
  tick: "rgba(229,231,235,0.16)",
};

const FONT = `'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif`;
const MONO = `'SF Mono','JetBrains Mono',Menlo,Consolas,'Liberation Mono',monospace`;

const SITE_NAME = "Noah Weidig";
const SECTION_LABELS: Record<string, string> = {
  blog: "Blog",
  projects: "Projects",
  publications: "Publications",
  awards: "Awards",
};

const projectRoot = process.env.QUARTO_PROJECT_DIR ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outputDir = process.env.QUARTO_PROJECT_OUTPUT_DIR
  ? path.resolve(projectRoot, process.env.QUARTO_PROJECT_OUTPUT_DIR)
  : path.join(projectRoot, "_site");

// -------------------------------------------------------------- helpers

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** FNV-1a hash — stable seed so every page gets the same card each build. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Greedy word wrap using an average-glyph-width estimate for Inter. */
function wrap(text: string, fontSize: number, widthFactor: number, maxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * widthFactor)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  // Ellipsize if the text didn't fit.
  const used = lines.join(" ").length;
  if (used < text.replace(/\s+/g, " ").trim().length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.slice(0, Math.max(1, maxChars - 1)).replace(/[ ,.;:]+$/, "") + "…";
  }
  return lines;
}

// ------------------------------------------------------- card rendering

/**
 * Concentric topographic contours: one fixed per-angle noise profile per
 * page keeps the rings nested (they never cross), like real contour lines.
 */
function contours(rand: () => number, cx: number, cy: number, rings: number, r0: number, step: number, opacity: number): string {
  const n = 26;
  const bumps: number[] = [];
  for (let i = 0; i < n; i++) bumps.push((rand() - 0.5) * 2);
  // Smooth the noise profile so contours undulate gently.
  const profile = bumps.map((_, i) => {
    const a = bumps[(i + n - 1) % n], b = bumps[i], c = bumps[(i + 1) % n];
    return (a + 2 * b + c) / 4;
  });
  const paths: string[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const base = r0 + ring * step;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = base * (1 + 0.22 * profile[i]);
      pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
    }
    // Catmull-Rom -> cubic bezier for a smooth closed loop.
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    d += " Z";
    paths.push(`<path d="${d}"/>`);
  }
  return `<g fill="none" stroke="${BRAND.topo}" stroke-opacity="${opacity}" stroke-width="1.4">${paths.join("")}</g>`;
}

function gridAndTicks(): string {
  const parts: string[] = [];
  for (let x = 100; x < W; x += 100) parts.push(`M ${x} 0 V ${H}`);
  for (let y = 105; y < H; y += 105) parts.push(`M 0 ${y} H ${W}`);
  const grid = `<path d="${parts.join(" ")}" stroke="${BRAND.grid}" stroke-width="1"/>`;
  const ticks: string[] = [];
  for (let x = 100; x < W; x += 100) ticks.push(`M ${x} 0 V 10 M ${x} ${H} V ${H - 10}`);
  for (let y = 105; y < H; y += 105) ticks.push(`M 0 ${y} H 10 M ${W} ${y} H ${W - 10}`);
  return grid + `<path d="${ticks.join(" ")}" stroke="${BRAND.tick}" stroke-width="1.5"/>`;
}

interface CardMeta {
  title: string;
  description: string;
  author: string;
  section: string;
  slug: string;
}

function renderCard(meta: CardMeta): string {
  const seed = fnv1a(meta.slug);
  const rand = mulberry32(seed);

  // Deterministic pseudo-coordinates as a cartographic signature.
  const lat = (24 + rand() * 25).toFixed(4);
  const lon = (67 + rand() * 58).toFixed(4);

  // Contour cluster occupying the right side, plus a faint echo bottom-left.
  const topoMain = contours(rand, 920 + rand() * 120, 250 + rand() * 160, 9, 46, 58, 1);
  const topoEcho = contours(rand, 120 + rand() * 100, 560 + rand() * 60, 5, 30, 46, 0.6);
  const peakX = 920, peakY = 250; // crosshair anchors near the main cluster

  // ---- typography ----
  const title = meta.title || SITE_NAME;
  const fs = title.length <= 34 ? 72 : title.length <= 68 ? 60 : 50;
  const titleLines = wrap(title, fs, 0.53, 940, 3);
  const lineH = Math.round(fs * 1.16);
  const titleY = 236;

  const descLines = meta.description
    ? wrap(meta.description, 28, 0.5, 900, 2)
    : [];
  const descY = titleY + titleLines.length * lineH + 14;

  const kicker = meta.section
    ? `<tspan fill="${BRAND.primary}">${esc(SITE_NAME.toUpperCase())}</tspan><tspan fill="${BRAND.border}" dx="14">/</tspan><tspan fill="${BRAND.muted}" dx="14">${esc(meta.section.toUpperCase())}</tspan>`
    : `<tspan fill="${BRAND.primary}">${esc(SITE_NAME.toUpperCase())}</tspan>`;

  const titleSpans = titleLines
    .map((l, i) => `<tspan x="84" y="${titleY + i * lineH}">${esc(l)}</tspan>`)
    .join("");
  const descSpans = descLines
    .map((l, i) => `<tspan x="84" y="${descY + i * 40}">${esc(l)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="${W}" height="${H}" fill="${BRAND.bg}"/>
  ${gridAndTicks()}
  ${topoMain}
  ${topoEcho}
  <g stroke="${BRAND.primary}" stroke-width="1.5" opacity="0.85">
    <path d="M ${peakX - 9} ${peakY} H ${peakX + 9} M ${peakX} ${peakY - 9} V ${peakY + 9}"/>
  </g>
  <circle cx="${peakX}" cy="${peakY}" r="3" fill="${BRAND.primary}"/>
  <rect x="0" y="0" width="8" height="${H}" fill="${BRAND.primary}"/>
  <text x="84" y="132" font-family="${FONT}" font-size="24" font-weight="700" letter-spacing="4">${kicker}</text>
  <text font-family="${FONT}" font-size="${fs}" font-weight="800" letter-spacing="${(-0.02 * fs).toFixed(2)}" fill="${BRAND.fg}">${titleSpans}</text>
  <text font-family="${FONT}" font-size="28" font-weight="400" fill="${BRAND.muted}">${descSpans}</text>
  <line x1="84" y1="516" x2="1116" y2="516" stroke="${BRAND.border}" stroke-width="1"/>
  <text x="84" y="566" font-family="${FONT}" font-size="26">
    <tspan font-weight="600" fill="${BRAND.body}">${esc(meta.author || SITE_NAME)}</tspan>
    <tspan fill="${BRAND.primary}" dx="12">·</tspan>
    <tspan fill="${BRAND.muted}" dx="12">noahweidig.com</tspan>
  </text>
  <text x="1116" y="566" text-anchor="end" font-family="${MONO}" font-size="20" fill="${BRAND.muted}" opacity="0.8">${lat}° N · ${lon}° W</text>
</svg>
`;
}

// ------------------------------------------------------- html handling

function readMeta(html: string, attr: "property" | "name", key: string): string | null {
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

function upsertMeta(html: string, attr: "property" | "name", key: string, value: string): string {
  const escaped = esc(value);
  for (const a of [attr, attr === "property" ? "name" : "property"] as const) {
    const re = new RegExp(`(<meta ${a}="${key}" content=")[^"]*(">?)`);
    if (re.test(html)) return html.replace(re, `$1${escaped}$2`);
  }
  return html.replace("</head>", `<meta ${attr}="${key}" content="${escaped}">\n</head>`);
}

function* walkHtml(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "site_libs" || entry.name.endsWith("_files")) continue;
      yield* walkHtml(full);
    } else if (entry.name.endsWith(".html")) {
      yield full;
    }
  }
}

function slugFor(relPath: string): string {
  let p = relPath.replace(/\\/g, "/").replace(/\.html$/, "");
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  if (p === "index") p = "home";
  return p.replace(/\//g, "-");
}

// ----------------------------------------------------------------- main

function main(): void {
  if (!fs.existsSync(outputDir)) {
    console.error(`[og-cards] output dir not found: ${outputDir}`);
    process.exit(1);
  }

  const quartoYml = fs.readFileSync(path.join(projectRoot, "_quarto.yml"), "utf8");
  const siteUrlMatch = quartoYml.match(/^\s*site-url:\s*["']?([^"'\s]+)/m);
  const siteUrl = (siteUrlMatch ? siteUrlMatch[1] : "/").replace(/\/$/, "");

  const ogDir = path.join(outputDir, "assets", "og");
  fs.mkdirSync(ogDir, { recursive: true });

  let count = 0;
  for (const file of walkHtml(outputDir)) {
    const rel = path.relative(outputDir, file);
    const html = fs.readFileSync(file, "utf8");

    const rawTitle = readMeta(html, "property", "og:title") ??
      decodeEntities((html.match(/<title>([^<]*)<\/title>/) ?? [, ""])[1]!);
    const title = rawTitle.replace(/\s+[–—-]\s+Noah Weidig$/, "").trim();
    const description = (readMeta(html, "property", "og:description") ??
      readMeta(html, "name", "description") ?? "").trim();
    const author = readMeta(html, "name", "author") ?? SITE_NAME;

    const topDir = rel.split(path.sep)[0];
    const category = (html.match(/class="quarto-category"[^>]*>([^<]+)</) ?? [])[1];
    const section = category?.trim() || SECTION_LABELS[topDir] || "";

    const slug = slugFor(rel);
    const svg = renderCard({ title, description, author, section, slug });
    fs.writeFileSync(path.join(ogDir, `${slug}.svg`), svg);

    const imageUrl = `${siteUrl}/assets/og/${slug}.svg`;
    let out = html;
    out = upsertMeta(out, "property", "og:image", imageUrl);
    out = upsertMeta(out, "property", "og:image:width", String(W));
    out = upsertMeta(out, "property", "og:image:height", String(H));
    out = upsertMeta(out, "property", "og:image:alt", title);
    out = upsertMeta(out, "name", "twitter:image", imageUrl);
    out = upsertMeta(out, "name", "twitter:card", "summary_large_image");
    if (out !== html) fs.writeFileSync(file, out);
    count++;
  }
  console.log(`[og-cards] generated ${count} cards in ${path.relative(projectRoot, ogDir)}`);
}

main();
