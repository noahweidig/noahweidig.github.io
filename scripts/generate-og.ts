/**
 * generate-og.ts — automatic Open Graph card generation.
 *
 * Runs as a Quarto post-render step (see `project.post-render` in
 * _quarto.yml). Quarto executes it with its bundled Deno; for local debugging
 * it also runs under Node:
 *
 *   node --experimental-strip-types scripts/generate-og.ts
 *
 * For every rendered HTML page in the output directory it:
 *   1. reads the page's title, description, author, and category/section
 *      straight out of the rendered <head> (so cards always match what
 *      Quarto rendered — nothing to update by hand);
 *   2. composes a 1200x630 card — the fixed brand background (amber →
 *      magenta → teal gradient under the site's topographic texture) with
 *      bold white text over a contrast scrim — and rasterizes it to
 *      <output-dir>/assets/og/<slug>.png;
 *   3. rewrites the page's <head> so og:image / twitter:image point at that
 *      PNG, and fills in the rest of the Open Graph set (og:title,
 *      og:description, og:url, og:type, og:image:width/height/alt,
 *      twitter:card=summary_large_image, …). Meta tags are only ever written
 *      inside <head>; any og:/twitter: tags found in <body> are removed.
 *
 * Cards are PNG, not SVG, deliberately: no major unfurler (Facebook, X,
 * LinkedIn, Slack, Discord, iMessage) renders image/svg+xml, so the previous
 * SVG-only cards could never be referenced from og:image. Rasterization uses
 * resvg compiled to WebAssembly plus static Inter faces, both vendored under
 * scripts/vendor — `quarto render` remains the only build step.
 *
 * The background is intentionally identical on every card: one brand image,
 * recognisable at thumbnail size, with the page's own words on top.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { outputDir, projectRoot, walkHtml } from "./site-output.ts";

// ---------------------------------------------------------------- config

const W = 1200;
const H = 630;

/** Brand background + card palette. Text is white by design: the gradient is
 *  saturated, so anything else loses legibility at preview thumbnail size. */
const BRAND = {
  gradFrom: "#efa30d", // amber, top-left corner
  gradMid: "#c22fc7", // magenta, left third
  gradTo: "#15a473", // teal, right edge
  contour: "#1b2430", // topo line ink, drawn at low opacity
  fg: "#ffffff",
  accent: "#ffffff",
};

const FONT = "Inter";

const vendorDir = path.join(projectRoot, "scripts", "vendor");

const SITE_NAME = "Noah Weidig";
/**
 * Open Graph URLs must be absolute, so they need a host. Production (GitHub
 * Pages) uses `site-url` from _quarto.yml; a Netlify deploy preview points at
 * itself instead, otherwise every preview would advertise og:image URLs on
 * noahweidig.com — where the card for an unmerged page does not exist yet, so
 * unfurlers and validators (opengraph.xyz, Facebook's debugger) see a 404 and
 * show no preview at all.
 */
