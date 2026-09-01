// Landing-page interactivity: typewriter, project filters, marquee duplication.
(function () {
  var reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Typewriter. Under reduced motion the first string is rendered statically
  // instead of being typed, so the heading never animates its text.
  var el = document.querySelector("#hero .nw-typed");
  if (el && reducedMotion) {
    el.textContent = JSON.parse(el.dataset.strings || "[]")[0] || "";
  } else if (el) {
    var strings = JSON.parse(el.dataset.strings || "[]");
    var typeSpeed = 70,
      deleteSpeed = 40,
      pauseTime = 2500;
    var idx = 0,
      pos = 0,
      deleting = false;
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

  // Nav bar's transparent-until-scroll toggle lives in nw-nav.js (global —
  // every page carries the same top band now, not just this one).

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
    copies.forEach(function (clone) {
      track.appendChild(clone);
    });

    // Both marquees scroll at the same speed rather than the same duration:
    // the CSS duration is fixed, so a longer strip (the tech stack carries
    // far more items than the affiliations) would race past at more than
    // twice the pace. Deriving the duration from the measured width of one
    // copy pins every marquee to NW_MARQUEE_PX_PER_SEC and keeps them in step
    // as items are added or removed.
    var copyWidth = track.scrollWidth / 2;
    if (copyWidth > 0) {
      track.style.animationDuration = copyWidth / 22 + "s";
    }
  });

  // Pause control for the marquees (WCAG 2.2.2: anything that moves for more
  // than five seconds needs a way to stop it). The CSS already pauses on hover
  // and focus-within, but neither is a mechanism a touch visitor has. Built
  // here rather than written into index.qmd so the button only exists when the
  // animation it controls does.
  var PAUSE_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>';
  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7l-11 7z"/></svg>';

  document.querySelectorAll(".nw-marquee").forEach(function (marquee) {
    if (!marquee.querySelector(".nw-marquee-track")) return;

    var name = marquee.getAttribute("aria-label") || "carousel";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nw-marquee-pause";
    btn.innerHTML = PAUSE_ICON;
    btn.setAttribute("aria-label", "Pause the " + name + " animation");

    btn.addEventListener("click", function () {
      var paused = marquee.toggleAttribute("data-nw-paused");
      btn.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
      btn.setAttribute("aria-label", (paused ? "Resume the " : "Pause the ") + name + " animation");
    });

    marquee.insertAdjacentElement("afterend", btn);
  });

  // FAQ behaves as an accordion: opening one entry closes the others, so the
  // list never grows tall enough to push the answer you just opened off
  // screen. `toggle` doesn't bubble, hence the per-details listener.
  document.querySelectorAll(".nw-faq").forEach(function (faq) {
    var items = faq.querySelectorAll("details");
    items.forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        items.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  });

  // Filter helpers. Neither closes over a particular bar, so they live out
  // here rather than being rebuilt per filter bar.
  var rowsIn = function (g) {
    return Array.from(g.querySelectorAll("[data-cats]"));
  };
  // A project card is filtered by hiding its wrapper, a citation row by hiding
  // itself — one predicate for both.
  var isShown = function (c) {
    return (c.closest(".nw-proj-wrap") || c).style.display !== "none";
  };

  // Category filter buttons for card grids (projects, publications)
  document.querySelectorAll("[data-nw-filter-for]").forEach(function (bar) {
    // One bar can drive several listings (publications splits its rows into a
    // featured journal-article section and everything else), so the attribute
    // takes a comma-separated list of listing ids.
    var grids = bar.dataset.nwFilterFor
      .split(",")
      .map(function (id) {
        id = id.trim();
        return document.getElementById(id) || document.getElementById("listing-" + id);
      })
      .filter(Boolean);
    if (!grids.length) return;
    var cards = function () {
      return grids.reduce(function (out, g) {
        return out.concat(rowsIn(g));
      }, []);
    };
    // The row directly under a section heading skips its own top border, or it
    // doubles the heading's underline. Filtered-out rows stay in the DOM at
    // display:none, so `:first-child` keeps pointing at a hidden row — mark the
    // first *visible* one instead and let the stylesheet key off the class.
    // `.nw-cites-marked` tells the stylesheet this is now under JS control.
    var markFirstVisible = function () {
      grids.forEach(function (g) {
        g.classList.add("nw-cites-marked");
        var seen = false;
        rowsIn(g).forEach(function (c) {
          c.classList.toggle("nw-cite-first", isShown(c) && !seen);
          if (isShown(c)) seen = true;
        });
      });
    };
    // A section whose every row is filtered out would otherwise leave a bare
    // heading behind. The CSS `:has()` rule can't do this: the rows are still
    // in the DOM, just display:none.
    var syncSections = function () {
      grids.forEach(function (g) {
        var section = g.closest(".nw-pub-section");
        if (section) section.hidden = !rowsIn(g).some(isShown);
      });
    };
    // Build buttons from the categories present in the grids
    var cats = new Set();
    cards().forEach(function (c) {
      (c.dataset.cats || "")
        .split("|")
        .filter(Boolean)
        .forEach(function (t) {
          cats.add(t);
        });
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
      // addEventListener rather than `onclick`, so a second handler (a future
      // analytics hook, another script) can never silently clobber this one.
      b.addEventListener("click", function () {
        apply(b, true);
      });
      bar.appendChild(b);
      return b;
    };

    // The one place a filter is actually applied: every entry point — a click,
    // the load-time deep link, Back and Forward — comes through here, so the
    // grid, the buttons, the announcement and the URL can never disagree.
    // `writeUrl` is false for the two paths where the URL is already right.
    var apply = function (b, writeUrl) {
      var cat = b.dataset.cat || null;
      var label = b.textContent;
      bar.querySelectorAll("button").forEach(function (x) {
        x.classList.remove("active");
        x.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      var shown = 0,
        total = 0;
      cards().forEach(function (c) {
        var show = !cat || (c.dataset.cats || "").split("|").indexOf(cat) !== -1;
        (c.closest(".nw-proj-wrap") || c).style.display = show ? "" : "none";
        total++;
        if (show) shown++;
      });
      markFirstVisible();
      syncSections();
      status.textContent =
        "Showing " + shown + " of " + total + " " + noun + (cat ? " in " + label : "");
      if (writeUrl) writeState(cat);
    };

    // A query parameter, not a fragment: `?category=Wildfire` survives being
    // pasted into the tools that strip fragments (chat clients, mail
    // rewriters, link shorteners), which is exactly where a filtered view gets
    // sent from. The old `#category=` form is still read below so links
    // already in the wild keep working.
    var writeState = function (cat) {
      if (!history.pushState) return;
      var url = new URL(location.href);
      url.hash = "";
      if (cat) url.searchParams.set("category", cat);
      else url.searchParams.delete("category");
      // pushState, not replaceState: a filter is a view the visitor chose, so
      // Back should undo it rather than leave the page.
      if (url.href !== location.href) history.pushState({ nwCategory: cat }, "", url.href);
    };

    // Both spellings, one reader — `?category=` is what we now write, and
    // `#category=` is what tags on detail pages and older links still use.
    var wantedCategory = function () {
      var q = new URL(location.href).searchParams.get("category");
      if (q !== null) return q;
      var m = location.hash.match(/category=([^&]*)/);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    };

    // The button for a category, falling back to "All" for an absent or
    // unknown one, so a stale link lands on a full grid rather than nothing.
    var buttonFor = function (cat) {
      if (!cat) return all;
      var found = all;
      bar.querySelectorAll("button[data-cat]").forEach(function (b) {
        if (b.dataset.cat === cat) found = b;
      });
      return found;
    };

    var all = mk("All", null);
    all.classList.add("active");
    all.setAttribute("aria-pressed", "true");
    Array.from(cats)
      .sort()
      .forEach(function (c) {
        mk(c, c);
      });
    // Nothing is filtered yet, but hand the stylesheet the same marked state it
    // will be in from the first click onward, so the unfiltered page and the
    // "All" view are drawn by one code path rather than two.
    markFirstVisible();

    // Deep link on load (used by tags on detail pages), and Back/Forward after
    // that. Neither writes the URL: on load it is already what it should be,
    // and popstate is the browser having set it.
    var fromUrl = wantedCategory();
    if (fromUrl) apply(buttonFor(fromUrl), false);
    window.addEventListener("popstate", function () {
      apply(buttonFor(wantedCategory()), false);
    });
  });

  // Research areas: upgrade the stacked panels into a tab set. The markup ships
  // with every panel visible and the tab strip `hidden`, so this is the only
  // thing standing between a JS failure and a readable (if long) section.
  var areas = document.getElementById("nw-areas");
  if (areas) {
    var tablist = areas.querySelector('[role="tablist"]');
    var tabs = Array.prototype.slice.call(areas.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(areas.querySelectorAll('[role="tabpanel"]'));

    if (tablist && tabs.length && tabs.length === panels.length) {
      var slugOf = function (tab) {
        return (tab.id || "").replace("nw-area-tab-", "");
      };

      var select = function (tab, moveFocus, updateHash, scrollStrip) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          // Roving tabindex: the strip is one tab stop, arrows move within it.
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute("aria-controls"));
          if (panel) {
            panel.hidden = !on;
            // No focusable descendants in a panel (prose + a figure), so per
            // the APG tabs pattern the panel itself must be a tab stop.
            panel.tabIndex = on ? 0 : -1;
          }
        });
        // `nearest` on both axes: the strip may need to scroll sideways, but
        // the page must not jump vertically just because a tab was clicked.
        // Skipped on the initial selection — with the section below the fold,
        // even `nearest` scrolls the whole page down to it on load.
        if (scrollStrip && tab.scrollIntoView) {
          tab.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        if (moveFocus) tab.focus();
        if (updateHash && history.replaceState) {
          history.replaceState(null, "", "#area=" + slugOf(tab));
        }
      };

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () {
          select(tab, false, true, true);
        });
        // Arrow keys per the APG tabs pattern; Home/End jump to the ends.
        tab.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
          else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
          else if (e.key === "Home") next = tabs[0];
          else if (e.key === "End") next = tabs[tabs.length - 1];
          if (!next) return;
          e.preventDefault();
          select(next, true, true, true);
        });
      });

      areas.classList.add("js-tabs");
      tablist.hidden = false;

      // Mobile scroll fade: mark which end (if any) the strip is scrolled to
      // so the CSS mask only fades the side that still has hidden tabs.
      var updateScrollEdges = function () {
        var max = tablist.scrollWidth - tablist.clientWidth;
        tablist.classList.toggle("nw-at-start", tablist.scrollLeft <= 1);
        tablist.classList.toggle("nw-at-end", tablist.scrollLeft >= max - 1);
      };
      updateScrollEdges();
      tablist.addEventListener("scroll", updateScrollEdges, { passive: true });
      window.addEventListener("resize", updateScrollEdges);

      // Deep link: #area=X, so a single area can be linked from a CV or email.
      var wanted = location.hash.match(/area=([^&]*)/);
      var start = tabs[0];
      if (wanted) {
        var slug = decodeURIComponent(wanted[1]);
        tabs.forEach(function (t) {
          if (slugOf(t) === slug) start = t;
        });
      }
      select(start, false, false);
    }

    // The figure animations are scoped to `#interests.nw-in-view` in CSS, so
    // nothing draws while the section is off screen. Same idea as the globe and
    // the hero network, minus the rAF loop — the compositor handles the rest.
    var interests = document.getElementById("interests");
    if (interests && "IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            interests.classList.toggle("nw-in-view", entry.isIntersecting);
          });
        },
        { rootMargin: "0px 0px -5% 0px" },
      ).observe(interests);
    } else if (interests) {
      interests.classList.add("nw-in-view");
    }
  }

  // Scroll reveal: fade sections' items in as they enter the viewport.
  // Elements already on screen at load are never hidden, so first paint (and
  // the LCP element) is identical with or without this — Lighthouse-safe.
  //
  // Browsers with scroll-driven animations run the CSS version of this instead
  // (see "scroll reveal, driven by the scroll itself" in site.css), which is
  // the same effect on the compositor with no observer, no per-batch delay
  // bookkeeping, and no fold measurement. The two must never both apply: this
  // one sets `opacity: 0` up front, so leaving it on would hide elements the
  // CSS timeline has already resolved to their final state.
  var cssDriven = window.CSS && CSS.supports && CSS.supports("animation-timeline", "view()");

  if (!reducedMotion && !cssDriven && "IntersectionObserver" in window) {
    var revealables = document.querySelectorAll(
      ".nw-section .nw-title, .nw-section .nw-subtitle, .nw-section .nw-lead, " +
        ".nw-stat, .nw-card, .nw-proj-wrap, .nw-cite, .nw-post, " +
        ".nw-tl-item, .nw-award, .nw-faq details, .nw-contact-card, .nw-globe-wrap, " +
        ".nw-cta-card, .nw-areas, .nw-marquee",
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
        { rootMargin: "0px 0px -8% 0px" },
      );
      below.forEach(function (el) {
        el.classList.add("nw-reveal");
        io.observe(el);
      });
    }
  }
})();
