/**
 * optimize-output.ts — post-render polish on the generated site.
 *
 * Runs as the last Quarto post-render step (see `project.post-render` in
 * _quarto.yml), after scripts/generate-og.ts has finished rewriting <head>.
 * Quarto executes it with its bundled Deno; for local debugging it also runs
 * under Node:
 *
 *   node --experimental-strip-types scripts/optimize-output.ts
 *
 * Five jobs, all things Quarto has no setting for:
 *
 *  1. Intrinsic image dimensions. Markdown figures (`![alt](shot.webp)`) and
 *     EJS listing templates emit <img> without width/height, so the browser
 *     cannot reserve space and the page reflows once each image decodes —
 *     directly visible as Cumulative Layout Shift, and worst on exactly the
 *     images that tend to be the Largest Contentful Paint. This reads the real
 *     pixel size out of each file and stamps it on the tag. Purely additive:
 *     Bootstrap's `.img-fluid` (`max-width:100%; height:auto`) still decides
 *     the rendered size, so nothing moves or resizes.
 *
 *     Below-the-fold images also pick up `loading="lazy"`. The first image
 *     inside <main> is left eager — it is the likeliest LCP element, and
 *     lazy-loading it would delay it. `decoding="async"` is deliberately *not*
 *     added: on this site's heavily downscaled project screenshots Chromium's
 *     async decode path resamples visibly differently from the sync one, which
 *     is a rendering change for no measurable gain once width/height are known.
 *
 *  2. Responsive image variants. Listing pages ship 1600 px album screenshots
 *     into ~286 px slots, so a phone downloads several times the pixels it can
 *     show. For every raster image big enough to be worth it, this shells out
 *     to `cwebp` for a few narrower copies next to the original
 *     (`shot-480.webp`, …) and emits them as `srcset`. `sizes="auto"` lets the
 *     browser use the image's own laid-out width — exact by construction, and
 *     browsers without it simply fall back to 100vw and pick a larger
 *     candidate, so no image is ever chosen too small. If `cwebp` is not
 *     installed (Netlify's build image, a bare local render) nothing is
 *     generated and no `srcset` is written: the site renders exactly as before.
 *
 *  3. Non-render-blocking alternate theme CSS. The dual-theme setup emits two
 *     full ~536 KB Bootstrap bundles as plain stylesheets, so the browser
 *     parses both before first paint even though a light-mode visitor never
 *     uses the dark one. Parking the alternate sheets behind `media="not all"`
 *     keeps them fetched but out of the critical path; a tiny inline script,
 *     injected at the end of <head> so it sees the same stored sentinel Quarto
 *     reads, re-arms them before paint for visitors who get the dark theme.
 *     (Quarto layers dark *over* light and never disables the primary sheet,
 *     so in dark mode both are still applied — the win is on the light path.)
 *     `assets/nw-nav.js` re-arms `media` on toggle, since Quarto's own toggle
 *     only ever flips `rel`.
 *
 *  4. Cloudflare Rocket Loader opt-out. noahweidig.com is proxied by
 *     Cloudflare with Rocket Loader on, which rewrites every script's `type`
 *     so the browser will not run it natively — including the pre-paint theme
 *     script above and the accessibility patches in nw-nav.js. `data-cfasync`
 *     is the documented per-script opt-out; it is inert everywhere else.
 *
 *  5. sitemap.xml URL normalisation. Quarto lists `…/index.html`; the pages
 *     themselves advertise the directory form as canonical (`…/`). Submitting
 *     a sitemap full of non-canonical duplicates wastes crawl budget and
 *     muddies which URL Google picks, so rewrite it to match.
 *
 * Only the rendered output is touched — nothing under the project source.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { outputDir, walkHtml } from "./site-output.ts";

// ------------------------------------------------------- image dimensions

type Size = { w: number; h: number };

/** Intrinsic size of an image, read from its header. Null if unrecognised. */
function imageSize(file: string): Size | null {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  const ext = path.extname(file).toLowerCase();

  if (ext === ".svg") return svgSize(buf.toString("utf8"));

  // PNG: 8-byte signature, then the IHDR chunk's width/height as big-endian u32.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  // GIF: little-endian u16 pair at offset 6.
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }

  // WebP: RIFF container; the dimensions live in whichever of the three
  // bitstream chunks the encoder chose.
  if (
    buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
      const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
      return { w: w + 1, h: h + 1 };
    }
    return null;
  }

  // JPEG: walk the marker segments to the start-of-frame.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0-SOF15, excluding the DHT/JPG/DAC markers interleaved with them.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }

  return null;
}

