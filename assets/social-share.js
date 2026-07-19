// Rewrites the social-share extension's buttons to point at the *current*
// page. The quarto-social-share filter bakes a single static `permalink` at
// render time, which can't vary per page across the whole site, so we rebuild
// each share link from window.location on load instead.
(function () {
  function build() {
    var containers = document.querySelectorAll(".social-share");
    if (!containers.length) return;

    var url = window.location.href.split("#")[0];
    var title = document.title || "";
    var u = encodeURIComponent(url);
    var t = encodeURIComponent(title);

    var templates = {
      twitter: "https://x.com/intent/post?url=" + u + "&text=" + t,
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + u,
      facebook: "https://www.facebook.com/sharer.php?u=" + u,
      reddit: "https://reddit.com/submit?url=" + u + "&title=" + t,
      tumblr: "https://www.tumblr.com/share/link?url=" + u + "&name=" + t,
      stumbleupon: "https://www.stumbleupon.com/submit?url=" + u + "&title=" + t,
      bsky: "https://bsky.app/intent/compose?text=" + t + "%20" + u,
      email: "mailto:?subject=" + t + "&body=Check%20out%20this%20link:%20" + u
    };

    containers.forEach(function (c) {
      Object.keys(templates).forEach(function (cls) {
        c.querySelectorAll("a." + cls).forEach(function (a) {
          a.setAttribute("href", templates[cls]);
        });
      });
    });

    relocate(containers);
  }

  // The Lua filter injects the share markup `after-body`, which lands *after*
  // the page footer. Move each block to just before the footer (bottom of the
  // page content) and prepend a "Share on:" label.
  function relocate(containers) {
    var footer = document.querySelector("#quarto-footer") ||
      document.querySelector("footer.footer");
    if (!footer) return;

    containers.forEach(function (c) {
      if (c.dataset.relocated) return;
      c.dataset.relocated = "1";

      if (!c.querySelector(".social-share-label")) {
        var label = document.createElement("div");
        label.className = "social-share-label";
        label.textContent = "Share on:";
        c.insertBefore(label, c.firstChild);
      }

      // Move the outer wrapper the filter created (falls back to the container).
      var block = c.parentElement && c.parentElement !== document.body
        ? c.parentElement
        : c;
      footer.parentNode.insertBefore(block, footer);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
