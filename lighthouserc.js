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

module.exports = {
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
      // No preset: only the four category scores are checked, and only as
      // warnings, so PRs get visible Lighthouse scores without the build
      // failing on pre-existing site issues that are out of scope for
      // whatever the PR itself changes.
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
  },
};
