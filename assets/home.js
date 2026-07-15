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

  // Category filter buttons for project grids
  document.querySelectorAll("[data-nw-filter-for]").forEach(function (bar) {
    var grid = document.getElementById(bar.dataset.nwFilterFor) ||
      document.getElementById("listing-" + bar.dataset.nwFilterFor);
    if (!grid) return;
    var cards = function () {
      return grid.querySelectorAll(".nw-proj-card");
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
          c.parentElement.classList.contains("nw-proj-wrap")
            ? (c.parentElement.style.display = show ? "" : "none")
            : (c.style.display = show ? "" : "none");
        });
      };
      bar.appendChild(b);
      return b;
    };
    mk("All", null).classList.add("active");
    Array.from(cats).sort().forEach(function (c) { mk(c, c); });
  });
})();
