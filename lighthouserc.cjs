const path = require('node:path');

// The site is served at the apex (`base` is `/` in astro.config.mjs), so
// staticDistDir serves dist itself at "/" — the same shape the server serves.
const ROOT = path.resolve(__dirname, 'dist');

const url = (p) => `http://localhost/${p}`;

// Lighthouse CI over the built site, run per-PR by
// .github/workflows/lighthouse.yml. lighthouserc.production.cjs imports
// ASSERTIONS from here so production is held to the same bar as a PR.
//
// The numbers are ceilings and floors, not targets: each sits just past the
// worst of the ten audited URLs as measured today, so the current site passes
// and any regression fails. That is the convention this repo has always used —
// ratchet them tighter as the site gets faster, and never loosen one without
// saying why in the same commit.
//
// Measured on CI, 2026-09-03, against the built site served at its root.
// Two earlier passes set these from a dev server on a faster machine; the
// numbers below come from the runner the gate actually runs on.
//
//   metric         worst on CI  page                        threshold
//   performance    0.84         /blog/                      0.80
//                  0.78         /       (homepage only)      0.75
//   accessibility  1.00         (all)                       0.98
//   best-practices 0.96         (all)                       0.95
//   seo            1.00         (all)                       1.00
//   LCP            4161ms       /blog/                      4500ms
//                  5556ms       /       (homepage only)      6000ms
//   CLS            0.000        (all)                       0.05
//   TBT            0ms          (all)                       200ms
//
// Performance and LCP both get headroom rather than sitting on the worst case:
// they are the two assertions here that move with the runner. Successive CI
// runs put /contact/ at 3916ms and 3905ms, and the performance score — which is
// computed from those same timings — came in at 0.87 on one run and 0.84 on the
// next. A shared runner having a slow minute should not turn the build red.
// Setting performance at 0.85 was a mistake for exactly this reason: it hugged
// the observed worst on a metric that is not stable. The deterministic
// assertions below stay tight.
//
// These sit well below what a visitor sees. LHCI's static server sends no
// compression and its runner is shared, while GitHub Pages behind Cloudflare
// gzips everything; the same pages score 0.95-1.00 with LCP 1734-2933ms on a
// compressing server. Serving compressed bytes in CI is the change that would
// let these tighten toward the production numbers.
//
// LCP is gated on the two custom display faces either way: 142 KB of woff2 on
// the critical path, and the headline cannot paint in Newsreader before it
// lands. Subsetting those to the weights actually used is the other lever.
//
// 2026-09-03: the homepage — and only the homepage — got a 6000ms ceiling and a
// 0.75 floor, because that page's LCP element changed.
// The hero portrait now sits above the copy on mobile, so it is in the initial
// viewport and Lighthouse measures it rather than the headline text. Three CI
// runs put it at 5508ms, 5556ms and 5459ms; the same builds measure 3833ms
// here, and building main from before the change measured 3834ms — the page did
// not get slower, the element being timed changed. The breakdown is TTFB 10ms,
// resource load delay 16ms, load duration 18ms, element render delay 1093ms:
// the 8 KB image is not the cost, the render-blocking 59 KB stylesheet and the
// font preloads ahead of it are. Preloading the portrait from the head bought
// about 50ms. Inlining critical CSS is the change that would earn these back.
//
// The other nine URLs keep the tighter numbers: relaxing the shared set would
// let a real regression on /blog/ or /cv/ through unnoticed, so the homepage
// carries its own entry in the assertion matrix instead.

const ASSERTIONS = {
  'categories:performance': ['error', { minScore: 0.8 }],
  'categories:accessibility': ['error', { minScore: 0.98 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 1 }],

  'largest-contentful-paint': ['error', { maxNumericValue: 4500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
  'total-blocking-time': ['error', { maxNumericValue: 200 }],

  // Advisory: these fire on third-party embeds (Giscus, GA4) the build does
  // not control, so they report without failing the run.
  'unused-javascript': 'off',
  'third-party-cookies': 'off',
  'uses-long-cache-ttl': 'off',
  'legacy-javascript': 'off',
  // One render-blocking stylesheet, which is the whole design system. Splitting
  // it would trade a flash of unstyled content for the audit's approval.
  'render-blocking-resources': 'warn',
};

// Everything the rest of the site is held to, with the homepage's two moved
// metrics swapped out. See the note above for the measurements behind them.
const HOMEPAGE_ASSERTIONS = {
  ...ASSERTIONS,
  'categories:performance': ['error', { minScore: 0.75 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 6000 }],
};

/* lhci applies every matrix entry whose pattern matches, so the general entry
   has to exclude the homepage rather than merely come second. `pattern` is the
   homepage as that config addresses it — a built file path in CI, a bare
   origin in production. */
const assertMatrix = (pattern) => [
  { matchingUrlPattern: pattern, assertions: HOMEPAGE_ASSERTIONS },
  { matchingUrlPattern: `^(?!${pattern.replace(/^\^/, '')})`, assertions: ASSERTIONS },
];

module.exports = {
  ASSERTIONS,
  HOMEPAGE_ASSERTIONS,
  assertMatrix,
  ci: {
    collect: {
      staticDistDir: ROOT,
      // One detail page per section alongside the indexes, so the templates
      // that only ever appear on a child page get scored too.
      url: [
        url('index.html'),
        url('cv/index.html'),
        url('projects/index.html'),
        url('publications/index.html'),
        url('blog/index.html'),
        url('contact/index.html'),
        url('styleguide/index.html'),
        url('projects/chartifyr/index.html'),
        url('publications/alexander-shifting-forest-25/index.html'),
        url('blog/favorite-r-packages/index.html'),
      ],
    },
    upload: { target: 'temporary-public-storage' },
    assert: { assertMatrix: assertMatrix('^https?://[^/]+/index\\.html$') },
  },
};
