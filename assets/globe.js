// Decorative dot globe in the contact section ("reach me from anywhere").
// Renders the precomputed land dots from assets/data/globe-dots.json (built
// by scripts/generate-globe-dots.mjs) on a transparent canvas in the site's
// accent blue. Auto-rotates, drag/flick to spin; data fetch and animation are
// deferred until the section nears the viewport, and the loop pauses while
// the globe is off-screen or the tab is hidden.
(function () {
  "use strict";

  var canvas = document.getElementById("nw-globe");
  if (!canvas || !canvas.getContext) return;

  var AUTO_SPEED = 0.0015; // radians/frame auto-rotation
  var FRICTION = 0.92; // per-frame decay of flick velocity
  var DOT_COLOR = "0, 118, 223"; // --nw-primary (#0076DF), same in both themes
  var TILT = 0.35;

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ctx = canvas.getContext("2d");
  var dots = null; // [{x, y, z} unit-sphere points]
  var size = 0; // CSS pixel size of the square canvas
  var radius = 0;
  var rotY = 0;
  var rotX = TILT;
  var velY = AUTO_SPEED;
  var velX = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var lastDX = 0;
  var lastDY = 0;
  var running = false;
  var visible = false;
  var rafId = 0;

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    size = canvas.clientWidth;
    if (!size) return;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = size * 0.46;
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    var c = size / 2;
    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var projected = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      // rotate about Y (spin), then X (tilt)
      var x1 = d.x * cosY + d.z * sinY;
      var z1 = -d.x * sinY + d.z * cosY;
      var y2 = d.y * cosX - z1 * sinX;
      var z2 = d.y * sinX + z1 * cosX;
      projected.push({ z: z2, sx: c + x1 * radius, sy: c - y2 * radius });
    }
    projected.sort(function (a, b) {
      return a.z - b.z;
    });
    var dotMax = Math.max(1.4, size * 0.006);
    for (var j = 0; j < projected.length; j++) {
      var p = projected[j];
      var depth = (p.z + 1) / 2; // 0 = far side, 1 = near side
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, dotMax * (0.4 + 0.6 * depth), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + DOT_COLOR + "," + (0.08 + 0.82 * depth) + ")";
      ctx.fill();
    }
  }

  function tick() {
    if (!running) return;
    if (!dragging) {
      velY = velY * FRICTION + AUTO_SPEED * (1 - FRICTION);
      velX *= FRICTION;
      rotY += velY;
      rotX = clampTilt(rotX + velX);
    }
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function clampTilt(x) {
    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, x));
  }

  function setRunning(on) {
    // reduced motion: never self-animate; draw stills on demand instead
    if (reduceMotion) return;
    if (on === running || !dots) return;
    running = on;
    if (on) rafId = requestAnimationFrame(tick);
    else cancelAnimationFrame(rafId);
  }

  // ── drag / flick ───────────────────────────────────────────────────────────

  canvas.addEventListener("pointerdown", function (e) {
    if (!dots) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    lastDX = lastDY = 0;
    velX = velY = 0;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    lastDX = e.clientX - lastX;
    lastDY = e.clientY - lastY;
    rotY += lastDX * 0.005;
    rotX = clampTilt(rotX + lastDY * 0.005);
    lastX = e.clientX;
    lastY = e.clientY;
    if (reduceMotion) draw(); // no loop running; redraw the still frame
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    velY = lastDX * 0.005;
    velX = lastDY * 0.005;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ── lazy init ──────────────────────────────────────────────────────────────

  function start() {
    fetch("assets/data/globe-dots.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        dots = [];
        for (var i = 0; i < data.dots.length; i += 2) {
          var phi = ((90 - data.dots[i]) * Math.PI) / 180;
          var theta = ((180 - data.dots[i + 1]) * Math.PI) / 180;
          dots.push({
            x: Math.sin(phi) * Math.cos(theta),
            y: Math.cos(phi),
            z: Math.sin(phi) * Math.sin(theta),
          });
        }
        resize();
        if (reduceMotion || !visible) draw();
        if (visible) setRunning(true);
      })
      .catch(function () {
        /* decorative: fail silently, the layout stands on its own */
      });
  }

  window.addEventListener("resize", function () {
    if (!dots) return;
    resize();
    if (!running) draw();
  });

  document.addEventListener("visibilitychange", function () {
    setRunning(!document.hidden && visible);
  });

  if ("IntersectionObserver" in window) {
    var loader = new IntersectionObserver(
      function (entries, obs) {
        if (
          entries.some(function (e) {
            return e.isIntersecting;
          })
        ) {
          obs.disconnect();
          start();
        }
      },
      { rootMargin: "400px" }
    );
    loader.observe(canvas);
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) {
        return e.isIntersecting;
      });
      setRunning(visible && !document.hidden);
    }).observe(canvas);
  } else {
    visible = true;
    start();
  }
})();
