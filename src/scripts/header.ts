/* --------------------------------------------------------------- header -- */
import { on } from './dom';

export function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  /* Over a dark band the glass pill would show dark ground behind light-theme
     text, so the header takes the band's palette while one sits under it. */
  const bands = [...document.querySelectorAll<HTMLElement>('section.band-dark')];
  const probe = () => header.getBoundingClientRect().top + header.offsetHeight / 2 + 8;
  const overDark = () => {
    const y = probe();
    return bands.some((b) => {
      const r = b.getBoundingClientRect();
      return r.top <= y && r.bottom >= y;
    });
  };
  const sync = () => {
    header.toggleAttribute('data-stuck', window.scrollY > 8);
    header.classList.toggle('band-dark', overDark());
  };
  sync();
  on(window, 'scroll', sync, { passive: true } as AddEventListenerOptions);
  on(window, 'resize', sync);

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
    on(trigger!, 'click', (ev) => {
      closeGroups(g);
      /* A mouse click lands after hover already opened it; toggling would close it. */
      const mouse = (ev as PointerEvent).pointerType === 'mouse';
      setGroup(g, mouse || g.dataset.open === undefined);
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
    const open = groups.find((g) => g.dataset.open !== undefined);
    if (!open) return;
    closeGroups();
    open.querySelector<HTMLElement>('[data-nav-trigger]')?.focus();
  });

  const mGroups = [...document.querySelectorAll<HTMLElement>('.mobile-group')];
  mGroups.forEach((g) => {
    const t = g.querySelector<HTMLElement>('[data-mobile-trigger]')!;
    on(t, 'click', () => {
      const open = g.dataset.open === undefined;
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
  let isOpen = false;
  let closeTimer: number | undefined;
  const setOpen = (open: boolean) => {
    if (open === isOpen) return;
    isOpen = open;
    clearTimeout(closeTimer);
    header.toggleAttribute('data-menu-open', open);
    document.documentElement.toggleAttribute('data-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.querySelectorAll('main, footer').forEach((el) => el.toggleAttribute('inert', open));
    if (open) {
      panel.removeAttribute('data-closing');
      panel.hidden = false;
      return;
    }
    /* Wipe out to the right (CSS), then hide once it finishes. */
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panel.hidden = true;
      return;
    }
    panel.setAttribute('data-closing', '');
    closeTimer = window.setTimeout(() => {
      panel.hidden = true;
      panel.removeAttribute('data-closing');
    }, 300);
  };
  on(toggle, 'click', () => setOpen(!isOpen));
  panel.querySelectorAll('a').forEach((a) => on(a, 'click', () => setOpen(false)));
  on(window, 'resize', () => {
    if (window.innerWidth >= 1024) setOpen(false);
  });
  on(document, 'click', (ev) => {
    if (!isOpen) return;
    const target = ev.target as Node;
    if (!panel.contains(target) && !toggle.contains(target)) setOpen(false);
  });
  on(document, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Escape' && isOpen) {
      setOpen(false);
      toggle.focus();
    }
  });
}
