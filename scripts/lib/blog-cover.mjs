/**
 * Cover art for blog posts and share cards: the width-poster look. A flat
 * cobalt field, a wide sun-yellow label, the title in giant condensed
 * capitals, and a sun band along the bottom with the name and domain.
 * `mode` picks the field: "light" is cobalt, "dark" is the deeper blue.
 *
 * Pure string output: generate-blog-covers.mjs screenshots it. The Archivo
 * @font-face rules come in as `fontCss`.
 */

const W = 1200;
const H = 675;
const BAND = 92;

const FIELD = { light: '#1f3bff', dark: '#0a1480' };
const ICE = '#f2f4ff';
const SUN = '#ffd21f';
const DEEP = '#0a1480';

export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.codePointAt(i);
  return h >>> 0;
}

function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// Condensed capitals run about 0.42em per letter, so the size steps down with
// length to keep the title inside two or three lines.
function titleSize(title) {
  const n = title.length;
  if (n <= 14) return 210;
  if (n <= 24) return 164;
  if (n <= 36) return 132;
  if (n <= 52) return 108;
  return 88;
}

export function coverHtml({ title, kicker, mode = 'light', fontCss }) {
  const field = FIELD[mode] ?? FIELD.light;
  return `<!doctype html><meta charset="utf-8"><style>${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;background:${field};color:${ICE};font-family:'Archivo',ui-sans-serif,system-ui,sans-serif}
.k{position:absolute;left:84px;top:72px;font-size:26px;font-weight:700;font-variation-settings:'wdth' 125,'wght' 700;letter-spacing:.1em;text-transform:uppercase;color:${SUN}}
.t{position:absolute;left:80px;right:80px;bottom:${BAND + 56}px;font-weight:900;font-variation-settings:'wdth' 62,'wght' 900;font-size:${titleSize(title)}px;line-height:.88;text-transform:uppercase;letter-spacing:-.005em;text-wrap:balance}
.b{position:absolute;left:0;right:0;bottom:0;height:${BAND}px;background:${SUN};color:${DEEP};display:flex;align-items:center;justify-content:space-between;padding:0 84px}
.n{font-size:46px;font-weight:900;font-variation-settings:'wdth' 62,'wght' 900;text-transform:uppercase}
.d{font-size:22px;font-weight:700;font-variation-settings:'wdth' 125,'wght' 700;letter-spacing:.08em;text-transform:uppercase}
</style><body>
<div class="k">${escapeHtml(kicker)}</div><div class="t">${escapeHtml(title)}</div>
<div class="b"><span class="n">Noah Weidig</span><span class="d">noahweidig.com</span></div></body>`;
}
