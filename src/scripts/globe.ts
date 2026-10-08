/* ----------------------------------------------------------------- map -- */
import { cleanups } from './dom';

const ORLANDO: [number, number] = [-81.3789, 28.5384];
// OpenFreeMap Positron/Dark, self-hosted from public/map/ (tiles still from OpenFreeMap).
const styleUrl = () =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}map/${
    document.documentElement.dataset.theme === 'light' ? 'positron' : 'dark'
  }.json`;

// Animated dot from MapLibre's "Add an animated icon" example, in the site accent.
function pulsingDot(map: import('maplibre-gl').Map) {
  const size = 100;
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#0072e3';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx: CanvasRenderingContext2D | null = null;
  return {
    width: size,
    height: size,
    data: new Uint8ClampedArray(size * size * 4),
    onAdd() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      ctx = canvas.getContext('2d');
    },
    render() {
      if (!ctx) return false;
      const t = reduce ? 1 : (performance.now() % 1600) / 1600;
      const r = (size / 2) * 0.3;
      ctx.clearRect(0, 0, size, size);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r + (size / 2 - r) * t, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();
      this.data = ctx.getImageData(0, 0, size, size).data;
      if (!reduce) map.triggerRepaint();
      return true;
    },
  };
}

// maplibre-gl (~250KB) sits below the fold, so it loads only when the figure
// nears the viewport.
export function initGlobe() {
  const mounts = document.querySelectorAll<HTMLElement>('[data-map-mount]');
  if (!mounts.length) return;
  // Warm the tile host's TLS handshake while maplibre's chunk is still downloading.
  if (!document.querySelector('link[href="https://tiles.openfreemap.org"]')) {
    const l = Object.assign(document.createElement('link'), {
      rel: 'preconnect',
      href: 'https://tiles.openfreemap.org',
      crossOrigin: 'anonymous',
    });
    document.head.append(l);
  }

  const mount = async (el: HTMLElement) => {
    const [maplibregl, { default: workerUrl }, { default: cssUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      // As a URL, not a bundled import, so the stylesheet isn't a render-blocking
      // <link> on every page that merely contains a map mount.
      import('maplibre-gl/dist/maplibre-gl.css?url'),
    ]);
    if (!document.querySelector(`link[href="${cssUrl}"]`)) {
      document.head.append(
        Object.assign(document.createElement('link'), { rel: 'stylesheet', href: cssUrl }),
      );
    }
    maplibregl.setWorkerUrl(workerUrl);
    const map = new maplibregl.Map({
      container: el,
      style: styleUrl(),
      center: ORLANDO,
      zoom: 1.5,
      cooperativeGestures: true,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl());
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    // compact attribution opens itself on first render; start collapsed.
    map.once('load', () =>
      el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'),
    );

    const popup = new maplibregl.Popup({ offset: 12, closeOnClick: false, focusAfterOpen: false })
      .setLngLat(ORLANDO)
      .setText('Orlando, Florida');
    // setStyle drops images/layers, so re-add the dot on every style load.
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
      map.addImage('pulsing-dot', pulsingDot(map), { pixelRatio: 2 });
      map.addSource('orlando', {
        type: 'geojson',
        data: { type: 'Point', coordinates: ORLANDO },
      });
      map.addLayer({
        id: 'orlando',
        type: 'symbol',
        source: 'orlando',
        layout: { 'icon-image': 'pulsing-dot', 'icon-allow-overlap': true },
      });
    });
    map.once('load', () => popup.addTo(map));
    map.on('click', 'orlando', () => popup.isOpen() || popup.addTo(map));
    map.on('mouseenter', 'orlando', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'orlando', () => (map.getCanvas().style.cursor = ''));

    const mo = new MutationObserver(() => map.setStyle(styleUrl(), { diff: false }));
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
    { rootMargin: '600px 0px' },
  );
  mounts.forEach((m) => io.observe(m));
  cleanups.push(() => io.disconnect());
}
