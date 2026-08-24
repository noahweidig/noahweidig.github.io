/**
 * brand-art.ts — the pieces the two card generators share.
 *
 * scripts/generate-og.ts (Open Graph cards, at render time) and
 * scripts/generate-post-covers.ts (blog cover art, by hand) draw different
 * cards from the same ingredients: the brand palette, the site's own
 * topographic texture, a word-wrap estimate for Inter, and the vendored
 * resvg/Inter rasterizer. Those live here so neither script owns a copy.
 *
 * No side effects on import — nothing is read or initialised until called.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { projectRoot } from "./site-output.ts";

/** Brand palette. Card text is white by design: the gradient is saturated,
 *  so anything else loses legibility at thumbnail size. */
export const BRAND = {
  gradFrom: "#efa30d", // amber
  gradMid: "#c22fc7", // magenta
  gradTo: "#15a473", // teal
  contour: "#1b2430", // topo line ink, drawn at low opacity
  fg: "#ffffff",
  accent: "#ffffff",
};

/** The face family name both scripts set on their <text> elements. */
export const FONT = "Inter";

const vendorDir = path.join(projectRoot, "scripts", "vendor");

export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Greedy word wrap using an average-glyph-width estimate for Inter. */
export function wrap(
  text: string,
  fontSize: number,
  widthFactor: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * widthFactor)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/**
 * The topographic texture is the site's own artwork
 * (assets/media/topography.svg, the same tile theme.scss masks behind cards
 * and the footer), returned as a path to tile as an SVG pattern rather than
 * redrawn.
 */
export function topoPath(): string {
  const svg = fs.readFileSync(path.join(projectRoot, "assets", "media", "topography.svg"), "utf8");
  const d = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!d) throw new Error("[brand-art] no path found in assets/media/topography.svg");
  return d[1];
}

// deno-lint-ignore no-explicit-any
let Resvg: any;

/**
 * Boot the vendored resvg WebAssembly build and hand back the Inter faces to
 * pass to `rasterize`. resvg does not read WOFF2 and matches faces by
 * `usWeightClass`, hence the static 400/800 TTFs under scripts/vendor.
 */
export async function initRasterizer(): Promise<Uint8Array[]> {
  const mod = await import(pathToFileURL(path.join(vendorDir, "resvg", "resvg.mjs")).href);
  const wasm = zlib.gunzipSync(fs.readFileSync(path.join(vendorDir, "resvg", "resvg.wasm.gz")));
  await mod.initWasm(wasm);
  Resvg = mod.Resvg;
  return [
    new Uint8Array(fs.readFileSync(path.join(vendorDir, "fonts", "inter-400.ttf"))),
    new Uint8Array(fs.readFileSync(path.join(vendorDir, "fonts", "inter-800.ttf"))),
  ];
}

/** Render an SVG string to PNG bytes at `width` px. */
export function rasterize(svg: string, fontBuffers: Uint8Array[], width: number): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      fontBuffers,
      defaultFontFamily: { sansSerif: FONT },
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
}
