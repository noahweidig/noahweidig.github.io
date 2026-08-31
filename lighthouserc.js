const fs = require("node:fs");
const path = require("node:path");

const DIST = "./_site";

// One detail page per section, so the templates that only ever appear on a
// child page (project lightbox gallery, generated publication markup, blog
// code blocks) get scored too. The slugs move — publication directories are
// regenerated from Zotero by scripts/update-pubs.js — so pick one at collect
// time rather than hard-coding a name a future sync could delete.
function firstDetailPage(section) {
  const dir = path.join(DIST, section);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const slug = entries
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "index.html")))
    .map((e) => e.name)
    .sort()[0];
  return slug ? [`${section}/${slug}/index.html`] : [];
}

// Thresholds and budgets measured from this site as it stands (the numbers
// in the table below are the worst of three Lighthouse runs per URL, from the
// first run of this config). They are ceilings and floors, not targets: each
// sits just past today's worst case so the current site passes and any
// regression fails. Ratchet them tighter as #187 (render-blocking bundle) and
// #188 (icon font) land — that is the mechanism that keeps a fix fixed.
//
//   page                    perf   script     font     total
//   /                       0.74
//   /cv                     0.75
//   /projects               0.72
//   /publications           0.75
//   /blog                   0.73
//   /projects/chartifyr     0.74
//   /publications/…-25      0.76
//   /blog/favorite-r-…      0.38   1.30 MB  671 KB   15.2 MB
//
// Accessibility clears 0.9 everywhere, so that one keeps its intended bar.
const KB = 1024;

function assertions({ performance, bestPractices, seo, script, font, total }) {
  return {
    "categories:performance": ["error", { minScore: performance }],
    "categories:accessibility": ["error", { minScore: 0.9 }],
    "categories:best-practices": ["error", { minScore: bestPractices }],
    "categories:seo": ["error", { minScore: seo }],
    "resource-summary:document:size": ["error", { maxNumericValue: 150 * KB }],
    "resource-summary:script:size": ["error", { maxNumericValue: script }],
    "resource-summary:font:size": ["error", { maxNumericValue: font }],
    "resource-summary:total:size": ["error", { maxNumericValue: total }],
  };
}

// Every page except a blog post.
const ASSERTIONS = assertions({
  performance: 0.7,
  bestPractices: 0.9,
  seo: 0.9,
  script: 700 * KB,
  font: 500 * KB,
  total: 3000 * KB,
});

// Blog posts carry full-width imagery and the code-block fonts, so one of
// them (favorite-r-packages) is far heavier than anything else on the site:
// 15 MB total against 3 MB elsewhere, and a 0.38 performance score. Holding
// the whole site to that number would make the gate meaningless everywhere
// else, so posts get their own floor — still enforced, just set where they
// actually are today.
const POST_ASSERTIONS = assertions({
  performance: 0.33,
  bestPractices: 0.85,
  seo: 0.84,
  script: 1400 * KB,
  font: 700 * KB,
  total: 16000 * KB,
});

// A URL matching several patterns has to satisfy all of them, so the default
// pattern excludes what the post pattern covers rather than overlapping it.
const POST_URL = ".*/blog/[^/]+/index\\.html$";
const NON_POST_URL = "^(?!.*/blog/[^/]+/index\\.html$).*$";

module.exports = {
  ASSERTIONS,
  ci: {
    collect: {
      staticDistDir: DIST,
      url: [
        "index.html",
        "cv.html",
        "projects/index.html",
        "publications/index.html",
        "blog/index.html",
        // One URL that exercises every component and token (#222): a
        // contrast or a11y regression in any component shows up here
        // regardless of which page it ships on.
        "styleguide.html",
        ...firstDetailPage("projects"),
        ...firstDetailPage("publications"),
        ...firstDetailPage("blog"),
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
    assert: {
      // Promoted from `warn` to `error` (#256): an advisory gate is not a
      // gate, and the regressions #187/#188/#205 describe all produced a
      // green check.
      assertMatrix: [
        { matchingUrlPattern: NON_POST_URL, assertions: ASSERTIONS },
        { matchingUrlPattern: POST_URL, assertions: POST_ASSERTIONS },
      ],
    },
  },
};
