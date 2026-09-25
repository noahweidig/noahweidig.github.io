/* --------------------------------------------------------------- header -- */
import { on } from './dom';

/* iOS Safari ignores overflow:hidden on <html>/<body> for touch scrolling, so
   pin the body in place and restore the offset on close. */
let lockedY = 0;
function lockScroll(lock: boolean) {
  const b = document.body.style;
  if (lock) {
    if (b.position === 'fixed') return;
    lockedY = window.scrollY;
    Object.assign(b, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0' });
  } else if (b.position === 'fixed') {
    Object.assign(b, { position: '', top: '', left: '', right: '' });
    window.scrollTo({ top: lockedY, behavior: 'instant' });
  }
}

export function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const sync = () => header.toggleAttribute('data-stuck', window.scrollY > 8);
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.getElementById('mobile-nav');
  if (!toggle || !panel) return;
  const openIcon = toggle.querySelector('[data-menu-icon-open]');
  const closeIcon = toggle.querySelector('[data-menu-icon-close]');
  const scrim = document.querySelector<HTMLElement>('[data-menu-scrim]');
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    if (scrim) {
      scrim.hidden = !open;
      /* Anchored to the header's live bottom edge so the bar and any banner
         above it stay unblurred, and the scrim keeps covering the page while
         the reader scrolls with the menu open. */
      if (open) scrim.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
    }
    header.toggleAttribute('data-menu-open', open);
    lockScroll(open);
    toggle.setAttribute('aria-expanded', String(open));
    openIcon?.toggleAttribute('hidden', open);
    closeIcon?.toggleAttribute('hidden', !open);
  };
  on(toggle, 'click', () => setOpen(panel.hidden));
  on(
    window,
    'scroll',
    () => {
      if (!panel.hidden && scrim) {
        scrim.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
      }
    },
    { passive: true } as AddEventListenerOptions,
  );
  panel.querySelectorAll('a').forEach((a) => on(a, 'click', () => setOpen(false)));
  on(window, 'resize', () => {
    if (window.innerWidth >= 1024) setOpen(false);
  });
  on(document, 'click', (ev) => {
    if (panel.hidden) return;
    const target = ev.target as Node;
    if (!panel.contains(target) && !toggle.contains(target)) setOpen(false);
  });
  on(document, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
}
