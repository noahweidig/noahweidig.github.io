// Generates the decorative globe in the homepage CTA as a static inline SVG.
//
//   node scripts/generate-globe-svg.mjs [path/to/countries-110m.json]
//
// The globe never moves: one fixed rotation with Orlando facing the camera,
// one fixed crop. So there is nothing for the browser to compute — the whole
// picture is projected here, at build time, and written into index.qmd
// between the <!-- globe:start --> / <!-- globe:end --> markers as plain
// SVG path data. That replaces a 106 KB JSON fetch plus 263 lines of canvas
// JS with markup that costs nothing at runtime and themes itself through the
// same CSS variables the rest of the page uses (#257).
//
// With no argument it fetches world-atlas 110m from jsDelivr. Dependency-
// free: the minimal TopoJSON decoding is inlined below rather than pulled in
// from topojson-client.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ── projection geometry (mirrors the crop the canvas version drew) ──────────

const VIEW = 1000; // viewBox side; the card scales this to its own width
const RADIUS = VIEW * 0.625;
const CX = VIEW * 0.5;
const CY = VIEW * 0.72; // Orlando sits below center — a close-up, not a globe
const TILT = 0.35;
const ORLANDO = { lat: 28.5384, lon: -81.3789 };
const GRATICULE_STEP = 20; // degrees between meridians/parallels

// Everything past this box is cropped away by the card, so it is dropped
// rather than written out. The margin keeps the split points off-canvas.
const MARGIN = 40;
// Douglas–Peucker tolerance, in viewBox units. The card renders ~480 px wide,
// so one unit is about half a device pixel: 1.5 is well under what a stroke
// 2.2 units wide can show.
const TOLERANCE = 1.5;
// Subpaths smaller than this (bounding-box diagonal) are specks — islands a
// couple of pixels across that read as noise at this size.
const MIN_EXTENT = 6;

function toSphere(lat, lon) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((180 - lon) * Math.PI) / 180;
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.cos(phi),
    z: Math.sin(phi) * Math.sin(theta),
  };
}

const marker = toSphere(ORLANDO.lat, ORLANDO.lon);
// Rotate about Y so Orlando's azimuth lands front-center, then tilt.
const ROT_Y = -Math.atan2(marker.x, marker.z);
const cosX = Math.cos(TILT), sinX = Math.sin(TILT);
const cosY = Math.cos(ROT_Y), sinY = Math.sin(ROT_Y);

/** Unit-sphere point → canvas space. `z > 0` is the near (visible) side. */
function project(p) {
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;
  return { x: CX + x1 * RADIUS, y: CY - y2 * RADIUS, z: z2 };
}

// ── polyline reduction ──────────────────────────────────────────────────────

/**
 * Splits a ring of lat/lon pairs into the runs of it that are both on the
 * visible hemisphere and inside the cropped box.
 */
