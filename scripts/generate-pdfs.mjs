/**
 * Render the CV and the one-page résumé from the built site to PDFs in
 * public/uploads/, so the files people download are always the site's own
 * content rather than a document maintained beside it.
 *
 *   npm run build:fast && node scripts/generate-pdfs.mjs
 *
 * The résumé has to be one page. Rather than hand-tuning the type until it
 * happens to fit, the script prints it, counts the pages, and shrinks a single
 * `--fit` custom property until it does.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'public', 'uploads');
const BASE = '/new-website';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Serves dist/ under the site's base path, the way Pages does. */
function serve() {
  const server = createServer(async (req, res) => {
    try {
      let url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (url.startsWith(BASE)) url = url.slice(BASE.length) || '/';
      let file = path.join(dist, url);
      if (!file.startsWith(dist)) return res.writeHead(403).end();
      if (url.endsWith('/')) file = path.join(file, 'index.html');
      else if (!path.extname(file) && existsSync(`${file}/index.html`))
        file = path.join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Page count straight out of the PDF's page tree. */
const pageCount = (buf) => {
  const text = buf.toString('latin1');
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
};

async function render(page, url, opts = {}) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  // Web fonts that are still loading print as a fallback face.
  await page.evaluate(() => document.fonts.ready);
  return Buffer.from(
    await page.pdf({
      format: 'letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      ...opts,
    }),
  );
}

const { server, port } = await serve();
const origin = `http://127.0.0.1:${port}${BASE}`;
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  ...(process.env.PUPPETEER_EXECUTABLE_PATH
    ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
    : {}),
});

try {
  await mkdir(outDir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });

  // The CV: the site page itself, printed. Its print stylesheet already drops
  // the header, footer and the PDF buttons.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('nw-theme', 'light');
    } catch {
      /* nothing to persist to */
    }
  });
  const cv = await render(page, `${origin}/cv/`);
  await writeFile(path.join(outDir, 'cv.pdf'), cv);
  console.log(`cv.pdf — ${pageCount(cv)} page(s)`);

  // The résumé: shrink until it is one page, then stop.
  let resume = null;
  let fit = 1;
  for (let attempt = 0; attempt < 9; attempt++) {
    await page.goto(`${origin}/print/resume/`, { waitUntil: 'networkidle0' });
    await page.evaluate((f) => document.documentElement.style.setProperty('--fit', String(f)), fit);
    await page.emulateMediaType('print');
    await page.evaluate(() => document.fonts.ready);
    resume = Buffer.from(
      await page.pdf({ format: 'letter', printBackground: true, preferCSSPageSize: true }),
    );
    if (pageCount(resume) <= 1) break;
    fit = Number((fit - 0.04).toFixed(2));
  }
  const pages = pageCount(resume);
  if (pages > 1) throw new Error(`résumé still ${pages} pages at --fit ${fit}`);
  await writeFile(path.join(outDir, 'resume.pdf'), resume);
  console.log(`resume.pdf — 1 page at --fit ${fit}`);
} finally {
  await browser.close();
  server.close();
}
