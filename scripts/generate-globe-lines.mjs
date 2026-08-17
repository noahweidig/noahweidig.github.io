// Precomputes country border polylines for the contact-section globe
// (assets/globe.js) so the browser never has to download the ~700 KB
// world-atlas TopoJSON or decode arcs at page load.
//
//   node scripts/generate-globe-lines.mjs [path/to/countries-110m.json]
//
// With no argument it fetches world-atlas 110m from jsDelivr. Output is
// assets/data/globe-lines.json: { "lines": [[lat, lon, lat, lon, ...], ...] },
// one flat, rounded-to-one-decimal array per ring. Dependency-free: the
// minimal TopoJSON decoding is inlined below rather than pulled in from
// topojson-client.

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ── minimal TopoJSON decoding ────────────────────────────────────────────────

function decodeArcs(topo) {
  const { scale = [1, 1], translate = [0, 0] } = topo.transform ?? {};
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

function ringCoords(arcIndexes, arcs) {
  const ring = [];
  for (const index of arcIndexes) {
    const arc = index >= 0 ? arcs[index] : arcs[~index].slice().reverse();
    // arcs share their endpoint with the next arc's start point
    ring.push(...(ring.length ? arc.slice(1) : arc));
  }
  return ring;
}

/** Every country geometry's outer + hole rings, flattened into one list. */
function allRings(topo) {
  const arcs = decodeArcs(topo);
  const rings = [];
  for (const geom of topo.objects.countries.geometries) {
    if (geom.type === "Polygon") {
      for (const r of geom.arcs) rings.push(ringCoords(r, arcs));
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.arcs) {
        for (const r of poly) rings.push(ringCoords(r, arcs));
      }
    }
  }
  return rings;
}

// ── main ─────────────────────────────────────────────────────────────────────

// Local CLI tool run by hand, but the optional path argument still gets
// validated before it touches the filesystem: resolved to an absolute path,
// confirmed to stay within the current working directory (rejecting any
// `..` traversal out of it), and required to exist as a plain .json file —
// so a stray or malformed argument fails fast with a clear error instead of
// an arbitrary path read.
function readTopoJsonArg(arg) {
  const base = resolve(process.cwd()) + sep;
  const path = resolve(process.cwd(), arg);
  if (!path.startsWith(base)) {
    throw new Error(`Path escapes the working directory: ${path}`);
  }
  if (extname(path) !== ".json") {
    throw new Error(`Expected a .json file, got: ${path}`);
  }
  const stats = statSync(path);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const topo = process.argv[2]
  ? readTopoJsonArg(process.argv[2])
  : await (await fetch(SOURCE)).json();

const rings = allRings(topo);
const lines = rings.map((ring) => {
  const flat = [];
  for (const [lon, lat] of ring) {
    flat.push(Math.round(lat * 10) / 10, Math.round(lon * 10) / 10);
  }
  return flat;
});

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets", "data", "globe-lines.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ lines }));
console.log(`wrote ${lines.length} rings to ${out}`);
