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

// Resource budgets, in bytes. These are ceilings, not targets: each sits
// just above the site's current worst case (the 528 KB render-blocking
// bundle of #187, the 273 KB icon font of #188) so today's build passes and
// any *new* weight fails. Ratchet them down as those issues land — that is
// the mechanism that keeps a fix fixed.
const BUDGETS = {
  document: 150 * 1024,
  script: 700 * 1024,
  stylesheet: 700 * 1024,
  font: 500 * 1024,
  image: 1500 * 1024,
  total: 3000 * 1024,
};

const ASSERTIONS = {
  "categories:performance": ["error", { minScore: 0.8 }],
  "categories:accessibility": ["error", { minScore: 0.9 }],
  "categories:best-practices": ["error", { minScore: 0.9 }],
  "categories:seo": ["error", { minScore: 0.9 }],
  ...Object.fromEntries(
    Object.entries(BUDGETS).map(([type, maxNumericValue]) => [
      `resource-summary:${type}:size`,
      ["error", { maxNumericValue }],
    ])
  ),
};

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
      // green check. Exported below so lighthouserc.production.js holds the
      // live site to the same bar.
      assertions: ASSERTIONS,
    },
  },
};
