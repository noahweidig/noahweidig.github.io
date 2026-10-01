/* --------------------------------------------------------------- header -- */
import { on } from './dom';

export function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const sync = () => header.toggleAttribute('data-stuck', window.scrollY > 8);
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.getElementById('mobile-nav');
  if (!toggle || !panel) return;
  /* Cheap lock: overflow on <html> + touch-action:none on the panel. The old
     body position:fixed lock relaid out the whole page on every toggle. */
  const setOpen = (open: boolean) => {
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    header.toggleAttribute('data-menu-open', open);
    document.documentElement.toggleAttribute('data-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  on(toggle, 'click', () => setOpen(panel.hidden));
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
