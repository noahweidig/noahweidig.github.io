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

// Detail pages: Quarto points title-block category tags at whichever listing
// the visitor came from (often the home page, where they do nothing). Send
// them to the section listing's filter instead. quarto.js injects its links
// asynchronously after fetching listings.json, so retarget on every DOM
// change to the title block rather than just once at load.
(function () {
  var m = location.pathname.match(/^\/(projects|publications|awards|blog)\//);
  if (!m) return;
  var retarget = function () {
    document.querySelectorAll(".quarto-title .quarto-category").forEach(function (el) {
      var cat = el.textContent.trim();
      var href = "/" + m[1] + "/#category=" + encodeURIComponent(cat);
      var parent = el.closest("a");
      if (parent) parent.href = href;
      el.querySelectorAll("a").forEach(function (a) {
        a.href = href;
      });
      if (!parent && !el.querySelector("a")) {
        var a = document.createElement("a");
        a.href = href;
        while (el.firstChild) a.appendChild(el.firstChild);
        el.appendChild(a);
      }
    });
  };
  retarget();
  var header = document.getElementById("title-block-header");
  if (header) {
    new MutationObserver(retarget).observe(header, { childList: true, subtree: true });
  }
})();

// CV page: trigger the browser print dialog from the "Print / Save as PDF"
// button. Bound in JS (capture phase) rather than an inline onclick so it
// fires reliably and beats any ancestor <a> that might otherwise navigate.
document.addEventListener(
  "click",
  function (e) {
    var btn = e.target.closest && e.target.closest(".nw-cv-print");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.print();
  },
  true
);

// CV page: defensively unwrap any anchor that ends up wrapping the CV header
// or body, so the top section (name, contact, Print/Résumé buttons) is never
// turned into one giant link.
(function () {
  var cv = document.querySelector(".nw-cv");
  if (!cv) return;
  [cv, cv.querySelector(".nw-cv-header")].forEach(function (el) {
    if (!el) return;
    var a = el.closest("a");
    if (a && a.parentNode) {
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      a.parentNode.removeChild(a);
    }
  });
})();

// Subtle back-to-top button, shown after scrolling down a bit.
(function () {
  var btn = document.createElement("button");
  btn.className = "nw-top";
  btn.type = "button";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  // An explicit `behavior: "smooth"` overrides the CSS `scroll-behavior: auto`
  // set under reduced motion, so check the preference here too (live, rather
  // than cached, so a mid-session change to the setting is respected).
  btn.addEventListener("click", function () {
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  document.body.appendChild(btn);
  // Read scrollY inside rAF so the toggle doesn't force a synchronous reflow
  // mid-scroll (headroom.js invalidates layout in the same scroll events).
  var ticking = false;
  var onScroll = function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      btn.classList.toggle("show", window.scrollY > 600);
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

// Mobile hamburger menu: close after clicking a nav item, or when clicking outside it.
(function () {
  var collapseEl = document.querySelector(".navbar-collapse");
  var toggler = document.querySelector(".navbar-toggler");
  if (!collapseEl) return;

  function closeMenu() {
    if (!collapseEl.classList.contains("show")) return;
    if (window.bootstrap && window.bootstrap.Collapse) {
      window.bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false }).hide();
    } else {
      collapseEl.classList.remove("show");
    }
  }

  collapseEl.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a")) closeMenu();
  });

  document.addEventListener(
    "click",
    function (e) {
      if (!collapseEl.classList.contains("show")) return;
      if (collapseEl.contains(e.target)) return;
      if (toggler && toggler.contains(e.target)) return;
      closeMenu();
    },
    true
  );
})();

// Publication detail pages: the auto-generated `description` (a truncated
// abstract, used for SEO/share meta) also renders as the visible subtitle,
// duplicating the "Abstract" section further down the page. Drop it.
(function () {
  if (!/^\/publications\/[^/]+\/(index\.html)?$/.test(location.pathname)) return;
  var sub = document.querySelector("#title-block-header .subtitle");
  if (sub) sub.remove();
})();

// Two accessibility defects in Quarto's own navbar markup, patched here rather
// than by forking the template.
//
//  * The brand logo link is named only by its <img alt>, and the site's CSS
//    hides that image at narrow widths — leaving the link with no accessible
//    name at all on mobile ("Links do not have a discernible name").
//  * The hamburger button carries role="menu", which is not a role a <button>
//    is allowed to take and which overrides its implicit button semantics.
//
// Neither change is visible; both are removed the moment Quarto fixes them
// upstream and this block is deleted.
(function () {
  var brand = document.querySelector("a.navbar-brand-logo");
  if (brand && !brand.getAttribute("aria-label")) {
    var img = brand.querySelector("img[alt]");
    brand.setAttribute("aria-label", (img && img.getAttribute("alt")) || "Home");
  }

  var toggler = document.querySelector("button.navbar-toggler[role='menu']");
  if (toggler) toggler.removeAttribute("role");
})();
