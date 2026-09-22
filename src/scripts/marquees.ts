/* -------------------------------------------------------------- marquee -- */
import { cleanups } from './dom';

export function initMarquees() {
  const tracks = Array.from(document.querySelectorAll<HTMLElement>('[data-marquee]'));
  if (!tracks.length) return;

  // The track is animated with a transform, so an icon that starts off-screen
  // never satisfies a native lazy load — the browser sees it parked outside the
  // viewport and leaves it there. Loading the whole strip when the strip itself
  // scrolls into view keeps those ~270 KB off the initial page load.
  const fill = (track: HTMLElement) => {
    track.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
      img.src = img.dataset.src!;
      delete img.dataset.src;
    });
    track.querySelectorAll<HTMLElement>('[data-mask-src]').forEach((el) => {
      const src = el.dataset.maskSrc!;
      el.style.maskImage = `url(${src})`;
      el.style.setProperty('-webkit-mask-image', `url(${src})`);
      delete el.dataset.maskSrc;
    });
    if (track.dataset.cloned !== 'true') {
      const clones = Array.from(track.children).map((c) => c.cloneNode(true) as HTMLElement);
      clones.forEach((clone) => {
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll<HTMLElement>('a, button, [tabindex]').forEach((el) => {
          el.setAttribute('tabindex', '-1');
        });
      });
      track.append(...clones);
      track.dataset.cloned = 'true';
    }
  };

  if (!('IntersectionObserver' in window)) {
    tracks.forEach(fill);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        fill(e.target as HTMLElement);
        io.unobserve(e.target);
      });
    },
    { rootMargin: '200px 0px' },
  );
  tracks.forEach((t) => io.observe(t));
  cleanups.push(() => io.disconnect());
}
