/**
 * Renders each blog post's cover art (dark and light) straight from the
 * site's own tokens — accent/ember/moss/violet glows, the grid, the self-hosted
 * Inter/Newsreader/JetBrains Mono faces — instead of a hand-maintained image.
 * A post's slug seeds which two hues glow and where the contour-ring mark
 * sits, so covers read as one family without being identical.
 *
 *   node scripts/generate-blog-covers.mjs [slug ...]   # all posts if omitted
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(root, 'src/content/blog');
const fontsDir = path.join(root, 'public/fonts');

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
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.charCodeAt(i);
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  font-size: ${title.length > 28 ? '64px' : title.length > 16 ? '76px' : '92px'};
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

async function renderCover(browser, opts, outFile) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
  await page.setContent(pageHtml(opts), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outFile, type: 'webp', quality: 92 });
  await page.close();
}

async function main() {
  const only = process.argv.slice(2);
  const slugs = (only.length ? only : fs.readdirSync(blogDir)).filter((slug) =>
    fs.existsSync(path.join(blogDir, slug, 'index.md')),
  );

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });

  for (const slug of slugs) {
    const mdPath = path.join(blogDir, slug, 'index.md');
    const raw = fs.readFileSync(mdPath, 'utf8');
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
    let kicker = 'Blog';
    if (catIndex !== -1) {
      for (let i = catIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.startsWith(' ') && !line.startsWith('\t')) break;
        const item = line.trim();
        if (item.startsWith('- ')) {
          kicker = item.slice(2).trim();
          break;
        }
      }
    }

    const darkOut = path.join(blogDir, slug, 'cover.webp');
    const lightOut = path.join(blogDir, slug, 'cover-light.webp');
    await renderCover(browser, { title, kicker, mode: 'dark', slug }, darkOut);
    await renderCover(browser, { title, kicker, mode: 'light', slug }, lightOut);
    console.log(`✓ ${slug}`);
  }

  await browser.close();
}

main();
