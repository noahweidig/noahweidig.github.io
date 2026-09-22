/* ----------------------------------------------------------- share row -- */
import { cleanups, on } from './dom';
import { hideTip } from './tooltips';

/* One Share button opens a modal dialog with every target, so the row stays
   two buttons wide at any screen size. */
export function initShareRow() {
  document.querySelectorAll<HTMLElement>('[data-share-row]').forEach(setupShareRow);
}

function setupShareRow(row: HTMLElement) {
  const dialog = row.querySelector<HTMLDialogElement>('[data-share-dialog]');
  const open = row.querySelector<HTMLButtonElement>('[data-share-open]');
  if (!dialog || !open) return;

  const close = () => {
    if (dialog.open) dialog.close();
  };

  on(open, 'click', () => {
    hideTip();
    dialog.showModal();
  });
  row.querySelector<HTMLButtonElement>('[data-share-close]')?.addEventListener('click', close);
  // Clicks land on the dialog itself only outside its padding box: that is the
  // backdrop, so the dialog closes.
  on(dialog, 'click', (ev) => {
    const box = dialog.getBoundingClientRect();
    const { clientX: x, clientY: y } = ev as MouseEvent;
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) close();
  });
  dialog.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  cleanups.push(close);
}
