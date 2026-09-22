// Runs the vendored astro-seo-audit auditors (scripts/seo-audit/lib) against
// a built `dist/`, and writes the result to src/data/seo-audit.json — a
// checked-in diagnostic snapshot the /seo/ page renders, and that the next
// commit's diff makes visible without opening a dashboard.
//
//   node scripts/run-seo-audit.mjs               # ./dist -> src/data/seo-audit.json
//   node scripts/run-seo-audit.mjs --dir dist
import fs from 'fs';
import path from 'path';

const { findHtmlFiles, readFile, getRelativePath } = await import('./seo-audit/lib/utils.cjs');
const { auditMetaTags } = await import('./seo-audit/lib/auditors/meta-tags.cjs');
const { auditSchema } = await import('./seo-audit/lib/auditors/schema.cjs');
const { auditHreflang } = await import('./seo-audit/lib/auditors/hreflang.cjs');
const { auditSitemap } = await import('./seo-audit/lib/auditors/sitemap.cjs');
const { auditImages } = await import('./seo-audit/lib/auditors/images.cjs');
const { auditHeadings } = await import('./seo-audit/lib/auditors/headings.cjs');
const { auditPerformance } = await import('./seo-audit/lib/auditors/performance.cjs');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const distDir = path.resolve(arg('--dir', 'dist'));
const outFile = path.resolve('src/data/seo-audit.json');

if (!fs.existsSync(distDir)) {
  console.error(`Directory not found: ${distDir}. Run \`npm run build:fast\` first.`);
  process.exit(1);
}

const htmlFiles = findHtmlFiles(distDir);
if (htmlFiles.length === 0) {
  console.error(`No HTML files found in ${distDir}`);
  process.exit(1);
}

// Deliberate noindex redirect stubs (e.g. public/contact.html) are expected
// to fail meta/schema/heading/sitemap checks by design — they intentionally
// carry no content of their own, just a canonical link and JS redirect to
// the real page. Auditing them as if they were indexable content buries any
// genuine error under noise. See #276.
const NOINDEX_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i;

const pages = htmlFiles
  .map((filePath) => ({ filePath, html: readFile(filePath) }))
  .filter((page) => !NOINDEX_RE.test(page.html));

// The vendored hreflang auditor treats any two-letter first path segment as
// a locale prefix (so it can support real i18n sites), and /cv/ coincidentally
// matches that pattern even though this site has no i18n — producing a false
// "i18n page missing hreflang tags" error. Route it around that one auditor.
const HREFLANG_FALSE_POSITIVE_RE = /^\/cv\//;
const hreflangPages = pages.filter(
  (page) => !HREFLANG_FALSE_POSITIVE_RE.test(getRelativePath(page.filePath, distDir)),
);

const audits = [
  auditMetaTags(pages, distDir),
  auditSchema(pages, distDir),
  auditHreflang(hreflangPages, distDir),
  auditSitemap(pages, distDir),
  auditImages(pages, distDir),
  auditHeadings(pages, distDir),
  auditPerformance(pages, distDir),
];

// Same weighting the upstream tool uses: errors count double against the
// pass rate, so a page with one error and nine passes scores lower than one
// with ten passes and a stray warning.
function calculateScore(audits, totalPages) {
  if (totalPages === 0) return 0;
  let totalChecks = 0;
  let passedChecks = 0;
  let errorPenalty = 0;
  for (const audit of audits) {
    totalChecks += audit.passes.length + audit.warnings.length + audit.errors.length;
    passedChecks += audit.passes.length;
    errorPenalty += audit.errors.length * 2;
  }
  if (totalChecks === 0) return 100;
  const baseScore = (passedChecks / totalChecks) * 100;
  const penaltyFactor = Math.max(0, 1 - errorPenalty / totalChecks);
  return Math.max(0, Math.min(100, Math.round(baseScore * penaltyFactor)));
}

const score = calculateScore(audits, pages.length);
const totals = audits.reduce(
  (acc, a) => ({
    passes: acc.passes + a.passes.length,
    warnings: acc.warnings + a.warnings.length,
    errors: acc.errors + a.errors.length,
  }),
  { passes: 0, warnings: 0, errors: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  totalPages: pages.length,
  score,
  totals,
  audits: audits.map((a) => ({
    name: a.name,
    passes: a.passes.length,
    warnings: a.warnings.length,
    errors: a.errors.length,
    issues: [
      ...a.errors.map((i) => ({ ...i, severity: 'error' })),
      ...a.warnings.map((i) => ({ ...i, severity: 'warning' })),
    ],
  })),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
console.log(
  `SEO audit: ${score}/100 across ${pages.length} pages (${totals.errors} errors, ${totals.warnings} warnings) -> ${path.relative(process.cwd(), outFile)}`,
);
