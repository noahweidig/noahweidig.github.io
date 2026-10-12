/**
 * Blog cover art: the title, a rounded tag pill and three stacked to-do cards,
 * flat on the theme surface. Each post rotates through the site's accent
 * hues (the slug picks which three), so covers read as one family.
 *
 * Pure string output: generate-blog-covers.mjs screenshots it, and
 * ensure-blog-covers.mjs reads paletteFor() to write the alt text.
 */

const W = 1200;
const H = 675;

// Same hex values as the --c-* accent tokens in global.css, dark and light
// rows. Order is the rotation: a post takes three consecutive entries.
const HUES = {
  dark: {
    blue: '#6ba4ff',
    yellow: '#ffc95e',
    pink: '#ff83dd',
    green: '#68ce7e',
    violet: '#ad6ded',
    teal: '#5fc7c2',
    red: '#ff6b78',
  },
  light: {
    blue: '#0a54ba',
    yellow: '#8c5d00',
    pink: '#9d2472',
    green: '#0f6220',
    violet: '#7237ae',
    teal: '#126764',
    red: '#b8142d',
  },
};
const ORDER = Object.keys(HUES.dark);

const SURFACE = { dark: '#101216', light: '#fafafa' };
const INK = { dark: '#e9ecf2', light: '#14161a' };
const DIM = { dark: '#99a1b1', light: '#565d6b' };

// Existing posts pin their start so regenerating reproduces the committed art.
// Anything not listed falls back to the slug hash.
const PINNED = {
  'astro-portfolio': 'blue',
  'favorite-r-packages': 'green',
  focus: 'red',
  welcome: 'pink',
};

export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.codePointAt(i);
  return h >>> 0;
}

export function paletteFor(slug) {
  const start = PINNED[slug] ? ORDER.indexOf(PINNED[slug]) : hash(slug) % ORDER.length;
  const hues = [0, 1, 2].map((i) => ORDER[(start + i) % ORDER.length]);
  return { hues, alt: `${hues[0]}, ${hues[1]} and ${hues[2]}` };
}

function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// x, y, rotation: the stack sits right of the title column.
const CARDS = [
  [750, 80, 6],
  [700, 250, -4],
  [820, 400, 3],
];

export function coverHtml({ title, kicker, mode, slug, fontCss }) {
  const surface = SURFACE[mode];
  const ink = INK[mode];
  const hues = HUES[mode];
  const { hues: picks } = paletteFor(slug);
  const tint = hues[picks[0]];
  const mix = (c, p) => `color-mix(in oklab,${c} ${p}%,${surface})`;

  const cards = CARDS.map(([x, y, r], i) => {
    const fill = mix(hues[picks[i]], 22);
    return `<g transform="rotate(${r} ${x + 150} ${y + 110})"><rect x="${x}" y="${y}" width="300" height="220" rx="16" fill="${fill}" stroke="${ink}" stroke-width="3"/>
<rect x="${x + 28}" y="${y + 34}" width="26" height="26" rx="6" fill="${surface}" stroke="${ink}" stroke-width="3"/><path d="M${x + 34} ${y + 47}l6 6 11-14" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${x + 70} ${y + 47}h150" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
<path d="M${x + 28} ${y + 100}h230M${x + 28} ${y + 130}h190M${x + 28} ${y + 160}h210" stroke="${ink}" stroke-width="3" stroke-linecap="round" opacity=".5"/></g>`;
  }).join('');

  const single = !title.includes(' ') && title.length <= 12;
  const size = single ? 170 : title.length > 40 ? 76 : title.length > 28 ? 88 : 98;

  return `<!doctype html><meta charset="utf-8"><style>${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;background:${surface};color:${ink};font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif}
.k{position:absolute;left:90px;top:80px;display:inline-block;padding:.3em .85em;font-size:28px;font-weight:600;border-radius:999px;color:${tint};background:${mix(tint, 18)}}
.t{position:absolute;left:84px;bottom:110px;max-width:580px;font-weight:800;font-size:${size}px;line-height:1.02;letter-spacing:-.04em}
.f{position:absolute;left:90px;bottom:64px;font-size:24px;color:${DIM[mode]}}
</style><body><svg style="position:absolute;inset:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${cards}<path d="M680 560v56l16-14 12 28 12-6-12-26h22z" fill="${ink}" stroke="${surface}" stroke-width="3" stroke-linejoin="round"/></svg>
<div class="k">${escapeHtml(kicker)}</div><div class="t">${escapeHtml(title)}</div><div class="f">noahweidig.com</div></body>`;
}
