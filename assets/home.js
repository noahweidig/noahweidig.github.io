// Landing-page interactivity: typewriter, project filters, marquee duplication.
(function () {
  // Typewriter
  var el = document.querySelector("#hero .nw-typed");
  if (el) {
    var strings = JSON.parse(el.dataset.strings || "[]");
    var typeSpeed = 70, deleteSpeed = 40, pauseTime = 2500;
    var idx = 0, pos = 0, deleting = false;
    (function tick() {
      var s = strings[idx] || "";
      el.textContent = s.slice(0, pos);
      if (!deleting && pos < s.length) {
        pos++;
        setTimeout(tick, typeSpeed);
      } else if (!deleting) {
        deleting = true;
        setTimeout(tick, pauseTime);
      } else if (pos > 0) {
        pos--;
        setTimeout(tick, deleteSpeed);
      } else {
        deleting = false;
        idx = (idx + 1) % strings.length;
        setTimeout(tick, 400);
      }
    })();
  }

  // Duplicate marquee content so the loop is seamless
  document.querySelectorAll(".nw-marquee-track").forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  // Category filter buttons for card grids (projects, publications)
  document.querySelectorAll("[data-nw-filter-for]").forEach(function (bar) {
    var grid = document.getElementById(bar.dataset.nwFilterFor) ||
      document.getElementById("listing-" + bar.dataset.nwFilterFor);
    if (!grid) return;
    var cards = function () {
      return grid.querySelectorAll("[data-cats]");
    };
    // Build buttons from the categories present in the grid
    var cats = new Set();
    cards().forEach(function (c) {
      (c.dataset.cats || "").split("|").filter(Boolean).forEach(function (t) { cats.add(t); });
    });
    var mk = function (label, cat) {
      var b = document.createElement("button");
      b.textContent = label;
      b.onclick = function () {
        bar.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        cards().forEach(function (c) {
          var show = !cat || (c.dataset.cats || "").split("|").indexOf(cat) !== -1;
          (c.closest(".nw-proj-wrap") || c).style.display = show ? "" : "none";
        });
      };
      bar.appendChild(b);
      return b;
    };
    mk("All", null).classList.add("active");
    Array.from(cats).sort().forEach(function (c) { mk(c, c); });

    // Deep link: #category=X (used by tags on detail pages)
    var m = location.hash.match(/category=([^&]*)/);
    if (m) {
      var want = decodeURIComponent(m[1].replace(/\+/g, " "));
      bar.querySelectorAll("button").forEach(function (b) {
        if (b.textContent === want) b.click();
      });
    }
  });

  // Contact form: submit to Formspree via fetch, no page reload
  var form = document.querySelector("form.nw-form");
  if (form) {
    var status = form.querySelector(".nw-form-status");
    var show = function (msg, ok) {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle("ok", ok);
      status.classList.toggle("err", !ok);
      status.hidden = false;
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            show("Thanks! Your message has been sent.", true);
            return;
          }
          return res.json().then(function (data) {
            var msg = (data.errors || []).map(function (err) { return err.message; }).join(", ");
            show(msg || "Oops! Something went wrong — please try again.", false);
          });
        })
        .catch(function () {
          show("Network error — please try again, or email me directly.", false);
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });
  }

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hero topography parallax: track the cursor and expose it as -0.5..0.5
  // custom properties; CSS translates the two contour layers from them.
  var hero = document.getElementById("hero");
  if (
    hero &&
    !reducedMotion &&
    window.matchMedia &&
    window.matchMedia("(pointer: fine)").matches
  ) {
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--nw-px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty("--nw-py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    hero.addEventListener("mouseleave", function () {
      hero.style.setProperty("--nw-px", 0);
      hero.style.setProperty("--nw-py", 0);
    });
  }

  // Scroll reveal: fade sections' items in as they enter the viewport.
  // Elements already on screen at load are never hidden, so first paint (and
  // the LCP element) is identical with or without this — Lighthouse-safe.
  if (!reducedMotion && "IntersectionObserver" in window) {
    var revealables = document.querySelectorAll(
      ".nw-section .nw-title, .nw-section .nw-subtitle, .nw-section .nw-lead, " +
        ".nw-stat, .nw-card, .nw-proj-wrap, .nw-cite, .nw-post, .nw-stack-cat, " +
        ".nw-tl-item, .nw-award, .nw-faq details, .nw-contact, .nw-map, " +
        ".nw-cta-card, .nw-marquee"
    );
    var fold = window.innerHeight;
    var below = [];
    revealables.forEach(function (el) {
      if (el.getBoundingClientRect().top >= fold) below.push(el);
    });
    if (below.length) {
      var io = new IntersectionObserver(
        function (entries) {
          // Stagger items that arrive in the same batch (capped so trailing
          // cards in big grids don't lag behind the scroll)
          var delay = 0;
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.style.transitionDelay = delay + "ms";
            entry.target.classList.add("nw-in");
            io.unobserve(entry.target);
            delay = Math.min(delay + 70, 280);
          });
        },
        { rootMargin: "0px 0px -8% 0px" }
      );
      below.forEach(function (el) {
        el.classList.add("nw-reveal");
        io.observe(el);
      });
    }
  }
})();
