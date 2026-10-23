/**
 * Lucide icons scattered around the home hero's text. They are placed by dart
 * throwing against the text's live boxes (title lines, intro, buttons, socials),
 * so an icon can never land behind text, at any width. The same seed gives the
 * same scatter for the same layout. Icons fade out toward the page edges and
 * the hero's top and bottom. Bound from `boot()` on every `astro:page-load`.
 */
import { cleanups } from './dom';

type Box = { l: number; t: number; r: number; b: number };

const SEED = 20251023;
const SIZES = [28, 32, 36, 40, 44, 52, 60, 68, 76];
const TONES = ['blue', 'blue', 'blue', 'green', 'green', 'red', 'yellow', 'yellow'];
const ALPHAS = [0.3, 0.42, 0.55, 0.7, 0.85, 0.95];
const TEXT_GAP = 14;
const ICON_GAP = 16;
const MARGIN = 8;

const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hits = (a: Box, b: Box, gap = 0) =>
  a.l < b.r + gap && a.r > b.l - gap && a.t < b.b + gap && a.b > b.t - gap;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** How far a text box is still sliding in from `data-reveal`'s translateY. */
const slide = (el: Element) => {
  const host = el.closest('[data-reveal]');
  return host ? new DOMMatrix(getComputedStyle(host).transform).m42 : 0;
};

export function initHeroIcons() {
  const host = document.querySelector<HTMLElement>('[data-hero-icons]');
  const hero = host?.parentElement;
  if (!host || !hero) return;
  const names = [...host.querySelectorAll<SVGSymbolElement>('symbol')].map((s) =>
    s.id.replace(/^i-/, ''),
  );
  if (!names.length) return;

  const place = () => {
    const h = hero.getBoundingClientRect();
    const W = h.width;
    const H = h.height;
    if (W < 1 || H < 1) return;
    const scale = Math.min(1.1, Math.max(0.6, W / 1200));
    const band = matchMedia('(min-width: 48rem)').matches ? 72 : 64;
    const gap = TEXT_GAP * scale;

    const obstacles: Box[] = [];
    const add = (r: DOMRect, dy: number) => {
      if (r.width < 1 || r.height < 1) return;
      obstacles.push({
        l: r.left - h.left - gap,
        t: r.top - h.top - dy - gap,
        r: r.right - h.left + gap,
        b: r.bottom - h.top - dy + gap,
      });
    };
    hero.querySelectorAll('.hero-line, .lede').forEach((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const dy = slide(el);
      [...range.getClientRects()].forEach((r) => add(r, dy));
    });
    hero.querySelectorAll('.hero-btn, .social').forEach((el) => {
      add(el.getBoundingClientRect(), slide(el));
    });

    const free = W * (H - band) - obstacles.reduce((n, o) => n + (o.r - o.l) * (o.b - o.t), 0);
    const target = Math.min(names.length, Math.max(8, Math.round(free / (28000 * scale * scale))));

    const rand = mulberry32(SEED);
    const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
    const order = names
      .map((n) => [rand(), n] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, n]) => n);
    const placed: Box[] = [];
    const nodes: HTMLElement[] = [];
    const big = SIZES.filter((s) => s >= 48);

    for (let i = 0; i < 7000 && placed.length < target; i++) {
      const size = Math.max(18, Math.round((i < 2000 ? pick(big) : pick(SIZES)) * scale));
      const rot = (rand() - 0.5) * 36;
      const rad = (rot * Math.PI) / 180;
      const span = size * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
      const cx = MARGIN + span / 2 + rand() * (W - span - MARGIN * 2);
      const cy = band + MARGIN + span / 2 + rand() * (H - band - span - MARGIN * 2);
      const box = { l: cx - span / 2, t: cy - span / 2, r: cx + span / 2, b: cy + span / 2 };
      if (obstacles.some((o) => hits(box, o))) continue;
      if (placed.some((p) => hits(box, p, ICON_GAP * scale))) continue;
      placed.push(box);

      /* More see-through toward the page edges and the hero's top and bottom. */
      const edgeX = Math.min(cx, W - cx) / (W * 0.18);
      const edgeY = Math.min(cy - band, H - cy) / ((H - band) * 0.22);
      const fade = 0.12 + 0.88 * smooth(Math.min(edgeX, edgeY));
      const name = order[nodes.length]!;
      const el = document.createElement('span');
      el.className = `hi hi-${pick(TONES)}`;
      el.style.cssText =
        `left:${(cx - size / 2).toFixed(1)}px;top:${(cy - size / 2).toFixed(1)}px;` +
        `width:${size}px;height:${size}px;rotate:${rot.toFixed(1)}deg;` +
        `opacity:${(pick(ALPHAS) * fade).toFixed(2)}`;
      el.innerHTML =
        `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" ` +
        `stroke-width="${((1.75 * 24) / size).toFixed(2)}" stroke-linecap="round" ` +
        `stroke-linejoin="round" focusable="false"><use href="#i-${name}"/></svg>`;
      nodes.push(el);
    }

    host.querySelectorAll('.hi').forEach((n) => n.remove());
    host.append(...nodes);
    host.dataset.ready = '';
  };

  let raf = 0;
  const queue = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  };
  const ro = new ResizeObserver(queue);
  ro.observe(hero);
  void document.fonts?.ready.then(queue);
  cleanups.push(() => {
    ro.disconnect();
    cancelAnimationFrame(raf);
  });
}
