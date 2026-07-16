// The theme toggle is an <a href="">; stop it from navigating (which jumps to the top).
document.addEventListener(
  "click",
  function (e) {
    if (e.target.closest && e.target.closest(".quarto-color-scheme-toggle")) {
      e.preventDefault();
    }
  },
  true
);

// Subtle back-to-top button, shown after scrolling down a bit.
(function () {
  var btn = document.createElement("button");
  btn.className = "nw-top";
  btn.type = "button";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.body.appendChild(btn);
  var onScroll = function () {
    btn.classList.toggle("show", window.scrollY > 600);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

// Project/award detail pages: surface the page's featured image below the title.
(function () {
  if (!/\/(projects|awards)\/[^/]+\/(index\.html)?$/.test(location.pathname)) return;
  var meta = document.querySelector('meta[property="og:image"]');
  var header = document.getElementById("title-block-header");
  if (!meta || !header || document.querySelector(".nw-detail-hero")) return;
  var img = document.createElement("img");
  try {
    img.src = new URL(meta.content, location.href).pathname;
  } catch (e) {
    img.src = meta.content;
  }
  img.alt = "";
  img.className = "nw-detail-hero";
  header.insertAdjacentElement("afterend", img);
})();
