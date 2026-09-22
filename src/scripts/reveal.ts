/* --------------------------------------------------------------- reveal -- */
import { cleanups } from './dom';

/* The hidden state lives behind `data-reveal="js"` on <html> (see global.css)
   and is switched on from here rather than shipped in the HTML. Two reasons:
   with JS off the grids render at full opacity instead of staying invisible,
   and an above-the-fold card is a paintable LCP candidate as soon as its bytes
   land rather than after this module downloads and executes. Anything already
   on screen is marked `is-in` first, so flipping the flag never hides content
   the reader can see. */
export function initReveal() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length) return;
  const enable = () => {
    document.documentElement.dataset.reveal = 'js';
  };
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    enable();
    return;
  }
  items.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
  });
  enable();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        (e.target as HTMLElement).classList.add('is-in');
        io.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );
  items.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}
