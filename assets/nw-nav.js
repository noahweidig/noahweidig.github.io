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

// Project/award detail pages: surface the page's featured image below the title.
(function () {
  if (!/\/awards\/[^/]+\/(index\.html)?$/.test(location.pathname)) return;
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
