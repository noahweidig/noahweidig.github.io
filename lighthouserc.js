module.exports = {
  ci: {
    collect: {
      staticDistDir: "./_site",
      url: ["index.html"],
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