function svgSize(text: string): Size | null {
  const head = text.slice(0, 2000);
  const w = head.match(/\bwidth="([\d.]+)(?:px)?"/);
  const h = head.match(/\bheight="([\d.]+)(?:px)?"/);
  if (w && h) return { w: Math.round(+w[1]), h: Math.round(+h[1]) };
  const vb = head.match(/viewBox="[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)"/);
  if (vb) return { w: Math.round(+vb[1]), h: Math.round(+vb[2]) };
  return null;
}

const sizeCache = new Map<string, Size | null>();
function cachedSize(file: string): Size | null {
  if (!sizeCache.has(file)) sizeCache.set(file, imageSize(file));
  return sizeCache.get(file)!;
}

/** Resolve an <img src> against the rendered page to a path on disk. */
function resolveSrc(src: string, pageFile: string): string | null {
  if (/^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith("data:")) return null;
  const clean = src.split(/[?#]/)[0];
  if (!clean) return null;
  return clean.startsWith("/")
    ? path.join(outputDir, clean)
    : path.resolve(path.dirname(pageFile), clean);
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function addAttrs(tag: string, extra: string): string {
  return tag.replace(/\s*\/?>$/, ` ${extra}>`);
}

// -------------------------------------------------- responsive variants

/** Candidate widths. 640 is the one that matters most: the album screenshots
 *  and award images render at ~286-288 CSS px, i.e. ~576 device px on a phone
 *  at DPR 2, so 640 is the first candidate wide enough to stay sharp. */
const VARIANT_WIDTHS = [480, 640, 960];

/** Below this there is nothing to save — the file is already close to the
 *  largest size any layout on the site asks of it. */
const MIN_SOURCE_WIDTH = 700;

/** Quality for the generated copies. Downscaling hides compression artefacts,
 *  so this sits a little under what the source assets were encoded at. */
const VARIANT_QUALITY = "80";

/** Where libwebp installs `cwebp`: Debian/Ubuntu (the CI image), a local
 *  build, and Homebrew on Apple silicon. Absolute paths on purpose — resolving
 *  the name through PATH would let whatever happens to be earlier on it decide
 *  which binary the build runs. */
const ENCODER_CANDIDATES = [
  "/usr/bin/cwebp",
  "/usr/local/bin/cwebp",
  "/opt/homebrew/bin/cwebp",
];

let encoderChecked = false;
let encoder: string | null = null;

/**
 * `cwebp`, if this machine has it. Absence is normal and not an error: the
 * Netlify preview build and a plain local `quarto render` have no libwebp, and
 * a runtime that forbids spawning processes throws rather than returning — in
 * every one of those cases the site is simply built without variants.
 */
function webpEncoder(): string | null {
  if (encoderChecked) return encoder;
  encoderChecked = true;
  for (const bin of ENCODER_CANDIDATES) {
    try {
      if (!fs.existsSync(bin)) continue;
      const probe = spawnSync(bin, ["-version"], { stdio: "ignore" });
      if (!probe.error && probe.status === 0) {
        encoder = bin;
        break;
      }
    } catch {
      // Not executable here, or this runtime forbids spawning at all.
    }
  }
  if (!encoder) {
    console.log("[optimize] cwebp unavailable — skipping responsive image variants");
  }
  return encoder;
}

const variantCache = new Map<string, number[]>();
let variantsWritten = 0;

/** Whether a variant from an earlier build can be reused as-is. Quarto leaves
 *  the output directory in place between renders, so most builds regenerate
 *  nothing; a re-exported source image is newer than its variants and does. */
function upToDate(dest: string, source: string): boolean {
  try {
    return fs.statSync(dest).mtimeMs >= fs.statSync(source).mtimeMs;
  } catch {
    return false;
  }
}

/**
 * Narrower copies of `file`, generated on first use and cached. Returns the
 * widths that exist on disk — empty whenever the image is too small to be
 * worth it, is not a WebP, or no encoder is available.
 */
function variantWidths(file: string, size: Size): number[] {
  const cached = variantCache.get(file);
  if (cached) return cached;

  const widths: number[] = [];
  variantCache.set(file, widths);
  if (!worthResizing(file, size)) return widths;

  const bin = webpEncoder();
  if (!bin) return widths;

  for (const w of VARIANT_WIDTHS) {
    if (w >= size.w) continue;
    if (writeVariant(bin, file, variantName(file, w), w)) widths.push(w);
  }
  return widths;
}

/** Whether narrower copies of this file would be used at all. */
function worthResizing(file: string, size: Size): boolean {
  // Only WebP sources: mixing formats inside one srcset would hand the
  // browser candidates it cannot tell apart, and every image on the site
  // that is large enough to matter is already WebP.
  if (!/\.webp$/i.test(file) || size.w < MIN_SOURCE_WIDTH) return false;
  // A generated variant must never itself be a source.
  if (/-\d+\.webp$/i.test(file)) return false;
  // Rendered output only — never anything outside the build directory.
  return !path.relative(outputDir, file).startsWith("..");
}

/** `shot.webp` at 640 px is `shot-640.webp`, both on disk and in the srcset. */
function variantName(src: string, width: number): string {
  return src.replace(/\.webp$/i, `-${width}.webp`);
}

/** Encode one variant, reusing an up-to-date one. False if it can't be made. */
function writeVariant(bin: string, source: string, dest: string, width: number): boolean {
  if (upToDate(dest, source)) return true;
  let ok = false;
  try {
    const run = spawnSync(bin, [
      "-quiet",
      "-q",
      VARIANT_QUALITY,
      "-resize",
      String(width),
      "0",
      source,
      "-o",
      dest,
    ]);
    ok = !run.error && run.status === 0 && fs.existsSync(dest);
  } catch {
    ok = false;
  }
  if (!ok) {
    // A half-written file would be served as a broken image.
    try {
      fs.rmSync(dest, { force: true });
    } catch { /* nothing to clean up */ }
    return false;
  }
  variantsWritten++;
  return true;
}

/** The srcset for an <img src>, or null if it has no variants. */
function srcsetFor(src: string, file: string, size: Size): string | null {
  const widths = variantWidths(file, size);
  if (!widths.length) return null;
  const candidates = widths.map((w) => `${variantName(src, w)} ${w}w`);
  candidates.push(`${src} ${size.w}w`);
  return candidates.join(", ");
}

// -------------------------------------------------------------- html pass

/**
 * Rewrite the <img> tags inside a page's <main>. Navigation and footer imagery
 * is left alone: it is hand-written, already sized, and always above the fold.
 */
function processImages(
  html: string,
  file: string,
  stats: { sized: number; lazy: number; responsive: number },
): string {
  const start = html.search(/<main[\s>]/i);
  if (start === -1) return html;
  const end = html.lastIndexOf("</main>");
  if (end === -1 || end < start) return html;

  let seen = 0;
  const main = html.slice(start, end).replace(/<img\s[^>]*>/gi, (tag) => {
    const index = seen++;
    const src = attr(tag, "src");
    if (!src) return tag;

    let out = tag;
    const hasW = attr(tag, "width") !== null;
    const hasH = attr(tag, "height") !== null;
    const resolved = resolveSrc(src, file);
    const raw = resolved ? cachedSize(resolved) : null;
    const size = raw && raw.w > 0 && raw.h > 0 ? raw : null;

    if (!hasW || !hasH) {
      if (size) {
        if (!hasW && !hasH) {
          out = addAttrs(out, `width="${size.w}" height="${size.h}"`);
          stats.sized++;
        } else if (!hasW) {
          // One dimension is authored; derive the other so the aspect ratio
          // the browser reserves matches the file.
          const h = Number(attr(tag, "height"));
          if (Number.isFinite(h) && h > 0) {
            out = addAttrs(out, `width="${Math.round((size.w * h) / size.h)}"`);
            stats.sized++;
          }
        } else {
          const w = Number(attr(tag, "width"));
          if (Number.isFinite(w) && w > 0) {
            out = addAttrs(out, `height="${Math.round((size.h * w) / size.w)}"`);
            stats.sized++;
          }
        }
      }
    }

    if (index > 0 && attr(out, "loading") === null && attr(out, "fetchpriority") === null) {
      out = addAttrs(out, 'loading="lazy"');
      stats.lazy++;
    }

    // Narrower copies of oversized images, offered as a srcset. `sizes="auto"`
    // is only defined for lazy images; on the one eager image per page the
    // attribute is left off, so the browser assumes 100vw and errs towards the
    // larger candidate rather than a soft one.
    if (size && resolved && attr(out, "srcset") === null) {
      const srcset = srcsetFor(src, resolved, size);
      if (srcset) {
        out = addAttrs(out, `srcset="${srcset}"`);
        if (attr(out, "loading") === "lazy" && attr(out, "sizes") === null) {
          out = addAttrs(out, 'sizes="auto"');
        }
        stats.responsive++;
      }
    }
    return out;
  });

  return html.slice(0, start) + main + html.slice(end);
}

/**
 * Guarantee a main landmark. Quarto wraps article and listing pages in
 * `<main id="quarto-document-content">`, but its custom page layout — used by
 * the landing page, the CV, the privacy page and 404 — emits no <main> at all,
 * leaving those pages with a header, a footer and an unnamed div between them.
 * Screen-reader users lose the "jump to main content" shortcut there, and the
 * skip link in assets/nw-nav.js has nothing meaningful to hand focus to.
 *
 * `role="main"` on the existing `#quarto-content` wrapper is the smallest fix:
 * no markup moves, and it is only ever added to pages that have no <main> of
 * their own, so no page ends up with two.
 */
function ensureMainLandmark(html: string): string {
  if (/<main[\s>]/i.test(html)) return html;
  return html.replace(
    /<div id="quarto-content"(?![^>]*\brole=)/i,
    '<div id="quarto-content" role="main"',
  );
}

// -------------------------------------------------------- theme styles

/**
 * Runs at the end of <head>, after the inline script in _quarto.yml has had
 * its say on the stored sentinel, and before anything can paint. Mirrors
 * Quarto's own reading of that sentinel exactly: a missing value means the
 * author's default theme, which for this site (dark listed first) is the
 * alternate one.
 */
const THEME_MEDIA_SCRIPT = `<script data-cfasync="false">
(function () {
  // The alternate (dark) sheets are parked behind media="not all" at build
  // time so they never block first paint for a light-mode visitor. Re-arm
  // them here when this visitor is getting the dark theme after all.
  var stored = null;
  try { stored = window.localStorage.getItem("quarto-color-scheme"); } catch (e) {}
  if (stored !== null && stored !== "alternate") return;
  var sheets = document.querySelectorAll("link.quarto-color-scheme.quarto-color-alternate");
  for (var i = 0; i < sheets.length; i++) sheets[i].media = "all";
})();
</script>
`;

/**
 * Take the inactive theme's stylesheets off the critical path. `media="not
 * all"` keeps the sheet downloading (at low priority, so a later toggle is
 * instant) while excluding it from the render-blocking set. `rel` is left
 * alone: Quarto's toggle machinery keys off it, and off the class, so both
 * must survive untouched.
 */
function deferAlternateStyles(html: string): string {
  let changed = false;
  const out = html.replace(/<link\s[^>]*>/gi, (tag) => {
    const cls = attr(tag, "class");
    if (!cls || !/\bquarto-color-alternate\b/.test(cls)) return tag;
    if (attr(tag, "media") !== null) return tag;
    if ((attr(tag, "rel") || "").toLowerCase() !== "stylesheet") return tag;
    changed = true;
    return addAttrs(tag, 'media="not all"');
  });
  if (!changed) return html;
  const head = out.search(/<\/head>/i);
  // Without the re-arming script the parked sheet could never come back, so
  // a page with no </head> to put it in keeps its stylesheets as they were.
  if (head === -1) return html;
  return out.slice(0, head) + THEME_MEDIA_SCRIPT + out.slice(head);
}

// ------------------------------------------------------- rocket loader

/**
 * Opt every script out of Cloudflare Rocket Loader. Rocket Loader rewrites
 * `type` on scripts it takes over and runs them itself, well after first
 * paint — which for this site means the pre-paint theme script above and the
 * navbar accessibility patches in nw-nav.js arrive late. `data-cfasync` is
 * Cloudflare's documented opt-out and is ignored by every other consumer of
 * the page, so it is safe to stamp on every script the browser executes.
 *
 * Data blocks (JSON-LD, speculation rules) are left alone: Rocket Loader has
 * no interest in a script it will never run, and scripts/generate-og.ts finds
 * the page's JSON-LD block by matching its opening tag verbatim.
 */
function optOutRocketLoader(html: string): string {
  return html.replace(/<script(?=[\s>])[^>]*>/gi, (tag) => {
    if (attr(tag, "data-cfasync") !== null) return tag;
    const type = attr(tag, "type");
    if (type !== null && !/javascript|module/i.test(type)) return tag;
    return tag.replace(/^<script/i, '<script data-cfasync="false"');
  });
}

// ------------------------------------------------------------- sitemap

function normalizeSitemap(): number {
  const file = path.join(outputDir, "sitemap.xml");
  if (!fs.existsSync(file)) return 0;
  const xml = fs.readFileSync(file, "utf8");
  let changed = 0;
  const out = xml.replace(/<loc>([^<]+)<\/loc>/g, (whole, url: string) => {
    const next = url.replace(/(^|\/)index\.html$/, "$1");
    if (next === url) return whole;
    changed++;
    return `<loc>${next}</loc>`;
  });
  if (changed) fs.writeFileSync(file, out);
  return changed;
}

// ----------------------------------------------------------------- main

function main(): void {
  if (!fs.existsSync(outputDir)) {
    console.error(`[optimize] output dir not found: ${outputDir}`);
    process.exit(1);
  }

  const stats = { sized: 0, lazy: 0, responsive: 0 };
  let pages = 0;
  let landmarks = 0;
  let deferred = 0;
  for (const file of walkHtml(outputDir)) {
    const html = fs.readFileSync(file, "utf8");
    const sized = processImages(html, file, stats);
    const landmarked = ensureMainLandmark(sized);
    if (landmarked !== sized) landmarks++;
    const themed = deferAlternateStyles(landmarked);
    if (themed !== landmarked) deferred++;
    // Last: every script the steps above may have added is stamped too.
    const next = optOutRocketLoader(themed);
    if (next !== html) {
      fs.writeFileSync(file, next);
      pages++;
    }
  }
  console.log(
    `[optimize] ${stats.sized} image(s) given intrinsic dimensions, ` +
      `${stats.lazy} lazy-loaded across ${pages} page(s)`,
  );
  console.log(
    `[optimize] ${stats.responsive} image(s) given a srcset ` +
      `(${variantsWritten} variant file(s) generated)`,
  );
  console.log(`[optimize] alternate theme CSS taken off the critical path on ${deferred} page(s)`);
  console.log(`[optimize] main landmark added to ${landmarks} custom-layout page(s)`);
  console.log(`[optimize] sitemap.xml: ${normalizeSitemap()} URL(s) normalised to canonical form`);
}

main();
