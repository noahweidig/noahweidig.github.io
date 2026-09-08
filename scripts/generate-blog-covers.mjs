/**
 * Renders each blog post's cover art (dark and light) straight from the
 * site's own tokens — accent/ember/moss/violet glows, the grid, the self-hosted
 * Inter/Newsreader/JetBrains Mono faces — instead of a hand-maintained image.
 * A post's slug seeds which two hues glow and where the contour-ring mark
 * sits, so covers read as one family without being identical.
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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(root, 'src/content/blog');
const fontsDir = path.join(root, 'public/fonts');
const siteCardOut = path.join(root, 'public/media/authors/site-og.webp');
const ogDir = path.join(root, 'public/media/og');

// Directory-per-entry collections without a real photo of their own. Kicker
// mirrors what Detail.astro prints for that section, so the shared card and
// the page it links to agree.
const COLLECTIONS = {
  projects: { dir: 'src/content/projects', kicker: (fm) => (fm.featured ? 'Featured project' : 'Project') },
  publications: { dir: 'src/content/publications', kicker: (fm) => fm.categories[0] ?? 'Publication' },
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

const THEME = {
  dark: {
    bg: '#07080b',
    bgDeep: '#040507',
    ink: '#e9ecf2',
    dim: '#a7afbe',
    faint: '#7c8494',
    line: '#ffffff',
    lineOpacity: 0.07,
    ringOpacity: 0.11,
  },
  light: {
    bg: '#fbfaf7',
    bgDeep: '#f2f0eb',
    ink: '#14161c',
    dim: '#43495a',
    faint: '#636a78',
    line: '#14161c',
    lineOpacity: 0.06,
    ringOpacity: 0.1,
  },
};

// Same hex values as --c-accent/--c-ember/--c-moss/--c-violet in global.css,
// dark and light rows, so a cover always uses colors the site itself paints.
const HUES = {
  dark: { accent: '#3d86ff', ember: '#ff8f45', moss: '#4bd0a0', violet: '#a988ff' },
  light: { accent: '#0f62d6', ember: '#a44a16', moss: '#0f7a56', violet: '#6541c9' },
};

// Deterministic per-slug variation: which two hues glow, where, and which
// corner the contour-ring mark sits in. Order matters for the hash, not the
// content, so adding posts later doesn't reshuffle existing covers.
const PRESETS = [
  { a: 'accent', aPos: '92% -10%', b: 'violet', bPos: '-8% 115%', ring: 'right' },
  { a: 'violet', aPos: '-10% -15%', b: 'moss', bPos: '108% 110%', ring: 'left' },
  { a: 'ember', aPos: '105% 115%', b: 'accent', bPos: '-10% -10%', ring: 'right' },
  { a: 'moss', aPos: '95% -15%', b: 'violet', bPos: '105% 115%', ring: 'left' },
];

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.codePointAt(i);
  return h >>> 0;
}

function presetFor(slug) {
  return PRESETS[hash(slug) % PRESETS.length];
}

function buildFontFaceCss() {
  const css = fs.readFileSync(path.join(root, 'src/styles/fonts.css'), 'utf8');
  return css.replace(/url\('\/fonts\/([^']+)'\)/g, (_, file) => {
    const abs = path.join(fontsDir, file);
    return `url('file://${abs}')`;
  });
}

const FONT_FACE_CSS = buildFontFaceCss();

function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function titleFontSize(title) {
  if (title.length > 28) return '64px';
  if (title.length > 16) return '76px';
  return '92px';
}

function pageHtml({ title, kicker, mode, slug }) {
  const t = THEME[mode];
  const hues = HUES[mode];
  const preset = presetFor(slug);
  const ringCss =
    preset.ring === 'right' ? 'right: -70px; bottom: -70px;' : 'left: -70px; bottom: -70px;';
  const dotCss =
    preset.ring === 'right' ? 'right: 60px; bottom: 60px;' : 'left: 60px; bottom: 60px;';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${FONT_FACE_CSS}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body {
  position: relative;
  background: linear-gradient(160deg, ${t.bg} 0%, ${t.bgDeep} 100%);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.glow {
  position: absolute;
  inset: 0;
  mix-blend-mode: ${mode === 'dark' ? 'screen' : 'multiply'};
}
.glow.a {
  background: radial-gradient(560px 560px at ${preset.aPos}, ${hues[preset.a]} 0%, transparent 68%);
  opacity: ${mode === 'dark' ? 0.55 : 0.28};
}
.glow.b {
  background: radial-gradient(520px 520px at ${preset.bPos}, ${hues[preset.b]} 0%, transparent 68%);
  opacity: ${mode === 'dark' ? 0.38 : 0.2};
}
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, ${t.line} 1px, transparent 1px),
    linear-gradient(to bottom, ${t.line} 1px, transparent 1px);
  background-size: 60px 60px;
  opacity: ${t.lineOpacity};
  -webkit-mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, #000 20%, transparent 78%);
  mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, #000 20%, transparent 78%);
}
.rings {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  ${ringCss}
}
.rings::before, .rings::after, .rings i {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 50%;
  border: 1.5px solid ${t.ink};
  opacity: ${t.ringOpacity};
}
.rings::before { width: 220px; height: 220px; }
.rings::after { width: 320px; height: 320px; }
.rings i { width: 420px; height: 420px; }
.dot {
  position: absolute;
  ${dotCss}
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${hues.moss};
}
.hairline {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: ${t.line};
  opacity: ${t.lineOpacity};
}
.content {
  position: relative;
  height: 100%;
  padding: 64px 76px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.kicker {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: ${t.dim};
}
.title {
  font-family: Newsreader, ui-serif, Georgia, serif;
  font-weight: 500;
  font-size: ${titleFontSize(title)};
  line-height: 1.08;
  color: ${t.ink};
  max-width: 920px;
}
.footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.domain {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 16px;
  letter-spacing: 0.03em;
  color: ${t.faint};
}
</style>
</head>
<body>
  <div class="glow a"></div>
  <div class="glow b"></div>
  <div class="grid"></div>
  <div class="rings"><i></i></div>
  <div class="dot"></div>
  <div class="hairline" style="top: 0;"></div>
  <div class="hairline" style="bottom: 0;"></div>
  <div class="content">
    <div class="kicker">${escapeHtml(kicker)}</div>
    <div class="title">${escapeHtml(title)}</div>
    <div class="footer">
      <span class="domain">noahweidig.com</span>
    </div>
  </div>
</body>
</html>`;
}

// Reads just enough of an entry's frontmatter to build its cover: the title,
// the `categories:` YAML block list, and the `featured:` flag.
function parseFrontmatter(raw, slug) {
  const frontmatter = raw.split('---\n', 3)[1] ?? '';
  const lines = frontmatter.split('\n');

  const titleLine = lines.find((l) => l.startsWith('title:'));
  const title = (titleLine ? titleLine.slice('title:'.length).trim() : slug).replace(
    /^['"]|['"]$/g,
    '',
  );

  // `categories:` is a YAML block list — its items are the following lines
  // indented under it, up to the next unindented (top-level) key.
  const catIndex = lines.findIndex((l) => l.startsWith('categories:'));
  const catLines = catIndex === -1 ? [] : lines.slice(catIndex + 1);
  const indented = [];
  for (const line of catLines) {
    if (!line.startsWith(' ') && !line.startsWith('\t')) break;
    indented.push(line.trim());
  }
  const categories = indented.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());

  const featuredLine = lines.find((l) => l.startsWith('featured:'));
  const featured = featuredLine ? featuredLine.slice('featured:'.length).trim() === 'true' : false;

  return { title, categories, featured };
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

async function renderCover(browser, opts, outFile) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
  await page.setContent(pageHtml(opts), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outFile, type: 'webp', quality: 92 });
  await page.close();
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
    await renderCover(browser, { title, kicker, mode: 'dark', slug }, darkOut);
    await renderCover(browser, { title, kicker, mode: 'light', slug }, lightOut);
    console.log(`✓ ${slug}`);
  }

  if (doSite || (!flagged && only.length === 0)) {
    await renderCover(
      browser,
      { title: SITE.role, kicker: SITE.name, mode: 'dark', slug: 'site-og' },
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
        await renderCover(browser, { ...meta, mode: 'dark', slug: `${coll}/${slug}` }, out);
        console.log(`✓ ${coll}/${slug}`);
      }
    }
  }

  if (doPages) {
    fs.mkdirSync(ogDir, { recursive: true });
    for (const { slug, title, kicker } of PAGES) {
      const out = path.join(ogDir, `${slug}.webp`);
      await renderCover(browser, { title, kicker, mode: 'dark', slug: `page-${slug}` }, out);
      console.log(`✓ page ${slug}`);
    }
  }

  await browser.close();
}

await main();
