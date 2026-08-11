// Hero background: a drifting network of dots linked by lines, repelled by the
// pointer and thickened by a click. Replaces particles.js, which drew the same
// effect but cost 23 KB and — unlike every other animated thing on this site —
// ran its loop unconditionally, including while the hero was scrolled off the
// page or the tab was in the background.
//
// The gating here follows assets/globe.js: an IntersectionObserver decides
// whether the element is worth drawing, `visibilitychange` covers the tab, and
// the rAF loop is only alive when both say yes.
(function () {
  "use strict";

  var host = document.getElementById("nw-particles");
  if (!host) return;
  if (!window.crypto || !crypto.getRandomValues) return;

  // Motion preference first: under `reduce` the hero simply has no network,
  // matching what the particles.js bootstrap did before it.
  if (
    window.matchMedia &&
    (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(prefers-reduced-data: reduce)").matches)
  ) {
    return;
  }

  // Decoration, and the most expensive thing on the page per frame. On a
  // device that will struggle with it, skipping is better than a hero that
  // stutters while the visitor tries to read it.
  if (
    (navigator.deviceMemory && navigator.deviceMemory < 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
  ) {
    return;
  }

  var LINK_DIST = 150; // px at which two dots stop being linked
  var LINK_OPACITY = 0.4; // opacity of a link at zero distance
  var DOT_OPACITY = 0.5;
  var DOT_MAX_R = 5;
  var SPEED = 0.75; // px/frame, matching the previous config's drift
  var REPULSE_DIST = 200;
  var PUSH_ON_CLICK = 4;
  var AREA_PER_DOT = 18000; // css px² of hero per dot
  var MIN_DOTS = 24;
  var MAX_DOTS = 90;
  var MAX_DPR = 2; // past 2 the extra pixels are invisible and the fill cost is not

  // Neutral grey reads correctly against both themes, so unlike the globe this
  // does not need to change color — but it stays overridable from CSS.
  var COLOR = "136, 136, 136";
  var themed = getComputedStyle(document.documentElement)
    .getPropertyValue("--nw-net-dot")
    .trim();
  if (themed) COLOR = themed;

  var canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  var dots = [];
  var w = 0;
  var h = 0;
  var dpr = 1;
  var pointer = { x: -1e4, y: -1e4 };
  var rafId = 0;
  var running = false;
  var onScreen = false;

  // Static analysis flags Math.random() wherever it appears, and it is right
  // to — the rule cannot tell a decorative particle from a session token.
  // Drawing from crypto.getRandomValues() settles that honestly instead of
  // suppressing the warning, and costs nothing here: dot properties are only
  // generated at init, on resize, and four at a time on click, never per
  // frame. Values come from a buffer refilled in bulk, so the common case is
  // an array read.
  var randPool = new Uint32Array(256);
  var randNext = randPool.length;

  function rand() {
    if (randNext >= randPool.length) {
      crypto.getRandomValues(randPool);
      randNext = 0;
    }
    return randPool[randNext++] / 4294967296;
  }

  function makeDot(x, y) {
    return {
      x: x === undefined ? rand() * w : x,
      y: y === undefined ? rand() * h : y,
      vx: (rand() - 0.5) * SPEED * 2,
      vy: (rand() - 0.5) * SPEED * 2,
      r: 1 + rand() * (DOT_MAX_R - 1),
    };
  }

  function resize() {
    var box = host.getBoundingClientRect();
    if (!box.width || !box.height) return;
    w = box.width;
    h = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Draw in CSS pixels and let the transform handle density, so every
    // distance constant above is in the units the design was tuned in.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var target = Math.max(
      MIN_DOTS,
      Math.min(MAX_DOTS, Math.round((w * h) / AREA_PER_DOT))
    );
    while (dots.length > target) dots.pop();
    while (dots.length < target) dots.push(makeDot());
  }

  function step() {
    var i;
    var d;
    for (i = 0; i < dots.length; i++) {
      d = dots[i];
      d.x += d.vx;
      d.y += d.vy;

      // Wrap rather than bounce: a dot that leaves one edge re-enters from the
      // opposite one, which keeps the field evenly spread instead of letting
      // dots pile up along the borders.
      if (d.x - d.r > w) d.x = -d.r;
      else if (d.x + d.r < 0) d.x = w + d.r;
      if (d.y - d.r > h) d.y = -d.r;
      else if (d.y + d.r < 0) d.y = h + d.r;

      // Pointer repulsion, easing off with the square of the distance so dots
      // slide away from the cursor rather than snapping.
      var px = d.x - pointer.x;
      var py = d.y - pointer.y;
      var dist = Math.sqrt(px * px + py * py);
      if (dist < REPULSE_DIST && dist > 0.01) {
        var force = (1 - dist / REPULSE_DIST);
        force = force * force * 6;
        d.x += (px / dist) * force;
        d.y += (py / dist) * force;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Links first, so dots sit on top of the web rather than under it. The
    // inner loop starts at i+1 because each pair only needs drawing once.
    ctx.lineWidth = 1;
    for (var i = 0; i < dots.length; i++) {
      var a = dots[i];
      for (var j = i + 1; j < dots.length; j++) {
        var b = dots[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        // Compare squared distances to keep the sqrt out of the hot path; it
        // is only paid for pairs that are actually close enough to link.
        var d2 = dx * dx + dy * dy;
        if (d2 > LINK_DIST * LINK_DIST) continue;
        var alpha = LINK_OPACITY * (1 - Math.sqrt(d2) / LINK_DIST);
        ctx.strokeStyle = "rgba(" + COLOR + "," + alpha + ")";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(" + COLOR + "," + DOT_OPACITY + ")";
    for (var k = 0; k < dots.length; k++) {
      var d = dots[k];
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame() {
    step();
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function sync() {
    var should = onScreen && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) rafId = requestAnimationFrame(frame);
    else cancelAnimationFrame(rafId);
  }

  window.addEventListener(
    "pointermove",
    function (e) {
      var box = host.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerleave",
    function () {
      pointer.x = pointer.y = -1e4;
    },
    { passive: true }
  );

  // Bound to the host rather than the window so clicking a hero button or
  // social link does its own job without also seeding the field.
  host.addEventListener("click", function (e) {
    var box = host.getBoundingClientRect();
    for (var i = 0; i < PUSH_ON_CLICK && dots.length < MAX_DOTS + 20; i++) {
      dots.push(makeDot(e.clientX - box.left, e.clientY - box.top));
    }
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(host);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }).observe(host);
  } else {
    onScreen = true;
  }

  document.addEventListener("visibilitychange", sync);

  resize();
  draw(); // paint one frame immediately so the hero is never briefly bare
  sync();
})();
