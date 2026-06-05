import {useEffect, useRef} from "preact/hooks";

/*
 * Map block — open-source interactive maps for HugoBlox.
 *
 * Default provider stack: MapLibre GL (BSD) + OpenFreeMap (free OSM-based vector
 * tiles, no API key, no rate limit). Provider resolution is intentionally a
 * single switchable function so additional providers (MapTiler, Mapbox, Google,
 * Stadia) can be added later without changing the component contract.
 */

const OPENFREEMAP_STYLE_URLS = {
  streets: "https://tiles.openfreemap.org/styles/liberty",
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  bright: "https://tiles.openfreemap.org/styles/bright",
};

function resolveStyleUrl(provider, styleName) {
  const name = (provider && provider.name) || "openfreemap";
  const style = styleName || (provider && provider.style) || "streets";
  switch (name) {
    case "openfreemap":
      return OPENFREEMAP_STYLE_URLS[style] || OPENFREEMAP_STYLE_URLS.streets;
    default:
      return OPENFREEMAP_STYLE_URLS.streets;
  }
}

const HEIGHT_CLASS = {
  sm: "h-72 md:h-80",
  md: "h-96 md:h-[28rem]",
  lg: "h-[28rem] md:h-[36rem]",
  full: "h-[calc(100vh-4rem)]",
};

function heightClass(h) {
  return HEIGHT_CLASS[h] || HEIGHT_CLASS.md;
}

function renderInline(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function directionsUrl(location, override) {
  if (override) return override;
  if (location?.lat == null || location?.lng == null) return null;
  return `https://www.openstreetmap.org/directions?to=${location.lat}%2C${location.lng}`;
}

function MapCanvas({location, zoom, markers, provider, style, interactive, attribution, design}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (typeof window === "undefined") return;

    let map;
    let resizeObserver;
    let themeObserver;
    let cancelled = false;
    let attempts = 0;

    function init() {
      if (cancelled) return;
      const lib = window.maplibregl;
      if (!lib) {
        if (attempts++ < 60) {
          setTimeout(init, 50);
        } else {
          console.warn("[hugoblox/map] MapLibre GL did not load in time");
        }
        return;
      }

      const pins =
        markers && markers.length > 0
          ? markers.filter((m) => m.lat != null && m.lng != null)
          : location?.lat != null && location?.lng != null
            ? [{lat: location.lat, lng: location.lng, title: location.address}]
            : [];

      const center =
        pins.length > 0
          ? [pins[0].lng, pins[0].lat]
          : location?.lat != null && location?.lng != null
            ? [location.lng, location.lat]
            : [0, 0];

      // Theme-aware basemap: bright for light mode, dark for dark mode.
      // Falls back to `design.style` (then provider default) when unset.
      const pickStyle = () => {
        const isDark =
          typeof document !== "undefined" && document.documentElement.classList.contains("dark");
        return (isDark ? design?.style_dark : design?.style_light) || style;
      };

      map = new lib.Map({
        container: ref.current,
        style: resolveStyleUrl(provider, pickStyle()),
        center,
        zoom: zoom || 14,
        attributionControl: attribution === false ? false : {compact: true},
        interactive: interactive !== false,
        cooperativeGestures: design?.cooperative_gestures === true,
      });

      if (interactive !== false) {
        map.addControl(new lib.NavigationControl({showCompass: false}), "top-right");
      }

      if (pins.length > 1) {
        const bounds = new lib.LngLatBounds();
        pins.forEach((m) => bounds.extend([m.lng, m.lat]));
        map.once("load", () => map.fitBounds(bounds, {padding: 60, maxZoom: 15, duration: 0}));
      }

      pins.forEach((m) => {
        const marker = new lib.Marker({color: "var(--map-pin-color, #6366f1)"}).setLngLat([m.lng, m.lat]);
        const popupHtml = [
          m.title ? `<strong>${escapeHtml(m.title)}</strong>` : "",
          m.description ? `<div class="mt-1 text-sm">${escapeHtml(m.description)}</div>` : "",
          m.url ? `<div class="mt-2"><a class="text-primary-600 underline" href="${escapeHtml(m.url)}">View details →</a></div>` : "",
        ]
          .filter(Boolean)
          .join("");
        if (popupHtml) {
          marker.setPopup(new lib.Popup({offset: 24, closeButton: true}).setHTML(popupHtml));
        }
        marker.addTo(map);
      });

      // MapLibre measures the container at construction. In grid/flex layouts the
      // resolved size may not be final on the first frame, so the GL canvas ends
      // up smaller than the visible container and tiles paint into nothing.
      // Observe size changes and forward to map.resize().
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (map) map.resize();
        });
        resizeObserver.observe(ref.current);
      }

      // Swap the basemap live when the site toggles light/dark. HTML markers and
      // popups persist across setStyle, so only the tiles change.
      if (typeof MutationObserver !== "undefined" && (design?.style_light || design?.style_dark)) {
        let currentStyle = resolveStyleUrl(provider, pickStyle());
        themeObserver = new MutationObserver(() => {
          const next = resolveStyleUrl(provider, pickStyle());
          if (next !== currentStyle) {
            currentStyle = next;
            map.setStyle(next);
          }
        });
        themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ["class"]});
      }
    }

    init();

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (themeObserver) themeObserver.disconnect();
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, zoom, JSON.stringify(markers), style, interactive, attribution]);

  return <div ref={ref} class="w-full h-full bg-gray-100 dark:bg-gray-800" aria-label="Map" role="img" />;
}

