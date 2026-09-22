/* ----------------------------------------------------------- card glow -- */
import { on } from './dom';

export function initGlow() {
  const cards = document.querySelectorAll<HTMLElement>('.card-hover');
  if (!cards.length || window.matchMedia('(hover: none)').matches) return;
  cards.forEach((card) => {
    on(card, 'pointermove', (ev) => {
      const e = ev as PointerEvent;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}
