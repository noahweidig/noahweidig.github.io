/* ---------------------------------------------------------- scroll root -- */
import { swapFunctions } from 'astro:transitions/client';

/**
 * On touch devices the page scrolls inside <body>, not the window (see the
 * `pointer: coarse` block in global.css). iOS 26 Safari has a known bug
 * (WebKit 297779): once the keyboard has been up (the search field), it loses
 * track of its toolbar resizing as the window scrolls, the visual viewport is
 * left 68px below the layout viewport, and the fixed nav bar slides off the
 * top for the rest of the tab. With the window never scrolling, the toolbar
 * never resizes. Everything that reads or drives the page's scroll position
 * goes through these helpers.
 */

export const BODY_SCROLL_QUERY = '(pointer: coarse)';

export const bodyScrolls = () => matchMedia(BODY_SCROLL_QUERY).matches;

/** What to bind `scroll` listeners to. Bind per page (inside a `boot()` init):
    on desktop the router swaps <body> on every navigation. */
export const scrollTarget = (): HTMLElement | Window => (bodyScrolls() ? document.body : window);

export const pageScrollY = () => (bodyScrolls() ? document.body.scrollTop : window.scrollY);

export const pageViewportHeight = () =>
  bodyScrolls() ? document.body.clientHeight : window.innerHeight;

export const pageScrollTo = (top: number, behavior: ScrollBehavior = 'auto') =>
  scrollTarget().scrollTo({ top, behavior });

/* ClientRouter swaps in a new <body> on every navigation and restores the
   window's scroll position, which is always 0 here. On touch devices the body
   is the scroller, and replacing a scrolling element under a view transition
   left iOS Safari with a frozen, half-painted page. So keep the one <body> and
   swap its contents and attributes instead, and track the body's own scroll
   position per history entry for back/forward. Bound once, at module load. */
const positions = new Map<number, number>();
const historyIndex = () => (history.state as { index?: number } | null)?.index;
/* The entry the current <body> belongs to. On Back, history.state already
   names the destination while the old page is still on screen. */
let activeIndex: number | undefined;
let restoreTo = 0;

export function initScrollRestore() {
  activeIndex = historyIndex();
  document.addEventListener(
    'scroll',
    (ev) => {
      if (ev.target !== document.body || !bodyScrolls()) return;
      if (activeIndex !== undefined) positions.set(activeIndex, document.body.scrollTop);
    },
    { capture: true, passive: true },
  );
  document.addEventListener('astro:before-swap', (ev) => {
    if (!bodyScrolls()) return;
    const e = ev as Event & { navigationType?: string; newDocument: Document; swap: () => void };
    const i = historyIndex();
    restoreTo = e.navigationType === 'traverse' && i !== undefined ? (positions.get(i) ?? 0) : 0;
    e.swap = () => {
      swapFunctions.deselectScripts(e.newDocument);
      swapFunctions.swapRootAttributes(e.newDocument);
      swapFunctions.swapHeadElements(e.newDocument);
      const restoreFocus = swapFunctions.saveFocus();
      const body = document.body;
      const next = e.newDocument.body;
      for (const a of [...body.attributes]) body.removeAttribute(a.name);
      for (const a of [...next.attributes]) body.setAttribute(a.name, a.value);
      body.replaceChildren(...next.childNodes);
      body.scrollTop = restoreTo;
      restoreFocus();
    };
  });
  document.addEventListener('astro:after-swap', () => {
    if (bodyScrolls()) document.body.scrollTop = restoreTo;
    activeIndex = historyIndex();
  });
  document.addEventListener('astro:page-load', () => {
    activeIndex = historyIndex();
  });
}
