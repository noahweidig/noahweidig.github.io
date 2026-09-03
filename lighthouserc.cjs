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
// Measured 2026-09-03, worst case across the URL list below:
//
//   metric        worst   page                 threshold
//   performance   0.94    /                    0.90
//   accessibility 1.00    (all)                0.98
//   best-practices 0.96   (all)                0.95
//   seo           1.00    (all)                1.00
//   LCP           3006ms  /                    3200ms
//   CLS           0.000   (all)                0.05
//   TBT           0ms     (all)                200ms
//
// LCP is gated on the two custom display faces: 142 KB of woff2 sits on the
// critical path, and the headline cannot paint in Newsreader before it lands.
// Subsetting those to the weights actually used is the lever that would move
// this materially; until then 3200ms is where the site honestly is.

const ASSERTIONS = {
  'categories:performance': ['error', { minScore: 0.9 }],
  'categories:accessibility': ['error', { minScore: 0.98 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 1 }],

  'largest-contentful-paint': ['error', { maxNumericValue: 3200 }],
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
