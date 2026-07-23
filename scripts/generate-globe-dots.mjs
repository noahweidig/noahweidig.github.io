// Precomputes the land-dot grid for the contact-section dot globe
// (assets/globe.js) so the browser never has to download the ~700 KB
// world-atlas TopoJSON or run point-in-polygon tests at page load.
//
//   node scripts/generate-globe-dots.mjs [path/to/countries-110m.json]
//
// With no argument it fetches world-atlas 110m from jsDelivr. Output is
// assets/data/globe-dots.json: { "spacing": <deg>, "dots": [lat, lon, ...] }
// as a flat array rounded to one decimal. Dependency-free: the minimal
// TopoJSON → polygon decoding lives below instead of topojson-client.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPACING = 2; // degrees between sample points
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

/** Every country geometry as an array of polygons: [outerRing, ...holes] */
function allPolygons(topo) {
  const arcs = decodeArcs(topo);
  const polygons = [];
  for (const geom of topo.objects.countries.geometries) {
    if (geom.type === "Polygon") {
      polygons.push(geom.arcs.map((r) => ringCoords(r, arcs)));
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.arcs) {
        polygons.push(poly.map((r) => ringCoords(r, arcs)));
      }
    }
  }
  return polygons;
}

// ── land test ────────────────────────────────────────────────────────────────

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function onLand(lon, lat, polygons) {
  for (const [outer, ...holes] of polygons) {
    if (!pointInRing(lon, lat, outer)) continue;
    if (!holes.some((hole) => pointInRing(lon, lat, hole))) return true;
  }
  return false;
}

// ── main ─────────────────────────────────────────────────────────────────────

const topo = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : await (await fetch(SOURCE)).json();

const polygons = allPolygons(topo);
const dots = [];
for (let lat = -90; lat <= 90; lat += SPACING) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  if (cosLat < 0.05) continue; // skip the poles
  // widen the longitude step toward the poles so dot density stays even
  const lonStep = SPACING / cosLat;
  for (let lon = -180; lon <= 180; lon += lonStep) {
    if (onLand(lon, lat, polygons)) {
      dots.push(Math.round(lat * 10) / 10, Math.round(lon * 10) / 10);
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets", "data", "globe-dots.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ spacing: SPACING, dots }));
console.log(`wrote ${dots.length / 2} dots to ${out}`);
