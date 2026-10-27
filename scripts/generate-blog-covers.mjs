/**
 * Renders each blog post's cover art (dark and light) in the site's width-poster
 * look: a flat cobalt field, a wide yellow label, the title in giant condensed
 * Archivo capitals and a yellow band along the bottom (scripts/lib/blog-cover.mjs),
 * using the self-hosted Archivo face from public/fonts.
 *
 * The same renderer also covers every other page that doesn't already carry
 * a real photo: one og:image per projects/publications/experience/education
 * entry, and one per fixed content-free page (section indexes, CV, contact,
 * privacy). Those land in public/media/og/ as plain files, referenced by path
 * — unlike blog/award covers they aren't Astro content-collection images, so
 * no getImage() processing is needed.
 *
 *   node scripts/generate-blog-covers.mjs [slug ...]   # blog posts, all if omitted
 *   node scripts/generate-blog-covers.mjs --site        # the site-wide og:image card
 *   node scripts/generate-blog-covers.mjs --collections # projects/publications/experience/education covers
 *   node scripts/generate-blog-covers.mjs --pages       # section-index & utility-page covers
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { coverHtml } from './lib/blog-cover.mjs';
import { readFrontmatter } from './lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(root, 'src/content/blog');
const fontsDir = path.join(root, 'public/fonts');
const siteCardOut = path.join(root, 'public/media/authors/site-og.webp');
const ogDir = path.join(root, 'public/media/og');

// Directory-per-entry collections without a real photo of their own. Kicker
// mirrors what Detail.astro prints for that section, so the shared card and
// the page it links to agree.
const COLLECTIONS = {
  projects: {
    dir: 'src/content/projects',
    kicker: (fm) => (fm.featured ? 'Featured project' : 'Project'),
  },
  publications: {
    dir: 'src/content/publications',
    kicker: (fm) => fm.categories[0] ?? 'Publication',
  },
  experience: { dir: 'src/content/experience', kicker: () => 'Experience' },
  education: { dir: 'src/content/education', kicker: () => 'Education' },
};

// Fixed pages with no content-collection entry of their own.
const PAGES = [
  { slug: 'projects', title: 'Selected Projects', kicker: 'Selected work' },
  { slug: 'publications', title: 'Publications', kicker: 'Research output' },
  { slug: 'experience', title: 'Experience', kicker: 'Background' },
  { slug: 'education', title: 'Education', kicker: 'Background' },
  { slug: 'awards', title: 'Awards & Honors', kicker: 'Recognition' },
  { slug: 'blog', title: 'Blog', kicker: 'Writing' },
  { slug: 'tags', title: 'Tags', kicker: 'Index' },
  { slug: 'cv', title: 'Curriculum Vitae', kicker: 'Full record' },
  { slug: 'contact', title: 'Get in Touch', kicker: 'Contact' },
  { slug: 'privacy', title: 'Privacy', kicker: 'Legal' },
];

// Kept in sync with src/lib/site.ts by hand — this script runs standalone
// via plain node, not through Astro's TS pipeline.
const SITE = { name: 'Noah Weidig', role: 'GIS Analyst & Data Scientist' };

const WIDTH = 1200;
const HEIGHT = 675;

function buildFontFaceCss() {
  const css = fs.readFileSync(path.join(root, 'src/styles/fonts.css'), 'utf8');
  return css.replace(/url\('\/fonts\/([^']+)'\)/g, (_, file) => {
    const abs = path.join(fontsDir, file);
    return `url('file://${abs}')`;
  });
}

const FONT_FACE_CSS = buildFontFaceCss();

// The title, the `categories` list and the `featured` flag are all a cover needs.
function parseFrontmatter(raw, slug) {
  const fm = readFrontmatter(raw);
  return {
    title: String(fm.title ?? slug),
    categories: (fm.categories ?? []).map(String),
    featured: fm.featured === true,
  };
}

function readPostMeta(slug) {
  const raw = fs.readFileSync(path.join(blogDir, slug, 'index.md'), 'utf8');
  const { title, categories } = parseFrontmatter(raw, slug);
  return { title, kicker: categories[0] ?? 'Blog' };
}

function readEntryMeta(collDir, slug, kickerFor) {
  const raw = fs.readFileSync(path.join(root, collDir, slug, 'index.md'), 'utf8');
  const fm = parseFrontmatter(raw, slug);
  return { title: fm.title, kicker: kickerFor(fm) };
}

// Loaded from a file:// page rather than setContent(): about:blank may not
// load file:// fonts, which silently falls back to a system face.
async function renderCover(browser, opts, outFile) {
  const html = coverHtml({ ...opts, fontCss: FONT_FACE_CSS });
  const tmp = path.join(os.tmpdir(), `cover-${process.pid}-${path.basename(outFile)}.html`);
  fs.writeFileSync(tmp, html);
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
  await page.goto(`file://${tmp}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outFile, type: 'webp', quality: 92 });
  await page.close();
  fs.rmSync(tmp, { force: true });
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const only = args.filter((a) => !a.startsWith('--'));
  const flagged = flags.size > 0;

  const doSite = flags.has('--site');
  const doCollections = flags.has('--collections');
  const doPages = flags.has('--pages');
  // Bare invocation (no flags, no slugs) keeps the original behaviour: every
  // blog post plus the site card. A flag narrows the run to just what's asked.
  const doBlog = flags.has('--blog') || only.length > 0 || !flagged;
  const slugs = doBlog
    ? (only.length ? only : fs.readdirSync(blogDir)).filter((slug) =>
        fs.existsSync(path.join(blogDir, slug, 'index.md')),
      )
    : [];

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });

  for (const slug of slugs) {
    const { title, kicker } = readPostMeta(slug);
    const darkOut = path.join(blogDir, slug, 'cover.webp');
    const lightOut = path.join(blogDir, slug, 'cover-light.webp');
    for (const [mode, out] of [
      ['dark', darkOut],
      ['light', lightOut],
    ]) {
      const opts = { title, kicker, mode };
      await renderCover(browser, opts, out);
    }
    console.log(`✓ ${slug}`);
  }

  if (doSite || (!flagged && only.length === 0)) {
    await renderCover(
      browser,
      { title: SITE.role, kicker: SITE.name, mode: 'light', slug: 'site-og' },
      siteCardOut,
    );
    console.log('✓ site-og');
  }

  if (doCollections) {
    for (const [coll, { dir, kicker }] of Object.entries(COLLECTIONS)) {
      const collDir = path.join(root, dir);
      const outDir = path.join(ogDir, coll);
      fs.mkdirSync(outDir, { recursive: true });
      const collSlugs = fs
        .readdirSync(collDir)
        .filter((slug) => fs.existsSync(path.join(collDir, slug, 'index.md')));
      for (const slug of collSlugs) {
        const meta = readEntryMeta(dir, slug, kicker);
        const out = path.join(outDir, `${slug}.webp`);
        await renderCover(browser, { ...meta, mode: 'light' }, out);
        console.log(`✓ ${coll}/${slug}`);
      }
    }
  }

  if (doPages) {
    fs.mkdirSync(ogDir, { recursive: true });
    for (const { slug, title, kicker } of PAGES) {
      const out = path.join(ogDir, `${slug}.webp`);
      await renderCover(browser, { title, kicker, mode: 'light' }, out);
      console.log(`✓ page ${slug}`);
    }
  }

  await browser.close();
}

await main();
