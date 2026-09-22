/* ----------------------------------------------------------- copy bibtex -- */
import { on } from './dom';

export function initCopy() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    on(btn, 'click', async () => {
      const value = btn.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(value);
        const label = btn.querySelector('[data-copy-label]');
        if (label) {
          const prev = label.textContent;
          label.textContent = 'Copied';
          window.setTimeout(() => (label.textContent = prev), 1600);
        }
      } catch {
        /* clipboard blocked — the visible value is still selectable */
      }
    });
  });
}
