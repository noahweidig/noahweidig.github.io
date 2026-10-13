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
        const prevTip = btn.dataset.tip;
        const prevAria = btn.getAttribute('aria-label');
        if (label) label.textContent = 'Copied';
        if (prevTip !== undefined) btn.dataset.tip = 'Copied';
        if (prevAria !== null) btn.setAttribute('aria-label', 'Copied');
        btn.dataset.state = 'copied';
        window.setTimeout(() => {
          if (label) label.textContent = prev;
          if (prevTip !== undefined) btn.dataset.tip = prevTip;
          if (prevAria !== null) btn.setAttribute('aria-label', prevAria);
          delete btn.dataset.state;
        }, 1600);
      } catch {
        /* clipboard blocked — the visible value is still selectable */
      }
    });
  });
}
