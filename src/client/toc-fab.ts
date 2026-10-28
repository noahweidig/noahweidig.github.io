/* ------------------------------------------------------------------ toc -- */
import { on } from './dom';

/* On mobile the rail has no column, so it is a popover behind a floating
   button; the desktop rail is the same markup with the popover CSS undone.
   Called from initToc() in toc.ts (not from boot() directly), same as in the
   pre-split ui.ts. */
export function initTocFab() {
  const fab = document.querySelector<HTMLElement>('[data-toc-fab]');
  const aside = document.querySelector<HTMLElement>('[data-toc-aside]');
  if (!fab || !aside) return;

  const setOpen = (open: boolean) => {
    aside.toggleAttribute('data-open', open);
    fab.setAttribute('aria-expanded', String(open));
  };

  on(fab, 'click', (e) => {
    e.stopPropagation();
    setOpen(!aside.hasAttribute('data-open'));
  });
  on(aside, 'click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });
  on(document, 'click', (e) => {
    if (!aside.contains(e.target as Node)) setOpen(false);
  });
  on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') setOpen(false);
  });
}
