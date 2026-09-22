/**
 * Shared plumbing for the feature modules in this directory: the base-path
 * helper, the `on()` event-binding helper that queues its own teardown, and
 * the shared cleanup queue that `boot()` drains on every `astro:page-load`.
 */

/** The site's base path, read off the document rather than import.meta.env so
    this module stays a plain script. */
export const basePath = () => (document.documentElement.dataset.base ?? '').replace(/\/+$/, '');

export type Cleanup = () => void;

/** Mutable and shared: every feature module pushes its own teardown onto this
    same array rather than owning one of its own. */
export const cleanups: Cleanup[] = [];

/** Runs every queued cleanup and empties the array. Reassigning an imported
    binding isn't legal, so this replaces the old `cleanups.forEach(...);
    cleanups = [];` pair that used to live at the top of `boot()`. */
export function resetCleanups() {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
}

export const on = <K extends keyof DocumentEventMap>(
  el: EventTarget,
  type: K | string,
  fn: EventListenerOrEventListenerObject,
  opts?: AddEventListenerOptions,
) => {
  el.addEventListener(type, fn, opts);
  cleanups.push(() => el.removeEventListener(type, fn, opts));
};
