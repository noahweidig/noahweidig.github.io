// html-validate runs over _site/**/*.html in publish.yml (#256). The point is
// structural defects in generated markup — unclosed or misnested tags,
// malformed attributes, broken references — not house style, and not Quarto's
// own <head> boilerplate, which this repo does not write and cannot change.
module.exports = {
  root: true,
  extends: ["html-validate:recommended"],
  rules: {
    // Style preferences the site and Quarto both make their own choices about.
    "attribute-boolean-style": "off",
    "attr-quotes": "off",
    "void-style": "off",
    "no-inline-style": "off",
    "no-trailing-whitespace": "off",
    "long-title": "off",
    "prefer-native-element": "off",
    "require-sri": "off",
    "no-implicit-button-type": "off",
    // Accessibility is axe's job here (axe.yml), on the rendered page.
    "wcag/h30": "off",
    "wcag/h63": "off",
    "wcag/h71": "off",
    // Quarto's own <head>, on every page: `type="text/javascript"` on its
    // scripts and a valueless `crossorigin=""` on its preconnect links.
    "script-type": "off",
    "attribute-empty-style": "off",
    // Also Quarto's: it stamps `quarto-bootstrap` and
    // `quarto-text-highlighting-styles` on one <link> per theme, so a
    // light/dark site carries each id twice. Its dark-mode toggle looks those
    // ids up, so neither can be renamed from here — this rule can only come
    // back on once Quarto stops emitting the duplicate upstream.
    "no-dup-id": "off",
  },
};
