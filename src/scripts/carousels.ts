/* ------------------------------------------------------------- carousel -- */
import { cleanups, on } from './dom';

/* A native scroll-snap track keeps touch and keyboard scrolling intact; the
   dots below mirror the snapped card and advance the track on their own. */
export function initCarousels() {
  const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
    const track = root.querySelector<HTMLElement>('[data-carousel-track]');
    const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-carousel-dot]'));
    const slides = track ? (Array.from(track.children) as HTMLElement[]) : [];
    if (!track || dots.length < 2 || slides.length !== dots.length) return;

    let current = 0;
    let queued = false;

    const sync = () => {
      queued = false;
      collapse();
      current = nearest();
      while (current < dots.length - 1 && dots[current]!.hidden) current += 1;
      dots.forEach((d, i) => {
        d.setAttribute('aria-selected', String(i === current));
        d.tabIndex = i === current ? 0 : -1;
      });
    };

    /* Where the track ends up when slide i is asked for — clamped, because
       the last screenful of cards all share the same end position. */
    const target = (i: number) => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const left = track.getBoundingClientRect().left;
      const delta = slides[i]!.getBoundingClientRect().left - left - pad;
      const max = Math.max(track.scrollWidth - track.clientWidth, 0);
      return Math.min(Math.max(track.scrollLeft + delta, 0), max);
    };

    const go = (i: number) => {
      track.scrollTo({ left: target(i), behavior: slow ? 'auto' : 'smooth' });
    };

    /* Matched against the same stops `go` scrolls to, not against the middle
       of the track: a card is "current" when it sits where the dot would put
       it. Ties go to the later card, so the end of the track belongs to the
       last award rather than the first one that happens to reach it. */
    const nearest = () => {
      const at = track.scrollLeft;
      let best = 0;
      let bestGap = Infinity;
      slides.forEach((_, i) => {
        const gap = Math.abs(target(i) - at);
        if (gap <= bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      return best;
    };

    /* A dot that scrolls to the same place as the one after it is a dot that
       does nothing, which is what the trailing cards become once several fit
       on screen at once. Hide those and leave the end of the track to the
       last dot. */
    const collapse = () => {
      const stops = slides.map((_, i) => Math.round(target(i)));
      dots.forEach((d, i) => {
        d.hidden = i < dots.length - 1 && stops[i] === stops[i + 1];
      });
    };

    on(track, 'scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    });
    on(window, 'resize', sync);

    dots.forEach((dot, i) => {
      on(dot, 'click', () => go(i));
      on(dot, 'keydown', (e) => {
        const key = (e as KeyboardEvent).key;
        if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
        const step = key === 'ArrowRight' ? 1 : -1;
        e.preventDefault();
        const next = (i + step + dots.length) % dots.length;
        go(next);
        dots[next].focus();
      });
    });

    sync();

    /* Auto-advance, paused while the reader is on it or the tab is hidden,
       and stopped outright by the toggle beside the dots. */
    const toggle = root.querySelector<HTMLButtonElement>('[data-carousel-toggle]');
    if (slow) {
      toggle?.remove();
      return;
    }
    let held = false;
    let stopped = false;
    const tick = () => {
      if (stopped || held || document.hidden || root.contains(document.activeElement)) return;
      let next = (current + 1) % slides.length;
      while (dots[next]!.hidden && next !== current) next = (next + 1) % slides.length;
      go(next);
    };
    const timer = window.setInterval(tick, 5200);
    cleanups.push(() => window.clearInterval(timer));
    on(root, 'pointerenter', () => {
      held = true;
    });
    on(root, 'pointerleave', () => {
      held = false;
    });

    if (toggle) {
      const pauseIcon = toggle.querySelector<HTMLElement>('[data-carousel-icon-pause]');
      const playIcon = toggle.querySelector<HTMLElement>('[data-carousel-icon-play]');
      on(toggle, 'click', () => {
        stopped = !stopped;
        toggle.setAttribute('aria-pressed', String(stopped));
        const label = stopped ? 'Play the awards carousel' : 'Pause the awards carousel';
        toggle.setAttribute('aria-label', label);
        toggle.dataset.tip = stopped ? 'Play the carousel' : 'Pause the carousel';
        if (pauseIcon) pauseIcon.hidden = stopped;
        if (playIcon) playIcon.hidden = !stopped;
      });
    }
  });
}