function AddressCard({content, location, ctaUrl, dark}) {
  const {title, subtitle, cta = {}} = content;
  const addressLines = (location?.address || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasItems = addressLines.length > 0 || cta.phone || cta.email;

  return (
    <div class={`flex flex-col justify-center p-6 sm:p-8 ${dark ? "bg-gray-900 text-white" : "bg-white dark:bg-gray-800"}`}>
      {title && (
        <h2
          class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2"
          dangerouslySetInnerHTML={{__html: renderInline(title)}}
        />
      )}
      {subtitle && (
        <p class="text-base text-gray-600 dark:text-gray-400 mb-6" dangerouslySetInnerHTML={{__html: renderInline(subtitle)}} />
      )}

      {hasItems && (
        <ul class="space-y-3 mb-6">
          {addressLines.length > 0 && (
            <li class="flex items-start gap-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
              <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600 dark:text-primary-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>
                {addressLines.map((line, i) => (
                  <span key={i} class="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          )}
          {cta.phone && (
            <li class="flex items-start gap-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
              <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600 dark:text-primary-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <a href={`tel:${cta.phone}`} class="hover:text-primary-600 dark:hover:text-primary-400">
                {cta.phone}
              </a>
            </li>
          )}
          {cta.email && (
            <li class="flex items-start gap-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
              <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600 dark:text-primary-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <a href={`mailto:${cta.email}`} class="hover:text-primary-600 dark:hover:text-primary-400 break-all">
                {cta.email}
              </a>
            </li>
          )}
        </ul>
      )}

      {ctaUrl && (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-primary-700 hover:to-secondary-700 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          {(content.cta && content.cta.directions && content.cta.directions.text) || "Get directions"}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clip-rule="evenodd"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

export const MapBlock = ({content = {}, design = {}, provider}) => {
  const {location = {}, zoom, markers, cta = {}} = content;
  const layout = design.layout || "side-by-side";
  const heightCls = heightClass(design.height);
  const radius = design.border === "none" ? "" : "rounded-3xl";
  const borderShadow = design.border === "none" ? "" : "ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg";

  const ctaUrl = directionsUrl(location, cta.directions?.url);

  if (layout === "map-only") {
    return (
      <div class="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
          {(content.title || content.subtitle) && (
            <div class="text-center max-w-3xl mx-auto mb-8">
              {content.title && (
                <h2
                  class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4"
                  dangerouslySetInnerHTML={{__html: renderInline(content.title)}}
                />
              )}
              {content.subtitle && (
                <p class="text-xl text-primary-600 dark:text-primary-400 font-medium mb-3" dangerouslySetInnerHTML={{__html: renderInline(content.subtitle)}} />
              )}
            </div>
          )}
          <div class={`relative overflow-hidden ${heightCls} ${radius} ${borderShadow}`}>
            <MapCanvas
              location={location}
              zoom={zoom}
              markers={markers}
              provider={provider}
              style={design.style}
              interactive={design.interactive}
              attribution={design.attribution}
              design={design}
            />
          </div>
        </div>
      </div>
    );
  }

  // side-by-side (default)
  return (
    <div class="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class={`grid grid-cols-1 lg:grid-cols-2 overflow-hidden ${radius} ${borderShadow}`}>
          <AddressCard content={content} location={location} ctaUrl={ctaUrl} />
          <div class={`relative ${heightCls} order-first lg:order-last`}>
            <MapCanvas
              location={location}
              zoom={zoom}
              markers={markers}
              provider={provider}
              style={design.style}
              interactive={design.interactive}
              attribution={design.attribution}
              design={design}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
