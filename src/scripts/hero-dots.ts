/**
 * Dot grid behind each hero. Dots near the pointer swell and take a color
 * from the logo's yellow, blue and red, chosen by their angle around the
 * pointer. Redraws only while the pointer moves; static for reduced motion and
 * touch. Bound from `boot()` on every `astro:page-load`.
 */
import { cleanups, on } from './dom';

const PITCH = 24;
const RADIUS = 140;

/** Position `t` (0..1) along the stops, blended between neighbors. */
const ramp = (stops: string[], t: number) => {
  const pos = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const pct = Math.round((pos - i) * 100);
  return `color-mix(in srgb, ${stops[i]} ${100 - pct}%, ${stops[i + 1]})`;
};

export function initHeroDots() {
  const canvases = document.querySelectorAll<HTMLCanvasElement>('[data-dot-grid]');
  const live =
    !matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(hover: hover)').matches;

  canvases.forEach((cv) => {
    const host = cv.parentElement;
    const ctx = cv.getContext('2d');
    if (!host || !ctx) return;
    let w = 0;
    let h = 0;
    let mx = -9999;
    let my = -9999;
    let raf = 0;
    let base = '';
    let stops: string[] = [];

    const colors = () => {
      const s = getComputedStyle(document.documentElement);
      base = s.getPropertyValue('--c-ink').trim();
      const [y, b, r] = ['--logo-yellow', '--logo-blue', '--logo-red'].map((n) =>
        s.getPropertyValue(n).trim(),
      ) as [string, string, string];
      stops = [y, b, r, y];
    };
    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      for (let x = PITCH / 2; x < w; x += PITCH) {
        for (let y = PITCH / 2; y < h; y += PITCH) {
          const t = Math.max(0, 1 - Math.hypot(x - mx, y - my) / RADIUS);
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + t * 2.2, 0, Math.PI * 2);
          const angle = (Math.atan2(y - my, x - mx) + Math.PI) / (Math.PI * 2);
          ctx.fillStyle = t > 0.02 ? ramp(stops, angle) : base;
          ctx.globalAlpha = t > 0.02 ? 0.25 + t * 0.75 : 0.16;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    const queue = () => {
      raf ||= requestAnimationFrame(draw);
    };
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      w = host.clientWidth;
      h = host.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors();
      draw();
    };

    const ro = new ResizeObserver(size);
    ro.observe(host);
    const mo = new MutationObserver(() => {
      colors();
      queue();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(() => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    });

    if (live) {
      on(host, 'pointermove', (e) => {
        const r = host.getBoundingClientRect();
        mx = (e as PointerEvent).clientX - r.left;
        my = (e as PointerEvent).clientY - r.top;
        queue();
      });
      on(host, 'pointerleave', () => {
        mx = my = -9999;
        queue();
      });
    }
  });
}
