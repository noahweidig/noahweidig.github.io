// Landing-page interactivity: typewriter, project filters, marquee duplication.
(function () {
  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Typewriter. Under reduced motion the first string is rendered statically
  // instead of being typed, so the heading never animates its text.
  var el = document.querySelector("#hero .nw-typed");
  if (el && reducedMotion) {
    el.textContent = (JSON.parse(el.dataset.strings || "[]")[0]) || "";
  } else if (el) {
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

  // Hero headline: scale line 1 ("Spatial Analysis.") so it renders exactly as
  // wide as line 2 ("Real Insights."). The ratio depends on the loaded font, so
  // it is measured rather than hard-coded: reset the scale to 1, measure both
  // lines with a Range (block spans stretch to the container, so their own
  // width says nothing), then store w2/w1 as --nw-l1-fit. The stylesheet only
  // consumes the variable at >=768px, so mobile is untouched.
  function setUpHeadlineFit() {
    var heroH1 = document.querySelector("#hero h1");
    var l1 = heroH1?.querySelector(".nw-line-1");
    var l2 = heroH1?.querySelector(".nw-line-2");
    if (!l1 || !l2 || !document.createRange) return;

    var textWidth = function (node) {
      var r = document.createRange();
      r.selectNodeContents(node);
      return r.getBoundingClientRect().width;
    };
    var fitHeadline = function () {
      heroH1.style.setProperty("--nw-l1-fit", "1");
      var fit = 1;
      // A couple of correction passes absorb the small non-proportional part
      // of text width (hinting, subpixel rounding); it converges immediately.
      for (var i = 0; i < 3; i++) {
        var w1 = textWidth(l1), w2 = textWidth(l2);
        if (!(w1 > 0 && w2 > 0)) {
          heroH1.style.removeProperty("--nw-l1-fit");
          return;
        }
        fit = fit * w2 / w1;
        heroH1.style.setProperty("--nw-l1-fit", String(fit));
      }
    };

    fitHeadline();
    if (document.fonts) document.fonts.ready.then(fitHeadline);
    var fitTimer;
    window.addEventListener("resize", function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitHeadline, 150);
    });
  }
  setUpHeadlineFit();

  // Duplicate marquee content so the loop is seamless: the `nw-scroll`
  // keyframe translates by -50%, which only lines up if the row is exactly
  // doubled. The copy is decoration — hide it from assistive tech and take it
  // out of the tab order so the logos aren't announced (or tabbed through)
  // twice. `aria-hidden` goes on each appended child because the children are
  // flex items of the track and can't be wrapped without breaking layout.
  document.querySelectorAll(".nw-marquee-track").forEach(function (track) {
    var copies = Array.prototype.map.call(track.children, function (child) {
      var clone = child.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      if (clone.tagName === "A") clone.tabIndex = -1;
      clone.querySelectorAll("a, button, input, [tabindex]").forEach(function (f) {
        f.tabIndex = -1;
      });
      return clone;
    });
    copies.forEach(function (clone) { track.appendChild(clone); });
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
    // The bar is a labelled group of toggle buttons, and filtering changes the
    // grid without moving focus — so the result count is announced through a
    // live region, the same pattern the contact form status uses.
    bar.setAttribute("role", "group");
    if (!bar.getAttribute("aria-label")) bar.setAttribute("aria-label", "Filter by category");
    var noun = bar.dataset.nwFilterNoun || "items";
    var status = document.createElement("p");
    status.className = "nw-sr-only nw-filter-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    bar.after(status);

    var mk = function (label, cat) {
      var b = document.createElement("button");
      // Explicit, so dropping the bar inside a <form> later can't turn every
      // filter click into a submit (createElement defaults to type="submit").
      b.type = "button";
      b.textContent = label;
      // The category lives on the element, not in the label text, so deep
      // links keep working if the visible label is ever reformatted.
      if (cat) b.dataset.cat = cat;
      b.setAttribute("aria-pressed", "false");
      b.onclick = function () {
        bar.querySelectorAll("button").forEach(function (x) {
          x.classList.remove("active");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("active");
        b.setAttribute("aria-pressed", "true");
        var shown = 0, total = 0;
        cards().forEach(function (c) {
          var show = !cat || (c.dataset.cats || "").split("|").indexOf(cat) !== -1;
          (c.closest(".nw-proj-wrap") || c).style.display = show ? "" : "none";
          total++;
          if (show) shown++;
        });
        status.textContent = "Showing " + shown + " of " + total + " " + noun +
          (cat ? " in " + label : "");
      };
      bar.appendChild(b);
      return b;
    };
    var all = mk("All", null);
    all.classList.add("active");
    all.setAttribute("aria-pressed", "true");
    Array.from(cats).sort().forEach(function (c) { mk(c, c); });

    // Deep link: #category=X (used by tags on detail pages)
    var m = location.hash.match(/category=([^&]*)/);
    if (m) {
      var want = decodeURIComponent(m[1].replace(/\+/g, " "));
      bar.querySelectorAll("button[data-cat]").forEach(function (b) {
        if (b.dataset.cat === want) b.click();
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

  // Scroll reveal: fade sections' items in as they enter the viewport.
  // Elements already on screen at load are never hidden, so first paint (and
  // the LCP element) is identical with or without this — Lighthouse-safe.
  if (!reducedMotion && "IntersectionObserver" in window) {
    var revealables = document.querySelectorAll(
      ".nw-section .nw-title, .nw-section .nw-subtitle, .nw-section .nw-lead, " +
        ".nw-stat, .nw-card, .nw-proj-wrap, .nw-cite, .nw-post, " +
        ".nw-tl-item, .nw-award, .nw-faq details, .nw-contact-card, .nw-globe-wrap, " +
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
