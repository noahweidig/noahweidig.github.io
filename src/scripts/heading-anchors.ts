/* ------------------------------------------------------- heading anchors -- */
import { on } from './dom';
import { hideTip, showTip } from './tooltips';

/* A copy-the-anchor control per heading: hovering a heading reveals a pilcrow (¶) after the text, and
   clicking it copies the full URL rather than only moving the hash. */
export function initHeadingAnchors() {
  document
    .querySelectorAll<HTMLHeadingElement>('.prose-nw h2[id], .prose-nw h3[id], .prose-nw h4[id]')
    .forEach((h) => {
      if (h.querySelector('.heading-anchor')) return;
      const a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = `#${h.id}`;
      a.dataset.tip = 'Permanent link';
      a.setAttribute('role', 'button');
      a.setAttribute('aria-label', 'Permanent link');
      a.textContent = '¶';

      on(a, 'click', async (ev) => {
        ev.preventDefault();
        const url = `${location.origin}${location.pathname}#${h.id}`;
        history.replaceState(history.state, '', `#${h.id}`);
        h.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
        try {
          await navigator.clipboard.writeText(url);
          a.dataset.tip = 'Link copied';
        } catch {
          a.dataset.tip = 'Copy blocked — the link is in the address bar';
        }
        showTip(a);
        window.setTimeout(() => {
          a.dataset.tip = 'Permanent link';
          hideTip();
        }, 1600);
      });

      h.append(a);
    });
}
