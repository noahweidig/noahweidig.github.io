/* ----------------------------------------------------------- copy bibtex -- */
import { on } from './dom';

export function initCopy() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    on(btn, 'click', async () => {
      const value = btn.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(value);
        const label = btn.querySelector('[data-copy-label]');
        const prev = label?.textContent ?? '';
        if (label) label.textContent = 'Copied';
        btn.dataset.state = 'copied';
        window.setTimeout(() => {
          if (label) label.textContent = prev;
          delete btn.dataset.state;
        }, 1600);
      } catch {
        /* clipboard blocked — the visible value is still selectable */
      }
    });
  });
}
