/**
 * Builds the hero image for every publication that has a "Source" link:
 * a YouTube thumbnail for YouTube links, the oEmbed thumbnail for Vimeo,
 * and a Puppeteer screenshot of the page for anything else.
 *
 *   node scripts/generate-publication-shots.mjs [slug ...]
 *
 * Output: src/assets/albums/publications/<slug>.webp (Astro <Image>, read
 * through shotFor-style glob in src/lib/images.ts). A failed fetch leaves the
 * committed image alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pubsDir = path.join(root, 'src/content/publications');
const outDir = path.join(root, 'src/assets/albums/publications');
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

async function screenshot(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.addStyleTag({
      content: `::-webkit-scrollbar{display:none!important}
                *,*::before,*::after{animation-play-state:paused!important;transition:none!important}`,
    });
    await new Promise((r) => setTimeout(r, 3000));
    return await page.screenshot({ type: 'png', captureBeyondViewport: false });
  } finally {
    await page.close();
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = (only.length ? only : fs.readdirSync(pubsDir).sort()).filter((s) =>
    fs.existsSync(path.join(pubsDir, s, 'index.md')),
  );
  fs.mkdirSync(outDir, { recursive: true });

  let browser;
  let done = 0;
  const failed = [];
  try {
    for (const slug of slugs) {
      const url = sourceUrl(fs.readFileSync(path.join(pubsDir, slug, 'index.md'), 'utf8'));
      if (!url || /\.pdf($|\?)/i.test(url)) continue;
      try {
        let buf = await thumbnail(url);
        let fit = 'cover';
        if (!buf) {
          if (!browser) {
            const { default: puppeteer } = await import('puppeteer');
            browser = await puppeteer.launch({
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
              ...(process.env.PUPPETEER_EXECUTABLE_PATH
                ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
                : {}),
            });
          }
          buf = await screenshot(browser, url);
          fit = 'cover';
        }
        await sharp(buf)
          .resize({ width: WIDTH, withoutEnlargement: true, fit })
          .webp({ quality: QUALITY })
          .toFile(path.join(outDir, `${slug}.webp`));
        done += 1;
        console.log(`✓ ${slug} ← ${url}`);
      } catch (err) {
        failed.push(slug);
        console.log(`::warning::${slug} not refreshed (${url}): ${err.message}`);
      }
    }
  } finally {
    await browser?.close();
  }
  console.log(`${done} refreshed, ${failed.length} failed`);
  if (done === 0 && failed.length > 0) {
    console.error('::error::every publication image failed');
    process.exitCode = 1;
  }
}

await main();
