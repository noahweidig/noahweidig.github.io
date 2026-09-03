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

/** Request paths this server will look at: no traversal, no odd characters. */
const SAFE_PATH = /^[a-zA-Z0-9._/-]*$/;

/** Resolves a request path to a file inside dist/, or null if it is not one. */
function resolveFile(rawUrl) {
  let url = (rawUrl ?? '/').split('?')[0];
  if (url.startsWith(BASE)) url = url.slice(BASE.length) || '/';
  if (!SAFE_PATH.test(url) || url.includes('..')) return null;
  const rel = url.endsWith('/') ? `${url}index.html` : url;
  const file = path.resolve(dist, `.${rel}`);
  if (file !== dist && !file.startsWith(dist + path.sep)) return null;
  // A directory URL written without its trailing slash still means the page.
  if (!path.extname(file) && existsSync(path.join(file, 'index.html'))) {
    return path.join(file, 'index.html');
  }
  return file;
}

/** Serves dist/ under the site's base path, the way Pages does. */
function serve() {
  const server = createServer(async (req, res) => {
    const file = resolveFile(req.url);
    if (!file) return res.writeHead(403).end('forbidden');
    try {
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
