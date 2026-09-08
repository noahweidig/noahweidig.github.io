/**
 * Screenshots every project's live site into the card art the projects grid
 * and the research-areas panel use, so a tool that changes doesn't keep
 * showing the picture it had the day it shipped.
 *
 *   node scripts/generate-project-shots.mjs [slug ...]
 *
 * The URL comes from the entry's own frontmatter — the first `links:` entry
 * that points somewhere http(s) — so adding a project needs no edit here.
 * SKIP lists the few whose page can't be shot unattended; those keep the
 * hand-made image already committed.
 *
 * Every consumer of these files crops 16:10 from the top: ProjectCard and
 * ResearchAreas both render `aspect-16/10 object-cover object-top`, and the
 * `<img>` inside each index.md declares 1600×1000. So one 1600×1000 frame is
 * the whole set of sizes the site needs — the og:image cards are drawn by
 * generate-blog-covers.mjs and never use a screenshot.
 *
 * Two copies are written, because the site reads them two ways:
 *   src/assets/albums/projects/<slug>.webp   → Astro <Image>, real srcset
 *   public/media/albums/projects/<slug>.webp → plain <img> in index.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = path.join(root, 'src/content/projects');
const assetsDir = path.join(root, 'src/assets/albums/projects');
const publicDir = path.join(root, 'public/media/albums/projects');

// 16:10 at the width the largest `widths` step asks for (1200) plus headroom,
// matching the dimensions every index.md already declares.
const WIDTH = 1600;
const HEIGHT = 1000;
const QUALITY = 88;

// Projects whose linked page can't be screenshotted unattended. Their
// committed image stays as it is.
const SKIP = {
  roads: 'links to a third-party catalog page, not a site of mine',
  wuirisk: 'Earth Engine app: the viewer signs in and renders far past load',
};

// Seconds to let a page settle after load, per slug. Anything map- or
// chart-heavy paints well after the network goes quiet.
const SETTLE = { default: 3000, maplab: 6000, maps: 6000, wildfire: 6000, quickplot: 5000 };

/** First http(s) `href:` in the entry's `links:` block. */
function shotUrl(raw) {
  const frontmatter = raw.split('---\n', 3)[1] ?? '';
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((l) => l.startsWith('links:'));
  if (start === -1) return null;
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(' ') && !line.startsWith('\t')) break;
    const m = line.trim().match(/^href:\s*['"]?(https?:\/\/[^'"\s]+)/);
    if (m) return m[1];
  }
  return null;
}

async function shoot(browser, slug, url) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    // The committed shots are all dark-theme, and every site of mine follows
    // the visitor's scheme; asking for dark keeps the set consistent.
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    // Scrollbars and a mid-animation carousel are the two things that make an
    // otherwise identical shot differ run to run.
    await page.addStyleTag({
      content: `::-webkit-scrollbar{display:none!important}
                *,*::before,*::after{animation-play-state:paused!important;transition:none!important}`,
    });
    await new Promise((r) => setTimeout(r, SETTLE[slug] ?? SETTLE.default));

    const buf = await page.screenshot({
      type: 'webp',
      quality: QUALITY,
      captureBeyondViewport: false,
    });
    fs.writeFileSync(path.join(assetsDir, `${slug}.webp`), buf);
    fs.writeFileSync(path.join(publicDir, `${slug}.webp`), buf);
  } finally {
    await page.close();
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = (only.length ? only : fs.readdirSync(projectsDir).sort()).filter((slug) =>
    fs.existsSync(path.join(projectsDir, slug, 'index.md')),
  );

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });

  let done = 0;
  const failed = [];
  try {
    for (const slug of slugs) {
      if (SKIP[slug] && !only.includes(slug)) {
        console.log(`· ${slug} skipped — ${SKIP[slug]}`);
        continue;
      }
      const url = shotUrl(fs.readFileSync(path.join(projectsDir, slug, 'index.md'), 'utf8'));
      if (!url) {
        console.log(`· ${slug} skipped — no http link in frontmatter`);
        continue;
      }
      try {
        await shoot(browser, slug, url);
        done += 1;
        console.log(`✓ ${slug} ← ${url}`);
      } catch (err) {
        failed.push(slug);
        // A single unreachable site shouldn't cost the whole run: its old
        // image is left untouched and the rest still refresh.
        console.log(`::warning::${slug} not refreshed (${url}): ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`${done} refreshed, ${failed.length} failed`);
  // Only a run that got nothing is a real failure — that means the browser or
  // the network, not one site being down.
  if (done === 0 && failed.length > 0) {
    console.error('::error::every project screenshot failed');
    process.exitCode = 1;
  }
}

await main();
