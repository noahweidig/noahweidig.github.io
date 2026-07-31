/**
 * site-output.ts — shared helpers for the post-render scripts.
 *
 * `scripts/generate-og.ts` and `scripts/optimize-output.ts` both walk the
 * rendered site and rewrite pages in place, so they both need to know where
 * Quarto put the output and how to enumerate it. That lives here rather than
 * being written twice.
 *
 * Imported by scripts Quarto runs with its bundled Deno; also loadable under
 * `node --experimental-strip-types`.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/** Project root. Quarto sets QUARTO_PROJECT_DIR when it runs a post-render
 *  script; falling back to this file's parent keeps direct invocation working. */
export const projectRoot: string = process.env.QUARTO_PROJECT_DIR ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** The rendered site (`_site` unless the project overrides `output-dir`). */
export const outputDir: string = process.env.QUARTO_PROJECT_OUTPUT_DIR
  ? path.resolve(projectRoot, process.env.QUARTO_PROJECT_OUTPUT_DIR)
  : path.join(projectRoot, "_site");

/**
 * Every rendered page under `dir`, depth first. Quarto's own asset bundles
 * (`site_libs/`) and per-document resource folders (`*_files/`) hold library
 * HTML that is never a page, so they are skipped.
 */
export function* walkHtml(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "site_libs" || entry.name.endsWith("_files")) continue;
      yield* walkHtml(full);
    } else if (entry.name.endsWith(".html")) {
      yield full;
    }
  }
}
