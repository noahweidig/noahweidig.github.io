/* --------------------------------------------------------- affiliations -- */
import { on } from './dom';

/** The trailing fade hints at more cards, so it goes away once the row is scrolled to its end. */
export function initAffiliations() {
  document.querySelectorAll<HTMLElement>('[data-affil]').forEach((wrap) => {
    const track = wrap.querySelector<HTMLElement>('.affil-track');
    const fade = wrap.querySelector<HTMLElement>('.affil-fade');
    if (!track || !fade) return;
    const sync = () => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      fade.style.opacity = atEnd ? '0' : '';
    };
    on(track, 'scroll', sync, { passive: true });
    on(window, 'resize', sync);
    sync();
  });
}
