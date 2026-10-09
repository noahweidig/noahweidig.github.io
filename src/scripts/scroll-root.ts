/* ---------------------------------------------------------- scroll root -- */
/**
 * On touch devices the page scrolls inside <body>, not the window (see the
 * `pointer: coarse` block in global.css). iOS Safari shrinks its toolbar while
 * the window scrolls, and after the search dialog has been open it can lose
 * track of that resize for the rest of the tab: the visual viewport ends up
 * 68px below the layout viewport and the fixed nav bar slides off the top.
 * With the window never scrolling, the toolbar never resizes. Everything that
 * reads or drives the page's scroll position goes through these helpers.
 */

export const BODY_SCROLL_QUERY = '(pointer: coarse)';

export const bodyScrolls = () => matchMedia(BODY_SCROLL_QUERY).matches;

/** What to bind `scroll` listeners to. The body is swapped on every client-side
    navigation, so bind per page (inside a `boot()` init), not once. */
export const scrollTarget = (): HTMLElement | Window => (bodyScrolls() ? document.body : window);

export const pageScrollY = () => (bodyScrolls() ? document.body.scrollTop : window.scrollY);

export const pageViewportHeight = () =>
  bodyScrolls() ? document.body.clientHeight : window.innerHeight;

export const pageScrollTo = (top: number, behavior: ScrollBehavior = 'auto') =>
  scrollTarget().scrollTo({ top, behavior });

/* ClientRouter restores the window's scroll position on back/forward, which
   is always 0 here. Track the body's position per history entry and put it
   back after the swap. Bound once, at module load. */
const positions = new Map<number, number>();
let restoreTo: number | null = null;
const historyIndex = () => (history.state as { index?: number } | null)?.index;

export function initScrollRestore() {
  document.addEventListener(
    'scroll',
    (ev) => {
      if (ev.target !== document.body || !bodyScrolls()) return;
      const i = historyIndex();
      if (i !== undefined) positions.set(i, document.body.scrollTop);
    },
    { capture: true, passive: true },
  );
  document.addEventListener('astro:before-swap', (ev) => {
    const traverse = (ev as Event & { navigationType?: string }).navigationType === 'traverse';
    const i = historyIndex();
    restoreTo = traverse && i !== undefined ? (positions.get(i) ?? null) : null;
  });
  document.addEventListener('astro:after-swap', () => {
    if (restoreTo !== null && bodyScrolls()) document.body.scrollTop = restoreTo;
    restoreTo = null;
  });
}
