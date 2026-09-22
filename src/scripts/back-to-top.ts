/* ------------------------------------------------------------ back to top -- */
import { on } from './dom';

/* Only appears while the reader is actively scrolling up, and only past a
   fold's worth of scroll — so it never fights a page that's still scrolling
   down, and never shows up right at the top where it would have nothing to
   do. */
export function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const threshold = window.innerHeight * 0.75;
  let lastY = window.scrollY;

  const sync = () => {
    const y = window.scrollY;
    const scrollingUp = y < lastY;
    btn.toggleAttribute('data-show', scrollingUp && y > threshold);
    lastY = y;
  };
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  on(btn, 'click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
