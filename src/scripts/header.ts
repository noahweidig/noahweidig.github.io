/* --------------------------------------------------------------- header -- */
import { on } from './dom';

export function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const sync = () => header.toggleAttribute('data-stuck', window.scrollY > 8);
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);

  const groups = [...document.querySelectorAll<HTMLElement>('.nav-group')];
  const setGroup = (g: HTMLElement, open: boolean) => {
    g.toggleAttribute('data-open', open);
    g.querySelector('[data-nav-trigger]')?.setAttribute('aria-expanded', String(open));
  };
  const closeGroups = (except?: HTMLElement) =>
    groups.forEach((g) => g !== except && setGroup(g, false));
  let hoverTimer: number | undefined;
  groups.forEach((g) => {
    const trigger = g.querySelector<HTMLElement>('[data-nav-trigger]');
    on(trigger!, 'click', () => {
      closeGroups(g);
      setGroup(g, !g.hasAttribute('data-open'));
    });
    on(g, 'pointerenter', (ev) => {
      clearTimeout(hoverTimer);
      if ((ev as PointerEvent).pointerType === 'mouse') {
        closeGroups(g);
        setGroup(g, true);
      }
    });
    on(g, 'pointerleave', (ev) => {
      if ((ev as PointerEvent).pointerType !== 'mouse') return;
      hoverTimer = window.setTimeout(() => setGroup(g, false), 120);
    });
    on(g, 'focusout', (ev) => {
      if (!g.contains((ev as FocusEvent).relatedTarget as Node)) setGroup(g, false);
    });
  });
  on(document, 'click', (ev) => {
    if (!groups.some((g) => g.contains(ev.target as Node))) closeGroups();
  });
  on(document, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key !== 'Escape') return;
    const open = groups.find((g) => g.hasAttribute('data-open'));
    if (!open) return;
    closeGroups();
    open.querySelector<HTMLElement>('[data-nav-trigger]')?.focus();
  });

  const mGroups = [...document.querySelectorAll<HTMLElement>('.mobile-group')];
  mGroups.forEach((g) => {
    const t = g.querySelector<HTMLElement>('[data-mobile-trigger]')!;
    on(t, 'click', () => {
      const open = !g.hasAttribute('data-open');
      mGroups.forEach((o) => {
        o.toggleAttribute('data-open', o === g && open);
        o.querySelector('[data-mobile-trigger]')?.setAttribute(
          'aria-expanded',
          String(o === g && open),
        );
      });
    });
  });

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
