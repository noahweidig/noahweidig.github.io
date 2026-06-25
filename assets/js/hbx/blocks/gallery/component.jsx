import {useState, useEffect, useRef, useCallback} from "preact/hooks";
import {createPortal} from "preact/compat";

/*
 * Gallery block — grid / masonry / justified / carousel / slideshow + Preact
 * lightbox.
 *
 * Hugo's resolve_gallery_items.html partial supplies a fully-processed `items`
 * prop: each item has src/srcset/width/height/aspect_ratio/lqip plus
 * alt/caption/credit/link/title. The component never touches image paths.
 */

const GRID_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
};

const MASONRY_COLS = {
  1: "columns-1",
  2: "columns-1 sm:columns-2",
  3: "columns-1 sm:columns-2 md:columns-3",
  4: "columns-2 sm:columns-3 md:columns-4",
  5: "columns-2 sm:columns-3 md:columns-4 lg:columns-5",
  6: "columns-2 sm:columns-3 md:columns-4 lg:columns-6",
};

const GAP_CLASS = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const MASONRY_GAP_CLASS = {
  sm: "hbx-gallery-masonry-gap-sm",
  md: "",
  lg: "hbx-gallery-masonry-gap-lg",
};

const ASPECT_CLASS = {
  square: "aspect-square",
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  wide: "aspect-[16/9]",
};

const CAROUSEL_BASIS = {
  1: "basis-[90%] sm:basis-[80%]",
  2: "basis-[85%] sm:basis-1/2",
  3: "basis-[85%] sm:basis-1/2 md:basis-1/3",
  4: "basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4",
  5: "basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/5",
  6: "basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/6",
};

const SIZES_DEFAULT_GRID = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw";
const SIZES_DEFAULT_MASONRY = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw";

