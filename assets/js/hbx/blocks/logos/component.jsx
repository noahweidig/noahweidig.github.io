import {Icon} from "../../shared/components/Icon.jsx";

const MARQUEE_CSS = `
@keyframes hbx-logos-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.hbx-logos-track {
  animation: hbx-logos-marquee var(--hbx-marquee-dur, 30s) linear infinite;
  will-change: transform;
}
.hbx-logos-track:hover { animation-play-state: paused; }
`;

// Slot widths keep every logo at a consistent visual footprint regardless of SVG aspect ratio
const SLOT_W = {sm: "w-24", md: "w-32", lg: "w-40"};
// Max-width caps very wide SVGs inside their slot (height × ~2.5)
const MAX_W = {sm: "3.5rem", md: "5rem", lg: "7rem"};
// Heights passed as inline style so Icon.jsx's auto-sizing fires correctly
const HEIGHT = {sm: "1.75rem", md: "2.5rem", lg: "3.5rem"};

// Full-string Tailwind filter classes — no dynamic concatenation
const FILTER = {
  grayscale: "grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300",
  white: "brightness-0 invert transition-all duration-300",
  color: "transition-all duration-300",
};

function renderText(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function LogoItem({item, idx, logoStyle, logoSize, icon_svgs, item_images, padY = "py-3"}) {
  const iconSvg = item.icon ? (icon_svgs?.[item.icon] ?? null) : null;
  const imgData = item_images?.[String(idx)] ?? null;
  const height = HEIGHT[logoSize] ?? HEIGHT.md;
  const maxW = MAX_W[logoSize] ?? MAX_W.md;
  const slotW = SLOT_W[logoSize] ?? SLOT_W.md;

  // Per-item overrides: style and scale
  const itemStyle = item.style ?? logoStyle;
  const filter = FILTER[itemStyle] ?? FILTER.grayscale;
  // scale: compensates for SVG intrinsic whitespace or atypical artwork areas.
  // e.g. scale: 1.3 enlarges a logo whose SVG has excessive padding baked into its viewBox.
  const scale = typeof item.scale === "number" ? item.scale : 1;
  const scaleStyle = scale !== 1 ? `;transform:scale(${scale})` : "";

  let visual;
  if (iconSvg) {
    visual = (
      <Icon
        svg={iconSvg}
        attributes={{
          class: `inline-block ${filter}`,
          style: `height:${height};max-width:${maxW}${scaleStyle}`,
          title: item.name || undefined,
        }}
      />
    );
  } else if (imgData) {
    visual = (
      <img
        src={imgData.src}
        alt={item.name || ""}
        class={`object-contain ${filter}`}
        style={`height:${height};width:auto;max-width:${maxW}${scaleStyle}`}
      />
    );
  } else if (item.name) {
    visual = <span class="font-semibold text-gray-400 dark:text-gray-500 text-sm">{item.name}</span>;
  } else {
    return null;
  }

  const isExt = item.url && (item.url.startsWith("http://") || item.url.startsWith("https://"));
  // Fixed-width slot: every logo occupies the same footprint → consistent visual weight
  const cls = `flex items-center justify-center flex-shrink-0 ${slotW} ${padY}`;

  return item.url ? (
    <a href={item.url} class={cls} aria-label={item.name || undefined} {...(isExt ? {target: "_blank", rel: "noopener noreferrer"} : {})}>
      {visual}
    </a>
  ) : (
    <div class={cls} role="img" aria-label={item.name || undefined}>
      {visual}
    </div>
  );
}

function LogoRow({items, logoStyle, logoSize, icon_svgs, item_images}) {
  return (
    <div class="flex flex-wrap items-center justify-center">
      {items.map((item, i) => (
        <LogoItem key={i} item={item} idx={i} logoStyle={logoStyle} logoSize={logoSize} icon_svgs={icon_svgs} item_images={item_images} />
      ))}
    </div>
  );
}

function LogoGrid({items, logoStyle, logoSize, icon_svgs, item_images}) {
  const cols =
    items.length <= 3
      ? "grid-cols-3"
      : items.length <= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : items.length <= 6
          ? "grid-cols-3 sm:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
  return (
    <div class={`grid ${cols} gap-6 items-center`}>
      {items.map((item, i) => (
        <LogoItem key={i} item={item} idx={i} logoStyle={logoStyle} logoSize={logoSize} icon_svgs={icon_svgs} item_images={item_images} />
      ))}
    </div>
  );
}

function LogoMarquee({items, logoStyle, logoSize, icon_svgs, item_images, speed}) {
  const doubled = [...items, ...items];
  return (
    <>
      <style>{MARQUEE_CSS}</style>
      {/*
        mask-image fades edges without depending on the section background colour —
        works on any bg (white, gray-50, dark, gradient, etc.)
      */}
      <div class="overflow-hidden" style="mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent)">
        <div class="hbx-logos-track flex w-max items-center" style={`--hbx-marquee-dur:${speed ?? 30}s`}>
          {doubled.map((item, i) => (
            <LogoItem
              key={i}
              item={item}
              idx={i % items.length}
              logoStyle={logoStyle}
              logoSize={logoSize}
              icon_svgs={icon_svgs}
              item_images={item_images}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export const LogosBlock = ({content = {}, design = {}, icon_svgs = {}, item_images = {}}) => {
  const rawItems = Array.isArray(content.items) ? content.items : Array.isArray(content.logos) ? content.logos : [];

  const {title, subtitle, cta} = content;
  const layout = design.layout || design.display_mode || "row";
  const logoStyle = design.logo_style || "grayscale";
  const logoSize = design.logo_size || "md";
  const speed = design.marquee_speed ?? 30;

  const isExtCta = cta?.url && (cta.url.startsWith("http://") || cta.url.startsWith("https://"));

  return (
    <div class="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        {(title || subtitle) && (
          <div class="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            {title && (
              <h2
                class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4"
                dangerouslySetInnerHTML={{__html: renderText(title)}}
              />
            )}
            {subtitle && (
              <p
                class="text-xl text-primary-600 dark:text-primary-400 font-medium mb-3"
                dangerouslySetInnerHTML={{__html: renderText(subtitle)}}
              />
            )}
          </div>
        )}

        {layout === "marquee" && (
          <LogoMarquee items={rawItems} logoStyle={logoStyle} logoSize={logoSize} icon_svgs={icon_svgs} item_images={item_images} speed={speed} />
        )}
        {layout === "grid" && <LogoGrid items={rawItems} logoStyle={logoStyle} logoSize={logoSize} icon_svgs={icon_svgs} item_images={item_images} />}
        {layout !== "marquee" && layout !== "grid" && (
          <LogoRow items={rawItems} logoStyle={logoStyle} logoSize={logoSize} icon_svgs={icon_svgs} item_images={item_images} />
        )}

        {cta?.text && cta?.url && (
          <div class="mt-6 text-center">
            <a
              href={cta.url}
              {...(isExtCta ? {target: "_blank", rel: "noopener noreferrer"} : {})}
              class="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {cta.text}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
