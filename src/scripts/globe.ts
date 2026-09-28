/* ----------------------------------------------------------------- map -- */
import { cleanups } from './dom';

const ORLANDO: [number, number] = [-81.3789, 28.5384];
// OpenFreeMap Positron/Dark, self-hosted from public/map/ (tiles still from OpenFreeMap).
const styleUrl = () =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}map/${
    document.documentElement.dataset.theme === 'light' ? 'positron' : 'dark'
  }.json`;

// maplibre-gl (~250KB) sits below the fold, so it loads only when the figure
// nears the viewport.
export function initGlobe() {
  const mounts = document.querySelectorAll<HTMLElement>('[data-map-mount]');
  if (!mounts.length) return;

  const mount = async (el: HTMLElement) => {
    const [maplibregl, { default: workerUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    maplibregl.setWorkerUrl(workerUrl);
    const map = new maplibregl.Map({
      container: el,
      style: styleUrl(),
      center: ORLANDO,
      zoom: 1.5,
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl());
    map.addControl(new maplibregl.FullscreenControl());
    map.addControl(new maplibregl.GlobeControl());
    new maplibregl.Marker()
      .setLngLat(ORLANDO)
      .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Orlando, Florida'))
      .addTo(map);

    const mo = new MutationObserver(() => map.setStyle(styleUrl()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(() => {
      mo.disconnect();
      map.remove();
    });
  };

  if (!('IntersectionObserver' in window)) {
    mounts.forEach(mount);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        mount(e.target as HTMLElement);
        io.unobserve(e.target);
      });
    },
    { rootMargin: '200px 0px' },
  );
  mounts.forEach((m) => io.observe(m));
  cleanups.push(() => io.disconnect());
}
