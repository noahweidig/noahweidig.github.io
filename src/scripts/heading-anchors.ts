/* ------------------------------------------------------- heading anchors -- */
import { on } from './dom';
import { hideTip, showTip } from './tooltips';

/* A copy-the-anchor control per heading: hovering a heading reveals a #, and
   clicking it copies the full URL rather than only moving the hash. */
export function initHeadingAnchors() {
  document
    .querySelectorAll<HTMLHeadingElement>('.prose-nw h2[id], .prose-nw h3[id], .prose-nw h4[id]')
    .forEach((h) => {
      if (h.querySelector('.heading-anchor')) return;
      const a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = `#${h.id}`;
      a.dataset.tip = 'Copy link to this section';
      a.setAttribute('aria-label', `Copy link to section: ${h.textContent?.trim() ?? h.id}`);
      a.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/></svg>';

      on(a, 'click', async (ev) => {
        ev.preventDefault();
        const url = `${location.origin}${location.pathname}#${h.id}`;
        history.replaceState(history.state, '', `#${h.id}`);
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          await navigator.clipboard.writeText(url);
          a.dataset.tip = 'Link copied';
        } catch {
          a.dataset.tip = 'Copy blocked — the link is in the address bar';
        }
        showTip(a);
        window.setTimeout(() => {
          a.dataset.tip = 'Copy link to this section';
          hideTip();
        }, 1600);
      });

      h.prepend(a);
    });
}
