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
 * Two jobs, both things Quarto has no setting for:
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
 *  2. sitemap.xml URL normalisation. Quarto lists `…/index.html`; the pages
 *     themselves advertise the directory form as canonical (`…/`). Submitting
 *     a sitemap full of non-canonical duplicates wastes crawl budget and
 *     muddies which URL Google picks, so rewrite it to match.
 *
 * Only the rendered output is touched — nothing under the project source.
 */

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

// -------------------------------------------------------------- html pass

/**
 * Rewrite the <img> tags inside a page's <main>. Navigation and footer imagery
 * is left alone: it is hand-written, already sized, and always above the fold.
 */
function processImages(html: string, file: string, stats: { sized: number; lazy: number }): string {
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

    if (!hasW || !hasH) {
      const resolved = resolveSrc(src, file);
      const size = resolved ? cachedSize(resolved) : null;
      if (size && size.w > 0 && size.h > 0) {
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
    return out;
  });

  return html.slice(0, start) + main + html.slice(end);
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

  const stats = { sized: 0, lazy: 0 };
  let pages = 0;
  for (const file of walkHtml(outputDir)) {
    const html = fs.readFileSync(file, "utf8");
    const next = processImages(html, file, stats);
    if (next !== html) {
      fs.writeFileSync(file, next);
      pages++;
    }
  }
  console.log(
    `[optimize] ${stats.sized} image(s) given intrinsic dimensions, ` +
      `${stats.lazy} lazy-loaded across ${pages} page(s)`,
  );
  console.log(`[optimize] sitemap.xml: ${normalizeSitemap()} URL(s) normalised to canonical form`);
}

main();
