/* ----------------------------------------------------------------- popup -- */
import { cleanups, on } from './dom';
import { hideTip } from './tooltips';

export function initPopups() {
  document.querySelectorAll<HTMLButtonElement>('[data-popup-open]').forEach((btn) => {
    const dialog = document.getElementById(btn.dataset.popupOpen!) as HTMLDialogElement | null;
    if (!dialog) return;
    on(btn, 'click', () => {
      hideTip();
      dialog.showModal();
    });
  });
  document.querySelectorAll<HTMLDialogElement>('[data-popup]').forEach((dialog) => {
    const close = () => {
      if (dialog.open) dialog.close();
    };
    dialog.querySelector('[data-popup-close]')?.addEventListener('click', close);
    on(dialog, 'click', (ev) => {
      const box = dialog.getBoundingClientRect();
      const { clientX: x, clientY: y } = ev as MouseEvent;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) close();
    });
    dialog.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', close));
    cleanups.push(close);
  });
}
