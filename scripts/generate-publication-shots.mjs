/**
 * Builds the hero image for every publication that has a "Source" link:
 * a YouTube thumbnail, the Vimeo oEmbed thumbnail, or else the page's own
 * og:image / twitter:image. Pages with no usable share image get none (the
 * detail page falls back to its Metrics panel); a stale file is removed.
 * Screenshots are not used: publisher pages come out as cookie banners and
 * paywalls.
 *
 *   node scripts/generate-publication-shots.mjs [slug ...]
 *
 * Output: src/assets/albums/publications/<slug>.webp (read through
 * pubShotFor in src/lib/images.ts). A failed fetch leaves the file alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pubsDir = path.join(root, 'src/content/publications');
const outDir = path.join(root, 'src/assets/albums/publications');
const WIDTH = 1600;
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
async function pageImage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const html = (await res.text()).slice(0, 400_000);
  for (const key of ['og:image', 'twitter:image']) {
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      if (!new RegExp(`(?:property|name)=["']${key}(?::src)?["']`, 'i').test(tag)) continue;
      const src = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (src) return fetchBuf(new URL(src.replaceAll('&amp;', '&'), res.url).href);
    }
  }
  return null;
}

/** Site logos and tiny icons make a bad hero; keep only landscape images big enough to fill it. */
async function usable(buf) {
  const { width = 0, height = 1 } = await sharp(buf).metadata();
  const ratio = width / height;
  return width >= 600 && ratio >= 1 && ratio <= 2.5;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = (only.length ? only : fs.readdirSync(pubsDir).sort()).filter((s) =>
    fs.existsSync(path.join(pubsDir, s, 'index.md')),
  );
  fs.mkdirSync(outDir, { recursive: true });

  let done = 0;
  const failed = [];
  for (const slug of slugs) {
    const url = sourceUrl(fs.readFileSync(path.join(pubsDir, slug, 'index.md'), 'utf8'));
    if (!url || /\.pdf($|\?)/i.test(url)) continue;
    const file = path.join(outDir, `${slug}.webp`);
    try {
      let buf = (await thumbnail(url)) ?? (await pageImage(url));
      if (buf && !(await usable(buf))) buf = null;
      if (!buf) {
        fs.rmSync(file, { force: true });
        console.log(`· ${slug} no usable image at ${url}`);
        continue;
      }
      await sharp(buf)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(file);
      done += 1;
      console.log(`✓ ${slug} ← ${url}`);
    } catch (err) {
      failed.push(slug);
      console.log(`::warning::${slug} not refreshed (${url}): ${err.message}`);
    }
  }
  console.log(`${done} refreshed, ${failed.length} failed`);
  if (done === 0 && failed.length > 0) {
    console.error('::error::every publication image failed');
    process.exitCode = 1;
  }
}

await main();
