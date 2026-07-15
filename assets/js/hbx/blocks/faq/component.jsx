import {useState} from "preact/hooks";
import {Icon} from "../../shared/components/Icon.jsx";

const PLUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5h-5.5a.75.75 0 010-1.5h5.5v-5.5A.75.75 0 0110 3z" clip-rule="evenodd"/></svg>`;

function renderInline(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /`(.*?)`/g,
      '<code class="px-1.5 py-0.5 rounded font-mono text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">$1</code>',
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-primary-600 dark:text-primary-400 underline underline-offset-2 hover:text-primary-700 dark:hover:text-primary-300">$1</a>',
    );
}

function renderRich(text) {
  if (!text) return "";
  const paras = String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => `<p${i > 0 ? ' class="mt-3"' : ""}>${renderInline(p)}</p>`);
  return paras.join("");
}

function FaqItem({item, isOpen, onToggle}) {
  const question = item.question ?? item.title ?? "";
  const answer = item.answer ?? item.text ?? "";

  return (
    <div class="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        type="button"
        class="w-full py-5 px-6 flex items-start justify-between gap-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800/50"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span
          class="font-semibold text-gray-900 dark:text-white text-base sm:text-lg leading-snug"
          dangerouslySetInnerHTML={{__html: renderInline(question)}}
        />
        <span
          class={`mt-0.5 flex-shrink-0 h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center transition-transform duration-300 ease-out ${isOpen ? "rotate-45" : ""}`}
        >
          <span
            class="h-3.5 w-3.5 text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400"
            dangerouslySetInnerHTML={{__html: PLUS_SVG}}
          />
        </span>
      </button>

      {/* CSS grid trick: grid-rows transition from 0fr → 1fr animates from 0 height to natural height */}
      <div class={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div class="overflow-hidden">
          <div
            class="px-6 pb-6 text-gray-600 dark:text-gray-300 leading-relaxed text-sm sm:text-base"
            dangerouslySetInnerHTML={{__html: renderRich(answer)}}
          />
        </div>
      </div>
    </div>
  );
}

export const FaqBlock = ({content = {}, icon_svgs = {}, button_icon_svg}) => {
  const {title, subtitle, text, items = [], button = {}} = content;
  const [openIdx, setOpenIdx] = useState(null);

  const buttonIconSvg = button_icon_svg ?? (button.icon ? icon_svgs?.[button.icon] : null);
  const isExtBtn = button.url && (button.url.startsWith("http://") || button.url.startsWith("https://"));

  return (
    <div class="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        {(title || subtitle) && (
          <div class="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            {title && (
              <h2
                class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4"
                dangerouslySetInnerHTML={{__html: renderInline(title)}}
              />
            )}
            {subtitle && (
              <p
                class="text-xl text-primary-600 dark:text-primary-400 font-medium mb-3"
                dangerouslySetInnerHTML={{__html: renderInline(subtitle)}}
              />
            )}
          </div>
        )}

        {text && (
          <div class="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto" dangerouslySetInnerHTML={{__html: renderRich(text)}} />
        )}

        {items.length > 0 && (
          <div class="rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
            {items.map((item, i) => (
              <FaqItem key={i} item={item} isOpen={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
            ))}
          </div>
        )}

        {button.text && button.url && (
          <div class="mt-10 text-center">
            <a
              href={button.url}
              {...(isExtBtn ? {target: "_blank", rel: "noopener noreferrer"} : {})}
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {button.text}
              {buttonIconSvg && <Icon svg={buttonIconSvg} attributes={{class: "inline-block", style: "height:1rem;width:auto"}} />}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
