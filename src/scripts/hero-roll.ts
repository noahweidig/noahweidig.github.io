/**
 * The hero headline's rolling word. Bound from `boot()` on every
 * `astro:page-load` (like the other features here), because the router keeps
 * a bundled script from running again on a client-side navigation, which left
 * the pill stuck when you came back to the home page from another page.
 */
import { cleanups, on } from './dom';

export function initHeroRoll() {
  const roll = document.querySelector<HTMLElement>('[data-roll]');
  const track = document.querySelector<HTMLElement>('[data-roll-track]');
  if (!roll || !track) return;

  const colors: string[] = JSON.parse(roll.dataset.words ?? '[]');
  const count = colors.length;
  let index = 0;
  let widths: number[] = [];
  let active = true;
  cleanups.push(() => {
    active = false;
  });

  const measure = () => {
    const style = getComputedStyle(roll);
    const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    widths = [...track.children].map((row) => {
      const probe = row.cloneNode(true) as HTMLElement;
      probe.style.cssText =
        'position:absolute;visibility:hidden;display:inline-block;height:auto;white-space:nowrap';
      track.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      track.removeChild(probe);
      return width + pad;
    });
  };
  const show = (n: number) => {
    const rowHeight = track.children[0]!.getBoundingClientRect().height;
    track.style.transform = `translateY(${-n * rowHeight}px)`;
    roll.style.width = `${widths[n]}px`;
    roll.style.setProperty('--tint', `var(${colors[n % count]})`);
  };
  /* After rolling onto the repeated first word, jump back to the real first row
     with no transition so the loop reads as continuous. */
  const snap = () => {
    if (!active) return;
    track.style.transition = 'none';
    index = 0;
    show(0);
    void track.offsetHeight;
    track.style.transition = '';
  };

  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (!active) return;
    measure();
    show(0);
  });
  on(window, 'resize', () => {
    measure();
    show(index);
  });

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      index += 1;
      show(index);
      if (index === count) snapTimer = setTimeout(snap, 680);
    }, 2200);
    cleanups.push(() => {
      clearInterval(timer);
      clearTimeout(snapTimer);
    });
  }
}
