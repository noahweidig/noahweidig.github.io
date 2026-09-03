const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The site is served under a base path (`base` in astro.config.mjs), and every
// asset URL in the build carries it. staticDistDir serves the folder it is
// given at "/", so dist has to be mounted under a directory of that name —
// otherwise every stylesheet and script 404s and Lighthouse scores an unstyled
// page, which is neither what ships nor comparable to anything.
const BASE = 'new-website';
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'lhci-site-'));
fs.symlinkSync(path.resolve(__dirname, 'dist'), path.join(ROOT, BASE));

const url = (p) => `http://localhost/${BASE}/${p}`;

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
// Measured on CI, 2026-09-03, against the build mounted under its base path.
// Two earlier passes set these from a dev server on a faster machine; the
// numbers below come from the runner the gate actually runs on.
//
//   metric         worst on CI  page                        threshold
//   performance    0.78         /  (see below)               0.75
//   accessibility  1.00         (all)                       0.98
//   best-practices 0.96         (all)                       0.95
//   seo            1.00         (all)                       1.00
//   LCP            5556ms       /  (see below)               6000ms
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
// 2026-09-03: the homepage ceiling moved from 4500ms to 6000ms and the
// performance floor from 0.80 to 0.75, because the page's LCP element changed.
// The hero portrait now sits above the copy on mobile, so it is in the initial
// viewport and Lighthouse measures it rather than the headline text. Three CI
// runs put it at 5508ms, 5556ms and 5459ms; the same builds measure 3833ms
// here, and building main from before the change measured 3834ms — the page did
// not get slower, the element being timed changed. The breakdown is TTFB 10ms,
// resource load delay 16ms, load duration 18ms, element render delay 1093ms:
// the 8 KB image is not the cost, the render-blocking 59 KB stylesheet and the
// font preloads ahead of it are. Preloading the portrait from the head bought
// about 50ms. Inlining critical CSS is the change that would earn these back.

const ASSERTIONS = {
  'categories:performance': ['error', { minScore: 0.75 }],
  'categories:accessibility': ['error', { minScore: 0.98 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 1 }],

  'largest-contentful-paint': ['error', { maxNumericValue: 6000 }],
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

module.exports = {
  ASSERTIONS,
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
    assert: { assertions: ASSERTIONS },
  },
};
