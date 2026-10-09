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

/** What to bind `scroll` listeners to. Bind per page (inside a `boot()` init):
    on desktop the router swaps <body> on every navigation. */
export const scrollTarget = (): HTMLElement | Window => (bodyScrolls() ? document.body : window);

export const pageScrollY = () => (bodyScrolls() ? document.body.scrollTop : window.scrollY);

export const pageViewportHeight = () =>
  bodyScrolls() ? document.body.clientHeight : window.innerHeight;

export const pageScrollTo = (top: number, behavior: ScrollBehavior = 'auto') =>
  scrollTarget().scrollTo({ top, behavior });
