const path = require('node:path');

const url = (p) => `http://localhost/${p}`;

// Lighthouse CI over the built site, run per-PR by the `lhci` job in publish.yml.
// Thresholds sit just past the worst URL measured on the CI runner (2026-09-03);
// tighten as the site gets faster, never loosen without saying why in the commit.
// Performance and LCP carry headroom because they move with the shared runner.
// LHCI's static server sends no compression, so CI scores sit below production.
//
// The homepage gets looser performance/LCP: its LCP element is the hero portrait
// (above the copy on mobile), and the cost is render delay from the render-blocking
// stylesheet and font preloads, not the 8 KB image. Inlining critical CSS would
// earn the tighter numbers back.
const ASSERTIONS = {
  'categories:performance': ['error', { minScore: 0.8 }],
  'categories:accessibility': ['error', { minScore: 0.98 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 4500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
};

const HOMEPAGE_ASSERTIONS = {
  ...ASSERTIONS,
  'categories:performance': ['error', { minScore: 0.75 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 6000 }],
};

/* lhci applies every matrix entry whose pattern matches, so the second entry
   must exclude the homepage rather than merely come later. */
const assertMatrix = (pattern) => [
  { matchingUrlPattern: pattern, assertions: HOMEPAGE_ASSERTIONS },
  {
    matchingUrlPattern: `^(?!${pattern.replace(/^\^/, '')})`,
    assertions: ASSERTIONS,
  },
];

module.exports = {
  ASSERTIONS,
  HOMEPAGE_ASSERTIONS,
  assertMatrix,
  ci: {
    collect: {
      staticDistDir: path.resolve(__dirname, 'dist'),
      url: [
        url('index.html'),
        url('cv/index.html'),
        url('projects/index.html'),
        url('publications/index.html'),
        url('contact/index.html'),
        url('projects/chartifyr/index.html'),
        url('publications/alexander-shifting-forest-25/index.html'),
      ],
    },
    upload: { target: 'temporary-public-storage' },
    assert: { assertMatrix: assertMatrix('^https?://[^/]+/index\\.html$') },
  },
};
