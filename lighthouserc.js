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
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        // Quarto/GitHub Pages specifics we don't control or don't care about.
        "canonical": "off",
        "csp-xss": "off",
        "uses-http2": "off",
      },
    },
  },
};
