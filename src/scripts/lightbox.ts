/* -------------------------------------------------------------- lightbox -- */
import { cleanups, on } from './dom';

/* A custom viewer rather than a library: it inherits the site's surfaces and
   the whole thing is one dialog-less overlay with keyboard paging. */
export function initLightbox() {
  const shots = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '.prose-nw img:not([data-no-zoom]), [data-zoomable] img, img[data-zoomable]',
    ),
  ).filter((img) => !img.closest('a') && img.alt.trim() !== '');
  if (!shots.length) return;

  shots.forEach((img, i) => {
    img.classList.add('zoomable');
    img.dataset.zoomIndex = String(i);
    img.dataset.tip ??= 'Click to enlarge';
    if (!img.hasAttribute('tabindex')) img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `Enlarge image: ${img.alt}`);
  });

  let box: HTMLElement | null = null;
  let index = 0;
  let openedIndex = 0;
  let inertedSiblings: Element[] = [];

  const captionFor = (img: HTMLImageElement) =>
    img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || img.alt || '';

  const paint = () => {
    if (!box) return;
    const img = shots[index]!;
    const full = box.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
    full.src = img.currentSrc || img.src;
    full.alt = img.alt;
    box.querySelector('[data-lightbox-caption]')!.textContent = captionFor(img);
    box.querySelector('[data-lightbox-count]')!.textContent =
      shots.length > 1 ? `${index + 1} / ${shots.length}` : '';
  };

  const close = () => {
    if (!box) return;
    const node = box;
    box = null;
    delete node.dataset.show;
    document.body.style.removeProperty('overflow');
    window.setTimeout(() => node.remove(), 220);
    inertedSiblings.forEach((el) => el.removeAttribute('inert'));
    inertedSiblings = [];
    shots[openedIndex]?.focus();
  };

  const step = (delta: number) => {
    index = (index + delta + shots.length) % shots.length;
    paint();
  };

  const open = (i: number) => {
    index = i;
    openedIndex = i;
    box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML = `
      <div class="lightbox-bar">
        <span data-lightbox-count class="font-mono text-[0.7rem] tracking-[0.14em] uppercase"></span>
        <span class="ml-auto flex items-center gap-2">
          ${
            shots.length > 1
              ? `<button type="button" class="icon-tile" data-lightbox-prev aria-label="Previous image" data-tip="Previous (←)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
                 <button type="button" class="icon-tile" data-lightbox-next aria-label="Next image" data-tip="Next (→)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`
              : ''
          }
          <button type="button" class="icon-tile" data-lightbox-close aria-label="Close viewer" data-tip="Close (Esc)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </span>
      </div>
      <div class="lightbox-stage" data-lightbox-stage><img data-lightbox-img alt="" /></div>
      <p class="lightbox-caption" data-lightbox-caption></p>`;
    document.body.appendChild(box);
    inertedSiblings = Array.from(document.body.children).filter((el) => el !== box);
    inertedSiblings.forEach((el) => el.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    paint();
    requestAnimationFrame(() => {
      if (box) box.dataset.show = '';
    });
    box.querySelector<HTMLButtonElement>('[data-lightbox-close]')?.focus();

    box.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-lightbox-close]') || el.dataset.lightboxStage !== undefined) close();
      else if (el.closest('[data-lightbox-prev]')) step(-1);
      else if (el.closest('[data-lightbox-next]')) step(1);
    });
  };

  shots.forEach((img, i) => {
    on(img, 'click', () => open(i));
    on(img, 'keydown', (ev) => {
      const k = (ev as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') {
        ev.preventDefault();
        open(i);
      }
    });
  });

  on(document, 'keydown', (ev) => {
    if (!box) return;
    const k = (ev as KeyboardEvent).key;
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'ArrowRight') step(1);
    else if (k === 'Tab') {
      // The rest of the page is `inert`, so the browser already confines Tab
      // to the overlay's own focusable elements — just cycle within it.
      const focusable = Array.from(
        box.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const shiftKey = (ev as KeyboardEvent).shiftKey;
      if (shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  });

  cleanups.push(() => {
    if (box) close();
  });
}
