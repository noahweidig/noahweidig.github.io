/**
 * Builds the hero image for every publication, first hit wins:
 *   1. YouTube thumbnail / Vimeo oEmbed thumbnail of the "Source" link
 *   2. the Source page's og:image / twitter:image (read through headless
 *      Chrome when a plain fetch is refused; the meta tag only, no screenshot)
 *   3. page 1 of the entry's own PDF, cropped from the top (needs pdftoppm)
 * Anything left has no file; the detail page then shows its citation card.
 * Where each image came from is recorded in src/data/publication-images.json
 * for the on-page credit. An existing image from steps 1-2 is never deleted
 * or replaced by a PDF page: publishers answer CI runners with bot walls, and
 * a miss must not wipe a good image.
 *
 *   node scripts/generate-publication-shots.mjs [slug ...]
 *
 * Output: src/assets/albums/publications/<slug>.webp (read through
 * pubShotFor in src/lib/images.ts).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pubsDir = path.join(root, 'src/content/publications');
const outDir = path.join(root, 'src/assets/albums/publications');
const manifestPath = path.join(root, 'src/data/publication-images.json');
const WIDTH = 1600;
const HEIGHT = 1000;
const QUALITY = 88;

/** Href of the `label: "Source"` link, falling back to `pub-url`. */
function sourceUrl(raw) {
  const fm = raw.split('---\n', 3)[1] ?? '';
  const lines = fm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s*label:\s*['"]?Source['"]?\s*$/.test(lines[i])) {
      for (const l of lines.slice(i + 1, i + 4)) {
        const m = l.match(/^\s*href:\s*['"]?(https?:\/\/[^'"\s]+)/);
        if (m) return m[1];
      }
    }
  }
  return fm.match(/^pub-url:\s*['"]?(https?:\/\/[^'"\s]+)/m)?.[1] ?? null;
}

function youtubeId(url) {
  const u = new URL(url);
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  if (/(^|\.)youtube\.com$/.test(u.hostname)) {
    return (
      u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ?? null
    );
  }
  return null;
}

async function fetchBuf(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function thumbnail(url) {
  const id = youtubeId(url);
  if (id) {
    // maxres only exists for HD uploads; sd/hq are always there.
    for (const name of ['maxresdefault', 'sddefault', 'hqdefault']) {
      try {
        return await fetchBuf(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
      } catch {
        /* next size */
      }
    }
    throw new Error('no YouTube thumbnail');
  }
  if (/(^|\.)vimeo\.com$/.test(new URL(url).hostname)) {
    const meta = JSON.parse(
      (
        await fetchBuf(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=1280`,
        )
      ).toString(),
    );
    return fetchBuf(meta.thumbnail_url);
  }
  return null;
}

const UA = 'Mozilla/5.0 (compatible; noahweidig.com image bot)';

/** The page's share image: og:image, else twitter:image, made absolute. */
function metaImage(html, base) {
  for (const key of ['og:image', 'twitter:image']) {
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      if (!new RegExp(`(?:property|name)=["']${key}(?::src)?["']`, 'i').test(tag)) continue;
      const src = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (src) return new URL(src.replaceAll('&amp;', '&'), base).href;
    }
  }
  return null;
}

/** The page's share image. A refused plain fetch is retried in headless Chrome; only the meta tag is read, never a screenshot. */
async function pageImage(url, getBrowser) {
  let html;
  let base = url;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    html = (await res.text()).slice(0, 400_000);
    base = res.url;
  } catch (err) {
    const browser = await getBrowser();
    if (!browser) throw err;
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      html = await page.content();
      base = page.url();
    } finally {
      await page.close();
    }
  }
  const src = metaImage(html, base);
  return src ? fetchBuf(src) : null;
}

/** Site logos and tiny icons make a bad hero; keep only landscape images big enough to fill it. */
async function usable(buf) {
  const { width = 0, height = 1 } = await sharp(buf).metadata();
  const ratio = width / height;
  return width >= 600 && ratio >= 1 && ratio <= 2.5;
}

/** Page 1 of the entry's own PDF (public/publications/<slug>/<slug>.pdf) as a PNG, or null. Needs poppler's pdftoppm. */
function pdfFirstPage(slug) {
  const pdf = path.join(root, 'public/publications', slug, `${slug}.pdf`);
  if (!fs.existsSync(pdf)) return null;
  const out = spawnSync(
    'pdftoppm',
    ['-f', '1', '-l', '1', '-png', '-r', '150', '-singlefile', pdf],
    {
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return out.status === 0 && out.stdout.length ? out.stdout : null;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = (only.length ? only : fs.readdirSync(pubsDir).sort()).filter((s) =>
    fs.existsSync(path.join(pubsDir, s, 'index.md')),
  );
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  let browser;
  const getBrowser = async () => {
    if (browser === undefined) {
      try {
        const { default: puppeteer } = await import('puppeteer');
        browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
          ...(process.env.PUPPETEER_EXECUTABLE_PATH
            ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
            : {}),
        });
      } catch {
        browser = null;
      }
    }
    return browser;
  };

  let done = 0;
  const failed = [];
  try {
    for (const slug of slugs) {
      const raw = fs.readFileSync(path.join(pubsDir, slug, 'index.md'), 'utf8');
      let url = sourceUrl(raw);
      if (url && /\.pdf($|\?)/i.test(url)) url = null;
      const file = path.join(outDir, `${slug}.webp`);
      try {
        let buf = null;
        let kind = 'page';
        if (url) {
          try {
            buf = await thumbnail(url);
            if (buf) kind = 'video';
            else buf = await pageImage(url, getBrowser);
            if (buf && !(await usable(buf))) buf = null;
          } catch (err) {
            failed.push(slug);
            console.log(`::warning::${slug} source not read (${url}): ${err.message}`);
          }
        }
        // A good image from an earlier run beats a first-page render.
        const kept = manifest[slug] && manifest[slug].kind !== 'pdf';
        if (!buf && !kept) {
          buf = pdfFirstPage(slug);
          if (buf) kind = 'pdf';
        }
        if (!buf) {
          console.log(`· ${slug} no usable image${url ? ` at ${url}` : ''}`);
          continue;
        }
        await sharp(buf)
          .resize({
            width: WIDTH,
            ...(kind === 'pdf' ? { height: HEIGHT, fit: 'cover', position: 'top' } : {}),
            withoutEnlargement: true,
          })
          .webp({ quality: QUALITY })
          .toFile(file);
        manifest[slug] = kind === 'pdf' ? { kind } : { kind, source: url };
        done += 1;
        console.log(`✓ ${slug} ← ${kind === 'pdf' ? 'PDF page 1' : url}`);
      } catch (err) {
        failed.push(slug);
        console.log(`::warning::${slug} not refreshed: ${err.message}`);
      }
    }
  } finally {
    await browser?.close();
  }
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))),
      null,
      2,
    ) + '\n',
  );
  console.log(`${done} refreshed, ${failed.length} failed`);
  if (done === 0 && failed.length > 0) {
    console.error('::error::every publication image failed');
    process.exitCode = 1;
  }
}

await main();
