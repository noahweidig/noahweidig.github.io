/**
 * Blog cover art: a seeded halftone dot field over the site's hero colour
 * mesh. Each post gets its own palette and its own dot layout (the slug seeds
 * the noise), so covers read as one family without repeating.
 *
 * Pure string output: generate-blog-covers.mjs screenshots it, and
 * ensure-blog-covers.mjs reads paletteFor() to write the alt text.
 */

const W = 1200;
const H = 675;

// Hero hues from global.css (--hero-1..5) plus a few vivid extras that only
// the covers use. Light row is the same hex unless a darker step is needed to
// stay visible on the off-white ground.
const HUES = {
  dark: {
    violet: '#7c5cff',
    blue: '#1f7bff',
    pink: '#e0457b',
    ember: '#ff8a4c',
    sky: '#38b6ff',
    moss: '#4bd0a0',
    lime: '#c6f432',
    amber: '#ffc933',
    teal: '#14e0c8',
    magenta: '#ff3df0',
    red: '#ff4d4d',
  },
  light: {
    violet: '#7c5cff',
    blue: '#1f7bff',
    pink: '#e0457b',
    ember: '#ff8a4c',
    sky: '#0ea5e9',
    moss: '#0f9f72',
    lime: '#6aa500',
    amber: '#d98a00',
    teal: '#0aa898',
    magenta: '#d41cc4',
    red: '#e02f2f',
  },
};

// Glow fields share one layout; a palette only picks the three hues.
// `dots` is the colour of the dense dot clusters, `alt` is what
// ensure-blog-covers.mjs writes into the post's image-alt.
const BLOB_LAYOUT = [
  [85, 20, 70],
  [60, 95, 55],
  [100, 100, 50],
];
const palette = (id, hues, dots, alt) => ({
  id,
  dots,
  alt,
  blobs: hues.map((hue, i) => [hue, ...BLOB_LAYOUT[i]]),
});

const PALETTES = [
  palette('violet-cyan', ['violet', 'sky', 'magenta'], 'sky', 'violet and cyan'),
  palette('lime-teal', ['teal', 'moss', 'blue'], 'lime', 'lime and teal'),
  palette('sunset', ['ember', 'pink', 'amber'], 'amber', 'amber and ember'),
  palette('magenta-ember', ['magenta', 'ember', 'violet'], 'magenta', 'magenta and ember'),
  palette('ocean', ['blue', 'teal', 'violet'], 'teal', 'blue and teal'),
  palette('rose', ['pink', 'violet', 'ember'], 'red', 'rose and violet'),
];

// Existing posts pin a palette so each looks different from the others.
// Anything not listed falls back to the slug hash.
const PINNED = {
  'favorite-r-packages': 'violet-cyan',
  welcome: 'lime-teal',
  focus: 'sunset',
  'astro-portfolio': 'magenta-ember',
};

export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.codePointAt(i);
  return h >>> 0;
}