function visibleRuns(ring) {
  const runs = [];
  let run = [];
  for (const [lat, lon] of ring) {
    const p = project(toSphere(lat, lon));
    const inside =
      p.z > 0 &&
      p.x >= -MARGIN &&
      p.x <= VIEW + MARGIN &&
      p.y >= -MARGIN &&
      p.y <= VIEW + MARGIN;
    if (inside) {
      run.push(p);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Douglas–Peucker, iterative so a long coastline can't blow the stack. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first];
    const b = points[last];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      const d = len
        ? Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
        : Math.hypot(p.x - a.x, p.y - a.y);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function extent(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/** One simplified run of points → an `M x y L x y …` subpath, or "". */
function toSubpath(points) {
  let d = "";
  let prevX = null;
  let prevY = null;
  for (const p of points) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x === prevX && y === prevY) continue; // rounding collapsed it
    d += (d ? "L" : "M") + x + " " + y;
    prevX = x;
    prevY = y;
  }
  return d.includes("L") ? d : "";
}

/** Rings of lat/lon pairs → one `d` attribute, integer-rounded. */
function toPathData(rings) {
  const parts = [];
  for (const ring of rings) {
    for (const run of visibleRuns(ring)) {
      const points = simplify(run, TOLERANCE);
      if (points.length < 2 || extent(points) < MIN_EXTENT) continue;
      const d = toSubpath(points);
      if (d) parts.push(d);
    }
  }
  return parts.join("");
}

// ── minimal TopoJSON decoding ───────────────────────────────────────────────

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
  // world-atlas is [lon, lat]; everything downstream wants [lat, lon]
  return ring.map(([lon, lat]) => [lat, lon]);
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

// Meridians and parallels every GRATICULE_STEP°, as lat/lon rings — the same
// shape d3.geoGraticule() draws, computed by hand so no library is needed.
function graticuleRings() {
  const rings = [];
  for (let lon = -180; lon < 180; lon += GRATICULE_STEP) {
    const meridian = [];
    for (let lat = -90; lat <= 90; lat += 5) meridian.push([lat, lon]);
    rings.push(meridian);
  }
  for (let lat = -80; lat <= 80; lat += GRATICULE_STEP) {
    const parallel = [];
    for (let lon = -180; lon <= 180; lon += 5) parallel.push([lat, lon]);
    rings.push(parallel);
  }
  return rings;
}

// ── main ────────────────────────────────────────────────────────────────────

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
  if (!statSync(path).isFile()) {
    throw new Error(`Not a file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const topo = process.argv[2]
  ? readTopoJsonArg(process.argv[2])
  : await (await fetch(SOURCE)).json();

const borders = toPathData(allRings(topo));
const graticule = toPathData(graticuleRings());
const m = project(marker);
const mx = Math.round(m.x);
const my = Math.round(m.y);
const r = Math.round(VIEW * 0.011);

// Colors come from the theme's own custom properties, so the light and dark
// sheets keep driving the globe exactly as they did when it was a canvas.
// The Orlando marker stays the site's accent blue in both.
const svg = [
  `<svg id="nw-globe" viewBox="0 0 ${VIEW} ${VIEW}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`,
  `<circle cx="${CX}" cy="${CY}" r="${RADIUS}" fill="var(--nw-bg)"/>`,
  `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="${graticule}" stroke="var(--nw-border)" stroke-width="1.8"/>`,
  `<path d="${borders}" stroke="rgb(var(--nw-globe-line))" stroke-width="2.2"/>`,
  `<circle cx="${CX}" cy="${CY}" r="${RADIUS}" stroke="var(--nw-border)" stroke-width="3"/>`,
  `</g>`,
  `<g fill="#0076df">`,
  `<circle cx="${mx}" cy="${my}" r="${r * 3}" opacity="0.08"/>`,
  `<circle cx="${mx}" cy="${my}" r="${r * 1.8}" opacity="0.15"/>`,
  `<circle cx="${mx}" cy="${my}" r="${r}" stroke="#ffffff" stroke-width="${(r * 0.4).toFixed(1)}"/>`,
  `</g>`,
  `</svg>`,
].join("");

const here = dirname(fileURLToPath(import.meta.url));
const page = join(here, "..", "index.qmd");
const START = "<!-- globe:start -->";
const END = "<!-- globe:end -->";
const html = readFileSync(page, "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from === -1 || to === -1) {
  throw new Error(`Missing ${START} / ${END} markers in ${page}`);
}

// The marker label is an HTML card pinned to Orlando. The globe is static, so
// its position is a constant too — emitted here as percentages of the frame
// rather than measured in the browser on every resize.
const label =
  `<div class="nw-globe-label" style="left:${((mx / VIEW) * 100).toFixed(2)}%;` +
  `top:${((my / VIEW) * 100).toFixed(2)}%"><b>Orlando, Florida | UTC-5</b>` +
  `<code>28.5384&deg; N, 81.3789&deg; W</code></div>`;

const block = `${START}\n          ${svg}\n          ${label}\n          `;
writeFileSync(page, html.slice(0, from) + block + html.slice(to), "utf8");
console.log(
  `wrote ${(svg.length / 1024).toFixed(1)} KB of SVG (borders ${borders.length} B, ` +
    `graticule ${graticule.length} B) into ${page}`
);