function renderInline(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function GridTile({item, onClick, aspectClass, captionPosition, hoverZoom, sizes, lightbox}) {
  const [loaded, setLoaded] = useState(false);
  const imgClass = loaded
    ? "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100"
    : "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0";

  const hoverImgClass = hoverZoom ? "transition-transform duration-500 group-hover:scale-105" : "";

  const showOverlay = captionPosition === "overlay" && (item.caption || item.title);
  const showHoverCaption = captionPosition === "hover" && (item.caption || item.title);

  return (
    <figure class={`hbx-gallery-tile group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 ${aspectClass}`}>
      <button
        type="button"
        onClick={onClick}
        class="absolute inset-0 w-full h-full block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label={lightbox ? `Open image: ${item.alt || item.caption || ""}` : item.alt || item.caption || "Image"}
      >
        <span
          class="hbx-gallery-tile-lqip absolute inset-0 w-full h-full"
          style={item.lqip ? `background-image: url("${item.lqip}")` : ""}
          aria-hidden="true"
        />
        <img
          src={item.src}
          srcset={item.srcset}
          sizes={sizes}
          width={item.width}
          height={item.height}
          alt={item.alt || ""}
          loading="lazy"
          decoding="async"
          class={`${imgClass} ${hoverImgClass}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        {showOverlay && (
          <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 text-left">
            <span class="block text-sm font-semibold text-white" dangerouslySetInnerHTML={{__html: item.title || item.caption}} />
            {item.title && item.caption && (
              <span class="block text-xs text-gray-200 mt-1" dangerouslySetInnerHTML={{__html: item.caption}} />
            )}
          </span>
        )}
        {showHoverCaption && (
          <span class="absolute inset-0 flex items-end p-4 bg-black/0 group-hover:bg-black/60 transition-colors duration-300">
            <span class="block text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{__html: item.caption || item.title}} />
          </span>
        )}
      </button>
      {captionPosition === "below" && (item.caption || item.title) && (
        <figcaption class="pt-2 text-sm text-gray-600 dark:text-gray-400">
          {item.title && (
            <span class="font-semibold text-gray-900 dark:text-white" dangerouslySetInnerHTML={{__html: item.title}} />
          )}
          {item.title && item.caption && " — "}
          {item.caption && <span dangerouslySetInnerHTML={{__html: item.caption}} />}
        </figcaption>
      )}
    </figure>
  );
}

function MasonryTile({item, onClick, captionPosition, hoverZoom, sizes, lightbox}) {
  const [loaded, setLoaded] = useState(false);
  const imgClass = loaded
    ? "w-full h-auto block transition-opacity duration-500 opacity-100"
    : "w-full h-auto block transition-opacity duration-500 opacity-0";

  const hoverImgClass = hoverZoom ? "transition-transform duration-500 group-hover:scale-105" : "";

  // Use the precomputed aspect ratio to reserve space — prevents the column
  // layout from reflowing as each image loads.
  const aspectStyle = item.aspect_ratio ? `aspect-ratio: ${item.aspect_ratio}` : "";

  const showOverlay = captionPosition === "overlay" && (item.caption || item.title);
  const showHoverCaption = captionPosition === "hover" && (item.caption || item.title);

  return (
    <figure class="hbx-gallery-tile group relative">
      <button
        type="button"
        onClick={onClick}
        class="relative block w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label={lightbox ? `Open image: ${item.alt || item.caption || ""}` : item.alt || item.caption || "Image"}
        style={aspectStyle}
      >
        <span
          class="hbx-gallery-tile-lqip absolute inset-0 w-full h-full"
          style={item.lqip ? `background-image: url("${item.lqip}")` : ""}
          aria-hidden="true"
        />
        <img
          src={item.src}
          srcset={item.srcset}
          sizes={sizes}
          width={item.width}
          height={item.height}
          alt={item.alt || ""}
          loading="lazy"
          decoding="async"
          class={`${imgClass} ${hoverImgClass} absolute inset-0 w-full h-full object-cover`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        {showOverlay && (
          <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 text-left">
            <span class="block text-sm font-semibold text-white" dangerouslySetInnerHTML={{__html: item.title || item.caption}} />
            {item.title && item.caption && (
              <span class="block text-xs text-gray-200 mt-1" dangerouslySetInnerHTML={{__html: item.caption}} />
            )}
          </span>
        )}
        {showHoverCaption && (
          <span class="absolute inset-0 flex items-end p-4 bg-black/0 group-hover:bg-black/60 transition-colors duration-300">
            <span class="block text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{__html: item.caption || item.title}} />
          </span>
        )}
      </button>
      {captionPosition === "below" && (item.caption || item.title) && (
        <figcaption class="pt-2 text-sm text-gray-600 dark:text-gray-400">
          {item.title && (
            <span class="font-semibold text-gray-900 dark:text-white" dangerouslySetInnerHTML={{__html: item.title}} />
          )}
          {item.title && item.caption && " — "}
          {item.caption && <span dangerouslySetInnerHTML={{__html: item.caption}} />}
        </figcaption>
      )}
    </figure>
  );
}

/* Justified — Flickr-style row-packed layout. Each item's flex-basis is derived
   from its precomputed aspect ratio so widths reflect image proportions; flex-grow
   takes care of filling each row exactly (the browser does the row-balancing math). */
function JustifiedTile({item, rowHeight, onClick, captionPosition, hoverZoom, sizes, lightbox}) {
  const [loaded, setLoaded] = useState(false);
  const ar = item.aspect_ratio || 1;
  const imgClass = loaded
    ? "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100"
    : "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0";
  const hoverImgClass = hoverZoom ? "transition-transform duration-500 group-hover:scale-105" : "";

  const showOverlay = captionPosition === "overlay" && (item.caption || item.title);
  const showHoverCaption = captionPosition === "hover" && (item.caption || item.title);

  // Inline style: width derived from aspect ratio at the configured row height;
  // flex-grow proportional to aspect ratio so wider images claim more leftover row space.
  const itemStyle = `flex-basis: ${ar * rowHeight}px; flex-grow: ${ar}; height: ${rowHeight}px; min-width: 0;`;

  return (
    <figure class="hbx-gallery-justified-item group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800" style={itemStyle}>
      <button
        type="button"
        onClick={onClick}
        class="absolute inset-0 w-full h-full block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label={lightbox ? `Open image: ${item.alt || item.caption || ""}` : item.alt || item.caption || "Image"}
      >
        <span
          class="hbx-gallery-tile-lqip absolute inset-0 w-full h-full"
          style={item.lqip ? `background-image: url("${item.lqip}")` : ""}
          aria-hidden="true"
        />
        <img
          src={item.src}
          srcset={item.srcset}
          sizes={sizes}
          width={item.width}
          height={item.height}
          alt={item.alt || ""}
          loading="lazy"
          decoding="async"
          class={`${imgClass} ${hoverImgClass}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        {showOverlay && (
          <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 text-left">
            <span class="block text-sm font-semibold text-white" dangerouslySetInnerHTML={{__html: item.title || item.caption}} />
            {item.title && item.caption && (
              <span class="block text-xs text-gray-200 mt-1" dangerouslySetInnerHTML={{__html: item.caption}} />
            )}
          </span>
        )}
        {showHoverCaption && (
          <span class="absolute inset-0 flex items-end p-4 bg-black/0 group-hover:bg-black/60 transition-colors duration-300">
            <span class="block text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{__html: item.caption || item.title}} />
          </span>
        )}
      </button>
    </figure>
  );
}

function JustifiedView({items, design, openLightbox, gapClass, sizes}) {
  const rowHeight = Math.max(120, Math.min(640, design.row_height || 240));
  return (
    <div class={`hbx-gallery-justified flex flex-wrap ${gapClass}`}>
      {items.map((item, i) => (
        <JustifiedTile
          key={i}
          item={item}
          rowHeight={rowHeight}
          onClick={() => openLightbox(i)}
          captionPosition={design.caption_position || "below"}
          hoverZoom={design.hover_zoom !== false}
          sizes={sizes}
          lightbox={design.lightbox !== false}
        />
      ))}
    </div>
  );
}

/* Carousel — horizontal scroll-snap strip. CSS does the snap, optional prev/next
   buttons (desktop only — touch users swipe natively). */
function CarouselTile({item, basisClass, onClick, aspectClass, captionPosition, hoverZoom, sizes, lightbox}) {
  const [loaded, setLoaded] = useState(false);
  const imgClass = loaded
    ? "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100"
    : "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0";
  const hoverImgClass = hoverZoom ? "transition-transform duration-500 group-hover:scale-105" : "";

  const showOverlay = captionPosition === "overlay" && (item.caption || item.title);
  const showHoverCaption = captionPosition === "hover" && (item.caption || item.title);

  return (
    <figure class={`hbx-gallery-carousel-item snap-start shrink-0 ${basisClass} group`}>
      <button
        type="button"
        onClick={onClick}
        class={`relative block w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${aspectClass}`}
        aria-label={lightbox ? `Open image: ${item.alt || item.caption || ""}` : item.alt || item.caption || "Image"}
      >
        <span
          class="hbx-gallery-tile-lqip absolute inset-0 w-full h-full"
          style={item.lqip ? `background-image: url("${item.lqip}")` : ""}
          aria-hidden="true"
        />
        <img
          src={item.src}
          srcset={item.srcset}
          sizes={sizes}
          width={item.width}
          height={item.height}
          alt={item.alt || ""}
          loading="lazy"
          decoding="async"
          class={`${imgClass} ${hoverImgClass}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        {showOverlay && (
          <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 text-left">
            <span class="block text-sm font-semibold text-white" dangerouslySetInnerHTML={{__html: item.title || item.caption}} />
            {item.title && item.caption && (
              <span class="block text-xs text-gray-200 mt-1" dangerouslySetInnerHTML={{__html: item.caption}} />
            )}
          </span>
        )}
        {showHoverCaption && (
          <span class="absolute inset-0 flex items-end p-4 bg-black/0 group-hover:bg-black/60 transition-colors duration-300">
            <span class="block text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{__html: item.caption || item.title}} />
          </span>
        )}
      </button>
      {captionPosition === "below" && (item.caption || item.title) && (
        <figcaption class="pt-2 text-sm text-gray-600 dark:text-gray-400">
          {item.title && (
            <span class="font-semibold text-gray-900 dark:text-white" dangerouslySetInnerHTML={{__html: item.title}} />
          )}
          {item.title && item.caption && " — "}
          {item.caption && <span dangerouslySetInnerHTML={{__html: item.caption}} />}
        </figcaption>
      )}
    </figure>
  );
}

function CarouselView({items, design, openLightbox, gapClass, aspectClass, sizes, columns}) {
  const scrollRef = useRef(null);
  const basisClass = CAROUSEL_BASIS[columns] || CAROUSEL_BASIS[3];

  const scrollByItem = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const tile = el.querySelector(".hbx-gallery-carousel-item");
    const step = tile ? tile.clientWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({left: dir * step, behavior: "smooth"});
  }, []);

  return (
    <div class="relative">
      <div
        ref={scrollRef}
        class={`hbx-gallery-carousel flex overflow-x-auto snap-x snap-mandatory scroll-pl-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-2 ${gapClass}`}
      >
        {items.map((item, i) => (
          <CarouselTile
            key={i}
            item={item}
            basisClass={basisClass}
            aspectClass={aspectClass}
            onClick={() => openLightbox(i)}
            captionPosition={design.caption_position || "below"}
            hoverZoom={design.hover_zoom !== false}
            sizes={sizes}
            lightbox={design.lightbox !== false}
          />
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollByItem(-1)}
            class="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            aria-label="Scroll previous"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByItem(1)}
            class="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            aria-label="Scroll next"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/* Slideshow — single image at a time, dots + arrows + optional autoplay with
   pause-on-hover. Touch swipe reuses the lightbox's gesture handling. */
function SlideshowView({items, design, openLightbox, aspectClass, sizes}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef({x: 0, y: 0, t: 0});

  const autoplay = !!design.autoplay;
  const interval = Math.max(1000, design.autoplay_interval || 5000);

  const next = useCallback(() => setIndex((i) => (i + 1) % items.length), [items.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + items.length) % items.length), [items.length]);

  useEffect(() => {
    if (!autoplay || paused || items.length <= 1) return;
    const t = setTimeout(next, interval);
    return () => clearTimeout(t);
  }, [autoplay, paused, interval, index, next, items.length]);

  function onTouchStart(e) {
    const t = e.touches[0];
    touchStart.current = {x: t.clientX, y: t.clientY, t: Date.now()};
  }
  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) next();
      else prev();
    }
  }

  const item = items[index];
  const lightbox = design.lightbox !== false;
  const captionPosition = design.caption_position || "below";

  return (
    <div
      class="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div class={`relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 ${aspectClass}`}>
        {items.map((it, i) => (
          <div
            key={i}
            class={i === index ? "absolute inset-0 transition-opacity duration-500 opacity-100" : "absolute inset-0 transition-opacity duration-500 opacity-0 pointer-events-none"}
            aria-hidden={i === index ? "false" : "true"}
          >
            <span
              class="hbx-gallery-tile-lqip absolute inset-0 w-full h-full"
              style={it.lqip ? `background-image: url("${it.lqip}")` : ""}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => openLightbox(i)}
              class="absolute inset-0 w-full h-full block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
              aria-label={lightbox ? `Open image: ${it.alt || it.caption || ""}` : it.alt || it.caption || "Image"}
            >
              <img
                src={it.src}
                srcset={it.srcset}
                sizes={sizes}
                width={it.width}
                height={it.height}
                alt={it.alt || ""}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                class="absolute inset-0 w-full h-full object-cover"
              />
            </button>
            {captionPosition === "overlay" && (item.caption || item.title) && i === index && (
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 pointer-events-none">
                <div class="max-w-3xl mx-auto text-center">
                  <div class="text-base font-semibold text-white" dangerouslySetInnerHTML={{__html: it.title || it.caption}} />
                  {it.title && it.caption && (
                    <div class="text-sm text-gray-200 mt-1" dangerouslySetInnerHTML={{__html: it.caption}} />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              aria-label="Previous slide"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              aria-label="Next slide"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div class="flex items-center justify-center gap-2 mt-4">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              class={i === index ? "h-2 w-8 rounded-full bg-primary-600 dark:bg-primary-400 transition-all duration-300" : "h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-300"}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : "false"}
            />
          ))}
        </div>
      )}

      {captionPosition === "below" && (item.caption || item.title) && (
        <div class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          {item.title && (
            <div class="font-semibold text-gray-900 dark:text-white" dangerouslySetInnerHTML={{__html: item.title}} />
          )}
          {item.caption && <div dangerouslySetInnerHTML={{__html: item.caption}} />}
        </div>
      )}
    </div>
  );
}

function Lightbox({items, index, onClose, onPrev, onNext}) {
  const item = items[index];
  const touchStart = useRef({x: 0, y: 0, t: 0});

  // Body scroll lock while the lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  function onTouchStart(e) {
    const t = e.touches[0];
    touchStart.current = {x: t.clientX, y: t.clientY, t: Date.now()};
  }
  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) onNext();
      else onPrev();
    }
  }

  if (!item) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        class="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
        aria-label="Close"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            class="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
            aria-label="Previous image"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            class="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
            aria-label="Next image"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <figure class="relative flex flex-col items-center justify-center max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={item.src}
          srcset={item.srcset}
          sizes="95vw"
          alt={item.alt || ""}
          width={item.width}
          height={item.height}
          class="max-w-[95vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        />
        {(item.title || item.caption || item.credit || item.link) && (
          <figcaption class="hbx-gallery-lightbox-caption mt-4 text-center">
            {item.title && (
              <div class="text-base font-semibold" dangerouslySetInnerHTML={{__html: item.title}} />
            )}
            {item.caption && (
              <div class="text-sm mt-1" dangerouslySetInnerHTML={{__html: item.caption}} />
            )}
            {(item.credit || item.link) && (
              <div class="text-xs mt-2 text-gray-400">
                {item.credit && <span dangerouslySetInnerHTML={{__html: item.credit}} />}
                {item.credit && item.link && <span class="mx-2">·</span>}
                {item.link && (
                  <a href={item.link} class="underline hover:no-underline">
                    Open page →
                  </a>
                )}
              </div>
            )}
          </figcaption>
        )}
        {items.length > 1 && (
          <div class="absolute -top-10 left-0 text-xs text-gray-300 font-mono">
            {index + 1} / {items.length}
          </div>
        )}
      </figure>
    </div>
  );
}

export const GalleryBlock = ({content = {}, design = {}, items = []}) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const layout = design.layout || "grid";
  const columns = Math.max(1, Math.min(6, design.columns || 3));
  const gap = design.gap || "md";
  const captionPosition = design.caption_position || "below";
  const hoverZoom = design.hover_zoom !== false;
  const lightboxEnabled = design.lightbox !== false;
  const aspectRatio = design.aspect_ratio || "square";

  const openLightbox = useCallback(
    (i) => {
      if (lightboxEnabled) {
        setLightboxIndex(i);
      } else if (items[i] && items[i].link) {
        window.location.href = items[i].link;
      }
    },
    [lightboxEnabled, items],
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const nextLightbox = useCallback(() => setLightboxIndex((i) => (i == null ? null : (i + 1) % items.length)), [items.length]);
  const prevLightbox = useCallback(() => setLightboxIndex((i) => (i == null ? null : (i - 1 + items.length) % items.length)), [items.length]);

  if (!items || items.length === 0) {
    return (
      <div class="py-12 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Gallery has no images. Add `items[]` or set `album` to a folder under `assets/`.
      </div>
    );
  }

  const sizes = layout === "masonry" ? SIZES_DEFAULT_MASONRY : SIZES_DEFAULT_GRID;
  // Slideshow defaults to a wide aspect when the user hasn't picked one — it
  // looks more presentational than the square grid default.
  const slideshowAspect = design.aspect_ratio || (layout === "slideshow" ? "wide" : "square");
  const aspectClass = ASPECT_CLASS[layout === "slideshow" ? slideshowAspect : aspectRatio] || ASPECT_CLASS.square;
  const gridClass = GRID_COLS[columns] || GRID_COLS[3];
  const masonryClass = MASONRY_COLS[columns] || MASONRY_COLS[3];
  const gapClass = GAP_CLASS[gap] || GAP_CLASS.md;
  const masonryGapClass = MASONRY_GAP_CLASS[gap] || MASONRY_GAP_CLASS.md;

  let layoutEl;
  if (layout === "masonry") {
    layoutEl = (
      <div class={`hbx-gallery-masonry ${masonryClass} ${gapClass} ${masonryGapClass}`}>
        {items.map((item, i) => (
          <MasonryTile
            key={i}
            item={item}
            onClick={() => openLightbox(i)}
            captionPosition={captionPosition}
            hoverZoom={hoverZoom}
            sizes={sizes}
            lightbox={lightboxEnabled}
          />
        ))}
      </div>
    );
  } else if (layout === "justified") {
    layoutEl = <JustifiedView items={items} design={design} openLightbox={openLightbox} gapClass={gapClass} sizes={sizes} />;
  } else if (layout === "carousel") {
    layoutEl = (
      <CarouselView
        items={items}
        design={design}
        openLightbox={openLightbox}
        gapClass={gapClass}
        aspectClass={aspectClass}
        sizes={sizes}
        columns={columns}
      />
    );
  } else if (layout === "slideshow") {
    layoutEl = <SlideshowView items={items} design={design} openLightbox={openLightbox} aspectClass={aspectClass} sizes={sizes} />;
  } else {
    layoutEl = (
      <div class={`grid ${gridClass} ${gapClass}`}>
        {items.map((item, i) => (
          <GridTile
            key={i}
            item={item}
            onClick={() => openLightbox(i)}
            aspectClass={aspectClass}
            captionPosition={captionPosition}
            hoverZoom={hoverZoom}
            sizes={sizes}
            lightbox={lightboxEnabled}
          />
        ))}
      </div>
    );
  }

  return (
    <div class="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        {(content.title || content.subtitle) && (
          <div class="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            {content.title && (
              <h2
                class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4"
                dangerouslySetInnerHTML={{__html: renderInline(content.title)}}
              />
            )}
            {content.subtitle && (
              <p
                class="text-xl text-primary-600 dark:text-primary-400 font-medium mb-3"
                dangerouslySetInnerHTML={{__html: renderInline(content.subtitle)}}
              />
            )}
          </div>
        )}

        {layoutEl}
      </div>

      {/* Portal the lightbox to <body> so it escapes the page section's
          `isolation: isolate` stacking context — without this, the next
          section in document order paints over the lightbox. */}
      {lightboxIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <Lightbox items={items} index={lightboxIndex} onClose={closeLightbox} onPrev={prevLightbox} onNext={nextLightbox} />,
          document.body,
        )}
    </div>
  );
};