export function paletteFor(slug) {
  const pinned = PALETTES.find((p) => p.id === PINNED[slug]);
  return pinned ?? PALETTES[hash(slug) % PALETTES.length];
}

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function makeNoise(seed) {
  const r = rng(seed);
  const P = Array.from({ length: 256 }, () => r());
  const g = (x, y) => P[(((x * 374761393 + y * 668265263) >>> 0) ^ (seed * 97)) & 255];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = sm(x - xi);
    const yf = sm(y - yi);
    const a = g(xi, yi);
    const b = g(xi + 1, yi);
    const c = g(xi, yi + 1);
    const d = g(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => n(x, y) * 0.55 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.15;
}

const GAP = 17;
const THRESHOLD = 0.3;
const HOT = 0.62;
// Dots thin out toward the left so the title keeps a clear ground.
const falloff = (x) => Math.min(1, Math.max(0, (x / W) * 1.5 - 0.15));

function dotsSvg(slug, dotColor, ink, dark) {
  const seed = hash(slug);
  const noise = makeNoise(seed);
  const r = rng(seed * 7919);
  const scale = 210 + r() * 50;
  const jitter = 0.7 + r() * 0.6;
  const val = (x, y, ox, oy) => noise(x / scale + ox, y / scale + oy);

  // Pick a noise offset whose field fills 10-17% of the lattice: enough dots
  // to read as a texture, few enough that the cover isn't blotchy.
  const coverage = (ox, oy) => {
    let drawn = 0;
    let total = 0;
    for (let y = GAP / 2; y < H; y += GAP)
      for (let x = GAP / 2; x < W; x += GAP) {
        total += 1;
        if ((val(x, y, ox, oy) - THRESHOLD) * 9 * (0.25 + falloff(x)) >= 0.4) drawn += 1;
      }
    return drawn / total;
  };
  let ox = 0;
  let oy = 0;
  for (let tries = 0; tries < 80; tries += 1) {
    ox = r() * 60;
    oy = r() * 60;
    const c = coverage(ox, oy);
    if (c >= 0.1 && c <= 0.17) break;
  }

  let out = '';
  for (let y = GAP / 2; y < H; y += GAP)
    for (let x = GAP / 2 + ((Math.round(y / GAP) % 2) * GAP) / 2; x < W; x += GAP) {
      const px = x + (r() - 0.5) * jitter * 2;
      const py = y + (r() - 0.5) * jitter * 2;
      const nv = val(px, py, ox, oy);
      const rad = Math.max(0, (nv - THRESHOLD) * 9 * (0.25 + falloff(px)));
      if (rad < 0.4) continue;
      const hot = nv > HOT;
      out += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rad.toFixed(2)}" fill="${hot ? dotColor : ink}" fill-opacity="${hot ? 0.9 : dark ? 0.45 : 0.4}"/>`;
    }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">${out}</svg>`;
}

function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function coverHtml({ title, kicker, mode, slug, fontCss }) {
  const dark = mode === 'dark';
  const hues = HUES[mode];
  const palette = paletteFor(slug);
  const dotColor = hues[palette.dots];
  const bg = dark ? '#05060a' : '#fbfaf7';
  const ink = dark ? '#e9ecf2' : '#14161c';
  const dim = dark ? '#c3c9d6' : '#2e3340';
  const faint = dark ? '#a7afbe' : '#43495a';
  const blobs = palette.blobs
    .map(
      ([c, x, y, s]) =>
        `<div class="b" style="left:${x}%;top:${y}%;width:${s}%;aspect-ratio:1;background:radial-gradient(closest-side,${hues[c]} 0%,${hues[c]}99 25%,${hues[c]}40 55%,transparent 92%)"></div>`,
    )
    .join('');
  const size = title.length > 24 ? 68 : title.length > 12 ? 84 : 112;

  return `<!doctype html><meta charset="utf-8"><style>${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;background:${bg};font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif}
.mesh{position:absolute;inset:0;overflow:hidden;opacity:${dark ? 0.55 : 0.3}}
.b{position:absolute;transform:translate(-50%,-50%);border-radius:50%;mix-blend-mode:${dark ? 'screen' : 'normal'}}
.scrim{position:absolute;inset:0;background:radial-gradient(90% 70% at 22% 72%,${bg} 0%,${bg}b0 38%,transparent 78%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,${ink} 1px,transparent 1px),linear-gradient(to bottom,${ink} 1px,transparent 1px);background-size:60px 60px;opacity:.05;mask-image:radial-gradient(ellipse 90% 70% at 70% 20%,#000 10%,transparent 80%)}
.c{position:relative;height:100%;padding:60px 76px;display:flex;flex-direction:column;justify-content:space-between}
.k{font:600 26px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:${dim};display:flex;align-items:center;gap:14px}
.k i{width:12px;height:12px;border-radius:50%;background:${dotColor}}
.t{font-weight:700;font-size:${size}px;line-height:1.04;letter-spacing:-.02em;color:${ink};max-width:760px}
.f{font:500 24px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.02em;color:${faint}}
</style><body><div class="mesh">${blobs}</div>${dotsSvg(slug, dotColor, dark ? '#ffffff' : ink, dark)}<div class="grid"></div><div class="scrim"></div>
<div class="c"><div class="k"><i></i>${escapeHtml(kicker)}</div><div class="t">${escapeHtml(title)}</div><div class="f">noahweidig.com</div></div></body>`;
}
