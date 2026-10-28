/* ------------------------------------------------------------- carousel -- */
import { on } from './dom';

/* A native scroll-snap track keeps touch and keyboard scrolling intact; the
   prev/next buttons step one card and disable at either end of the track. */
export function initCarousels() {
  const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
    const track = root.querySelector<HTMLElement>('[data-carousel-track]');
    const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
    if (!track || !prev || !next) return;
    const slides = Array.from(track.children) as HTMLElement[];

    let queued = false;

    const max = () => Math.max(track.scrollWidth - track.clientWidth, 0);

    const sync = () => {
      queued = false;
      const at = track.scrollLeft;
      prev.disabled = at <= 1;
      next.disabled = at >= max() - 1;
    };

    const step = (dir: 1 | -1) => {
      const at = track.scrollLeft;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const left = track.getBoundingClientRect().left;
      const stops = slides.map((s) => at + s.getBoundingClientRect().left - left - pad);
      const to =
        dir > 0 ? stops.find((s) => s > at + 2) : [...stops].reverse().find((s) => s < at - 2);
      const dest = Math.min(Math.max(to ?? (dir > 0 ? max() : 0), 0), max());
      track.scrollTo({ left: dest, behavior: slow ? 'auto' : 'smooth' });
    };

    on(track, 'scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    });
    on(window, 'resize', sync);
    on(prev, 'click', () => step(-1));
    on(next, 'click', () => step(1));

    sync();
  });
}
