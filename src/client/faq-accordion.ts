/* -------------------------------------------------------------------- faq -- */
import { on } from './dom';

export function initFaqAccordion() {
  const items = document.querySelectorAll<HTMLDetailsElement>('.faq');
  if (!items.length) return;
  items.forEach((el) => {
    on(el, 'toggle', () => {
      if (!el.open) return;
      items.forEach((other) => {
        if (other !== el) other.open = false;
      });
    });
  });
}
