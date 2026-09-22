/* ------------------------------------------------------------- banner -- */
import { on } from './dom';

export function initBanner() {
  const el = document.getElementById('announcement-banner');
  const btn = el?.querySelector<HTMLButtonElement>('[data-banner-dismiss]');
  if (!el || !btn) return;
  const dismiss = () => {
    el.style.display = 'none';
    try {
      localStorage.setItem('nw-banner-dismissed', el.dataset.announcementBanner ?? '');
    } catch (e) {
      /* private mode: dismissal just won't persist across reloads */
    }
  };
  on(btn, 'click', dismiss);
  const link = el.querySelector('a');
  if (link) on(link, 'click', dismiss);
}