function canonicalSiteUrl(): string {
  const yml = fs.readFileSync(path.join(projectRoot, "_quarto.yml"), "utf8");
  const m = yml.match(/^\s*site-url:\s*["']?([^"'\s]+)/m);
  if (!m) throw new Error("[og-cards] no site-url found in _quarto.yml");
  return m[1].replace(/\/+$/, "");
}
const SITE_URL = (process.env.CONTEXT && process.env.CONTEXT !== "production" &&
  process.env.DEPLOY_PRIME_URL?.replace(/\/+$/, "")) || canonicalSiteUrl();
const SECTION_LABELS: Record<string, string> = {
  blog: "Blog",
  projects: "Projects",
  publications: "Publications",
  awards: "Awards",
};
/** Call to action, by top-level section — one for an item, one for the
 *  section's own listing page ("Read the post" makes no sense on /blog/). */
const CTA_LABELS: Record<string, string> = {
  blog: "Read the post",
  projects: "See the project",
  publications: "Read the paper",
  awards: "See the award",
};
const INDEX_CTA_LABELS: Record<string, string> = {
  blog: "Browse the blog",
  projects: "Browse the projects",
  publications: "Browse the publications",
  awards: "Browse the awards",
};

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

// -------------------------------------------------------- background art

/**
 * The topographic texture is the site's own artwork (assets/media/topography.svg,
 * the same tile theme.scss masks behind cards and the footer), tiled as an SVG
 * pattern rather than redrawn — one background, identical on every card.
 */
function topoPath(): string {
  const svg = fs.readFileSync(path.join(projectRoot, "assets", "media", "topography.svg"), "utf8");
  const d = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!d) throw new Error("[og-cards] no path found in assets/media/topography.svg");
  return d[1];
}

/** The brand background: gradient wash, topo texture, then a contrast scrim. */
function background(): string {
  return `
  <rect width="${W}" height="${H}" fill="url(#nw-grad)"/>
  <rect width="${W}" height="${H}" fill="url(#nw-topo)"/>
  <rect width="${W}" height="${H}" fill="url(#nw-scrim)"/>
  <rect width="${W}" height="${H}" fill="url(#nw-scrim-v)"/>`;
}

// ------------------------------------------------------- card rendering

interface CardMeta {
  title: string;
  description: string;
  author: string;
  section: string;
  cta: string;
}

/**
 * Safe-area margin. Previews get cropped (X rounds the corners, Slack and
 * Discord letterbox), so nothing is drawn within `M` of any edge.
 */
const M = 110;
const TEXT_W = W - 2 * M;

const KICKER_Y = 132; // baseline
const CTA_Y = 430; // top of the pill
const CTA_H = 66;
const FOOTER_Y = 560; // baseline

function renderCardSvg(meta: CardMeta, topo: string): string {
  const title = meta.title || SITE_NAME;
  const descLines = meta.description ? wrap(meta.description, 28, 0.5, TEXT_W, 2) : [];

  // With a description the text block hangs upward off the CTA; without one
  // the title sits just under the kicker. Either way, pick the largest size
  // that still clears its neighbours, so nothing collides or runs off.
  const descBottom = CTA_Y - 36;
  const descY = descBottom - (Math.max(descLines.length, 1) - 1) * 38;
  const titleBottom = descY - 62;
  const titleTop = KICKER_Y + 104; // first baseline when top-anchored

  let fs_ = 76;
  let titleLines = wrap(title, fs_, 0.53, TEXT_W, 3);
  let lineH = Math.round(fs_ * 1.14);
  for (const size of [76, 62, 52, 44]) {
    fs_ = size;
    lineH = Math.round(size * 1.14);
    titleLines = wrap(title, size, 0.53, TEXT_W, 3);
    const span = (titleLines.length - 1) * lineH;
    const fits = descLines.length
      ? titleBottom - span - size >= KICKER_Y + 18
      : titleTop + span <= CTA_Y - 42;
    if (fits) break;
  }
  const titleY = descLines.length
    ? titleBottom - (titleLines.length - 1) * lineH
    : titleTop;

  const kicker = meta.section
    ? `${SITE_NAME.toUpperCase()}  ·  ${meta.section.toUpperCase()}`
    : SITE_NAME.toUpperCase();

  const titleSpans = titleLines
    .map((l, i) => `<tspan x="${M}" y="${titleY + i * lineH}">${esc(l)}</tspan>`)
    .join("");
  const descSpans = descLines
    .map((l, i) => `<tspan x="${M}" y="${descY + i * 38}">${esc(l)}</tspan>`)
    .join("");

  // Call to action: outlined pill, width estimated from the label length.
  // The arrow is a drawn path, not "→" — the Inter subset shipped in
  // scripts/vendor has no arrow glyph, and a missing glyph renders as tofu.
  const ctaW = Math.round(meta.cta.length * 15.2) + 116;
  const arrowX = M + ctaW - 62;
  const arrowY = CTA_Y + CTA_H / 2;
  const arrow =
    `<path d="M ${arrowX} ${arrowY} h 26 m -10 -9 l 10 9 l -10 9" fill="none" stroke="${BRAND.fg}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="nw-grad" x1="0" y1="0" x2="1" y2="0.55">
      <stop offset="0" stop-color="${BRAND.gradFrom}"/>
      <stop offset="0.2" stop-color="${BRAND.gradMid}"/>
      <stop offset="0.5" stop-color="${BRAND.gradMid}"/>
      <stop offset="1" stop-color="${BRAND.gradTo}"/>
    </linearGradient>
    <linearGradient id="nw-scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity="0.34"/>
      <stop offset="0.65" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="nw-scrim-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.1"/>
      <stop offset="0.45" stop-color="#000000" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
    <pattern id="nw-topo" width="900" height="900" patternUnits="userSpaceOnUse">
      <path d="${topo}" transform="scale(1.5)" fill="${BRAND.contour}" fill-opacity="0.2"/>
    </pattern>
  </defs>
  ${background()}
  <text x="${M}" y="${KICKER_Y}" font-family="${FONT}" font-size="24" font-weight="800" letter-spacing="5" fill="${BRAND.fg}" fill-opacity="0.92">${esc(kicker)}</text>
  <text font-family="${FONT}" font-size="${fs_}" font-weight="800" letter-spacing="${(-0.02 * fs_).toFixed(2)}" fill="${BRAND.fg}">${titleSpans}</text>
  <text font-family="${FONT}" font-size="28" font-weight="400" fill="${BRAND.fg}" fill-opacity="0.92">${descSpans}</text>
  <rect x="${M}" y="${CTA_Y}" width="${ctaW}" height="${CTA_H}" rx="${CTA_H / 2}" fill="#000000" fill-opacity="0.3" stroke="${BRAND.accent}" stroke-width="2.5"/>
  <text x="${M + 38}" y="${CTA_Y + 43}" font-family="${FONT}" font-size="27" font-weight="800" letter-spacing="0.4" fill="${BRAND.fg}">${esc(meta.cta)}</text>
  ${arrow}
  <text x="${M}" y="${FOOTER_Y}" font-family="${FONT}" font-size="26" font-weight="800" fill="${BRAND.fg}" fill-opacity="0.95">${esc(meta.author || SITE_NAME)}</text>
  <text x="${W - M}" y="${FOOTER_Y}" text-anchor="end" font-family="${FONT}" font-size="26" font-weight="800" fill="${BRAND.fg}" fill-opacity="0.95">noahweidig.com</text>
</svg>
`;
}

// ------------------------------------------------------------ rasterizer

// deno-lint-ignore no-explicit-any
let Resvg: any;

async function initRasterizer(): Promise<Uint8Array[]> {
  const mod = await import(pathToFileURL(path.join(vendorDir, "resvg", "resvg.mjs")).href);
  const wasm = zlib.gunzipSync(fs.readFileSync(path.join(vendorDir, "resvg", "resvg.wasm.gz")));
  await mod.initWasm(wasm);
  Resvg = mod.Resvg;
  return [
    new Uint8Array(fs.readFileSync(path.join(vendorDir, "fonts", "inter-400.ttf"))),
    new Uint8Array(fs.readFileSync(path.join(vendorDir, "fonts", "inter-800.ttf"))),
  ];
}

function rasterize(svg: string, fontBuffers: Uint8Array[]): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: {
      fontBuffers,
      defaultFontFamily: { sansSerif: FONT },
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
}

// ------------------------------------------------------- html handling

function readMeta(html: string, attr: "property" | "name", key: string): string | null {
  const m = html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

/**
 * Insert or update a meta tag — inside <head> only. Returns the new head.
 * `attr` follows the spec each vocabulary uses: Open Graph is RDFa
 * (`property`), Twitter's card tags are plain `name`.
 */
function upsertMeta(head: string, attr: "property" | "name", key: string, value: string): string {
  const tag = `<meta ${attr}="${key}" content="${esc(value)}">`;
  const existing = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`);
  if (existing.test(head)) return head.replace(existing, tag);
  return `${head}${tag}\n`;
}

/** Insert or update a <link rel="…"> in <head>. Returns the new head. */
function upsertLink(head: string, rel: string, href: string, extra = ""): string {
  const tag = `<link rel="${rel}" href="${esc(href)}"${extra ? " " + extra : ""}>`;
  const existing = new RegExp(`<link\\s+rel="${rel}"[^>]*>`);
  if (existing.test(head)) return head.replace(existing, tag);
  return `${head}${tag}\n`;
}

function slugFor(relPath: string): string {
  let p = relPath.replace(/\\/g, "/").replace(/\.html$/, "");
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  if (p === "index") p = "home";
  return p.replace(/\//g, "-");
}

/** Canonical absolute URL for a rendered page. */
function pageUrl(relPath: string): string {
  let p = relPath.replace(/\\/g, "/");
  if (p === "index.html") return `${SITE_URL}/`;
  if (p.endsWith("/index.html")) p = p.slice(0, -"index.html".length);
  return `${SITE_URL}/${p}`;
}

// ----------------------------------------------------------------- main

async function main(): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    console.error(`[og-cards] output dir not found: ${outputDir}`);
    process.exit(1);
  }

  const fontBuffers = await initRasterizer();
  const topo = topoPath();

  const ogDir = path.join(outputDir, "assets", "og");
  fs.mkdirSync(ogDir, { recursive: true });

  let count = 0;
  for (const file of walkHtml(outputDir)) {
    const rel = path.relative(outputDir, file);
    const html = fs.readFileSync(file, "utf8");

    const headEnd = html.search(/<\/head>/i);
    if (headEnd === -1) continue; // fragment, not a page

    const rawTitle = readMeta(html, "property", "og:title") ??
      decodeEntities((html.match(/<title>([^<]*)<\/title>/) ?? [, ""])[1]!);
    const title = rawTitle.replace(/\s+[–—-]\s+Noah Weidig$/, "").trim();
    const description = (readMeta(html, "property", "og:description") ??
      readMeta(html, "name", "description") ?? "").trim();
    const author = readMeta(html, "name", "author") ?? SITE_NAME;

    const topDir = rel.split(path.sep)[0];
    const category = (html.match(/class="quarto-category"[^>]*>([^<]+)</) ?? [])[1];
    const section = category?.trim() || SECTION_LABELS[topDir] || "";
    const isSectionIndex = rel === path.join(topDir, "index.html");
    const cta = (isSectionIndex ? INDEX_CTA_LABELS[topDir] : CTA_LABELS[topDir]) ?? "Read more";

    // ---- card ----
    const slug = slugFor(rel);
    const svg = renderCardSvg({ title, description, author, section, cta }, topo);
    const png = rasterize(svg, fontBuffers);
    fs.writeFileSync(path.join(ogDir, `${slug}.png`), png);

    // ---- <head> metadata ----
    const imageUrl = `${SITE_URL}/assets/og/${slug}.png`;
    // Don't say "Noah Weidig" twice when the title already carries it.
    const imageAlt = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
    // Blog posts and publication records are datestamped, single-subject
    // documents; everything else on the site is a page about the site.
    const isArticle = (topDir === "blog" || topDir === "publications") && !isSectionIndex;
    const canonical = pageUrl(rel);

    let head = html.slice(0, headEnd);
    // Quarto emits no canonical link of its own, and GitHub Pages serves every
    // page at more than one address (/cv and /cv.html, /blog/focus/ and
    // /blog/focus/index.html), so without this each page looks like several
    // duplicates to a crawler. The URL is the same one og:url advertises and
    // the one sitemap.xml lists — see scripts/optimize-output.ts.
    // The 404 page is reachable at every bad URL on the domain, so it gets the
    // opposite treatment: keep it out of the index (crawlers may still follow
    // its links) and give it no canonical, which would only contradict the
    // noindex. It is already absent from sitemap.xml.
    if (rel === "404.html") {
      head = upsertMeta(head, "name", "robots", "noindex, follow");
    } else {
      head = upsertLink(head, "canonical", canonical);
    }
    head = upsertMeta(head, "property", "og:title", title);
    if (description) head = upsertMeta(head, "property", "og:description", description);
    head = upsertMeta(head, "property", "og:url", canonical);
    head = upsertMeta(head, "property", "og:type", isArticle ? "article" : "website");
    head = upsertMeta(head, "property", "og:site_name", SITE_NAME);
    head = upsertMeta(head, "property", "og:locale", "en_US");
    head = upsertMeta(head, "property", "og:image", imageUrl);
    head = upsertMeta(head, "property", "og:image:secure_url", imageUrl);
    head = upsertMeta(head, "property", "og:image:type", "image/png");
    head = upsertMeta(head, "property", "og:image:width", String(W));
    head = upsertMeta(head, "property", "og:image:height", String(H));
    head = upsertMeta(head, "property", "og:image:alt", imageAlt);
    // Full-width preview on X; every other platform falls back to Open Graph.
    head = upsertMeta(head, "name", "twitter:card", "summary_large_image");
    head = upsertMeta(head, "name", "twitter:title", title);
    if (description) head = upsertMeta(head, "name", "twitter:description", description);
    head = upsertMeta(head, "name", "twitter:image", imageUrl);
    head = upsertMeta(head, "name", "twitter:image:alt", imageAlt);

    // Social metadata belongs in <head>; strip any that Quarto or a filter
    // left in the body, where no unfurler looks for it.
    const body = html.slice(headEnd).replace(
      /[ \t]*<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"\s+content="[^"]*"\s*\/?>\n?/gi,
      "",
    );

    fs.writeFileSync(file, head + body);
    count++;
  }
  console.log(`[og-cards] generated ${count} cards in ${path.relative(projectRoot, ogDir)}`);
}

await main();
