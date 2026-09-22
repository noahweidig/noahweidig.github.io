/* --------------------------------------------------------------- globe -- */
import { cleanups } from './dom';

// The globe's ~20KB of inline path data sits below the fold (homepage
// closing CTA), so it's parked in a <template> and cloned into the DOM only
// once the figure nears the viewport — keeping those bytes out of the
// initial HTML parse without losing the CSS-variable theming (#145).
export function initGlobe() {
  const mounts = document.querySelectorAll<HTMLElement>('[data-globe-mount]');
  if (!mounts.length) return;

  const fill = (mount: HTMLElement) => {
    const template = mount.querySelector<HTMLTemplateElement>('[data-globe-template]');
    if (!template) return;
    mount.append(template.content.cloneNode(true));
    template.remove();
  };

  if (!('IntersectionObserver' in window)) {
    mounts.forEach(fill);
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
  mounts.forEach((m) => io.observe(m));
  cleanups.push(() => io.disconnect());
}
