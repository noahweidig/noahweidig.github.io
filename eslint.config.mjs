import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "_site/**",
      "_freeze/**",
      ".quarto/**",
      "node_modules/**",
      // Vendored: Quarto extensions and third-party bundles are upstream code
      // this repo does not write and must not reformat.
      "_extensions/**",
      "scripts/vendor/**",
      "assets/**/*.min.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser code: ES5-flavoured on purpose (the site ships it unbundled and
    // untranspiled), so `var` stays allowed while the globals are the
    // browser's.
    files: ["assets/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-implicit-globals": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Build tooling: ES modules, Node globals.
    files: ["scripts/**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Runs inside the page, not the runner: `axe` is injected by Puppeteer
    // before the evaluate call.
    files: ["scripts/axe-audit.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser, axe: "readonly" } },
  },
  {
    // CommonJS config files loaded by their own tools.
    files: ["*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    // These are loaded by Lighthouse CI and html-validate, which require()
    // them — CommonJS is the contract, not a leftover.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
