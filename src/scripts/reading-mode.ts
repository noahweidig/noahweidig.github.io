/* ---------------------------------------------------------- reading mode -- */
import { cleanups, on } from './dom';

/* Strips the page back to the article: rails, share row, comments and footer
   step out and the measure grows. The choice is remembered per reader. */
export function initReadingMode() {
  const btn = document.querySelector<HTMLButtonElement>('[data-reading-toggle]');
  if (!btn) return;
  const root = document.documentElement;

  const set = (on_: boolean) => {
    if (on_) root.dataset.reading = '';
    else delete root.dataset.reading;
    btn.setAttribute('aria-pressed', String(on_));
    btn.dataset.tip = on_ ? 'Leave reading mode' : 'Reading mode: just the article';
    const label = btn.querySelector('[data-reading-label]');
    if (label) label.textContent = on_ ? 'Exit reading mode' : 'Reading mode';
  };

  let stored: string | null = null;
  try {
    stored = localStorage.getItem('nw-reading');
  } catch {
    /* private mode — the toggle still works for this page */
  }
  set(stored === 'on');

  on(btn, 'click', () => {
    const next = root.dataset.reading === undefined;
    set(next);
    try {
      localStorage.setItem('nw-reading', next ? 'on' : 'off');
    } catch {
      /* nothing to persist to */
    }
  });

  // The attribute lives on <html>, which survives a view-transition swap; a
  // reader who left reading mode on one post should not find it on the next.
  cleanups.push(() => {
    if (!document.querySelector('[data-reading-toggle]')) delete root.dataset.reading;
  });
}
