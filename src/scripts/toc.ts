/* ------------------------------------------------------------------ toc -- */
import { on } from './dom';
import { initTocFab } from './toc-fab';

export function initToc() {
  initTocFab();
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  if (!nav) return;
  const links = new Map<string, HTMLAnchorElement>();
  nav
    .querySelectorAll<HTMLAnchorElement>('[data-toc-link]')
    .forEach((a) => links.set(a.dataset.tocLink!, a));
  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));
  if (!headings.length) return;

  const mark = (id: string | null) => {
    const active = links.get(id ?? '');
    const section = active?.dataset.tocDepth === '3' ? active.dataset.tocParent : (id ?? '');
    links.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
      if (a.dataset.tocDepth === '3') {
        const li = a.parentElement;
        if (li) li.hidden = a.dataset.tocParent !== section;
      }
    });
  };

  // Which heading is "current" is the last one to have crossed the top of the
  // viewport, not whatever happens to be intersecting — several are on screen
  // at once, and the topmost visible one is the section being read.
  const sync = () => {
    const line = 120;
    let current = headings[0]!.id;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h.id;
      else break;
    }
    // At the very bottom the last section may never reach the line.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      current = headings[headings.length - 1]!.id;
    }
    mark(current);
  };

  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);
  on(window, 'resize', sync);
}
