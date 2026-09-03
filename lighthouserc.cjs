// Lighthouse CI over the built site, run per-PR by
// .github/workflows/lighthouse.yml. lighthouserc.production.cjs imports
// ASSERTIONS from here so production is held to the same bar as a PR.

const ASSERTIONS = {
  'categories:performance': ['error', { minScore: 0.9 }],
  'categories:accessibility': ['error', { minScore: 0.95 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 0.95 }],

  // Core Web Vitals, held at the "good" thresholds.
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['error', { maxNumericValue: 200 }],

  // Advisory: these fire on third-party embeds (Giscus, GA4) the build does
  // not control, so they report without failing the run.
  'unused-javascript': 'off',
  'third-party-cookies': 'off',
  'uses-long-cache-ttl': 'off',
  'legacy-javascript': 'off',
  // Astro emits one module script per island; the audit counts them as
  // render-blocking even though every one carries `type="module"`.
  'render-blocking-resources': 'warn',
};

module.exports = {
  ASSERTIONS,
  ci: {
    collect: {
      staticDistDir: './dist',
      url: [
        'http://localhost/index.html',
        'http://localhost/cv/index.html',
        'http://localhost/projects/index.html',
        'http://localhost/publications/index.html',
        'http://localhost/blog/index.html',
        'http://localhost/blog/focus/index.html',
        'http://localhost/contact/index.html',
        'http://localhost/styleguide/index.html',
      ],
    },
    upload: { target: 'temporary-public-storage' },
    assert: { assertions: ASSERTIONS },
  },
};
