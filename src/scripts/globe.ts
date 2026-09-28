/* ----------------------------------------------------------------- map -- */
import type { StyleSpecification } from 'maplibre-gl';
import { cleanups } from './dom';

const ORLANDO: [number, number] = [-81.3789, 28.5384];
const FONT = ['Noto Sans Regular'];

// Vector style built from the site's CSS tokens, so it matches either theme.
function buildStyle(): StyleSpecification {
  const css = getComputedStyle(document.documentElement);
  const c = (n: string) => css.getPropertyValue(n).trim();
  const [land, water, line, strong, dim, faint] = [
    '--c-surface',
    '--c-raised',
    '--c-line',
    '--c-line-strong',
    '--c-dim',
    '--c-faint',
  ].map(c);
  const label = (id: string, filter: unknown[], size: number, color: string, minzoom = 0) => ({
    id,
    type: 'symbol' as const,
    source: 'omt',
    'source-layer': 'place',
    filter: filter as never,
    minzoom,
    layout: {
      'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']] as never,
      'text-font': FONT,
      'text-size': size,
      'text-max-width': 7,
    },
    paint: { 'text-color': color, 'text-halo-color': land, 'text-halo-width': 1.5 },
  });
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': land } },
      {
        id: 'water',
        type: 'fill',
        source: 'omt',
        'source-layer': 'water',
        paint: { 'fill-color': water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'omt',
        'source-layer': 'waterway',
        minzoom: 7,
        paint: { 'line-color': water, 'line-width': 1 },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        paint: {
          'line-color': line,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 2],
        },
      },
      {
        id: 'state',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        filter: ['all', ['==', 'admin_level', 4], ['!=', 'maritime', 1]],
        paint: { 'line-color': strong, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'country',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        filter: ['all', ['==', 'admin_level', 2], ['!=', 'maritime', 1]],
        paint: { 'line-color': strong, 'line-width': 1.4 },
      },
      label('place-country', ['==', 'class', 'country'], 12, faint),
      label('place-state', ['==', 'class', 'state'], 11, faint, 3),
      label(
        'place-city',
        ['all', ['in', 'class', 'city', 'town'], ['!=', 'name', 'Orlando']],
        12,
        dim,
        5,
      ),
    ],
  };
}

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
      style: buildStyle(),
      center: ORLANDO,
      zoom: 1.5,
      minZoom: 0.8,
      maxZoom: 14,
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      'bottom-right',
    );

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'map-dot';
    dot.setAttribute('aria-label', 'Orlando, Florida');

    const pop = document.createElement('div');
    pop.innerHTML = '<b>Orlando, Florida · UTC-5</b><code>28.5384&deg; N, 81.3789&deg; W</code>';
    const popup = new maplibregl.Popup({
      closeOnClick: false,
      closeOnMove: false,
      offset: 18,
      maxWidth: 'none',
    }).setDOMContent(pop);

    const marker = new maplibregl.Marker({ element: dot })
      .setLngLat(ORLANDO)
      .setPopup(popup)
      .addTo(map);
    marker.togglePopup();

    const mo = new MutationObserver(() => map.setStyle(buildStyle()));
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
