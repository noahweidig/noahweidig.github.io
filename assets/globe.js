// Decorative dot globe in the contact section ("reach me from anywhere").
// Renders the precomputed land dots from assets/data/globe-dots.json (built
// by scripts/generate-globe-dots.mjs) on a transparent canvas in the site's
// accent blue, centered on Orlando. Static: one draw call, no animation loop,
// no drag physics — the lightest version of the globe that still reads as one.
(function () {
  "use strict";

  var canvas = document.getElementById("nw-globe");
  if (!canvas || !canvas.getContext) return;

  // Land-dot color follows --nw-globe-dot (blue in light mode, white in dark).
  var DOT_COLOR = "0, 118, 223";
  // The Orlando marker always stays the site's accent blue, in both themes.
  var MARKER_COLOR = "0, 118, 223";
  function readDotColor() {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue("--nw-globe-dot")
      .trim();
    if (v) DOT_COLOR = v;
  }
  readDotColor();
  var TILT = 0.35;
  var ORLANDO = { lat: 28.5384, lon: -81.3789 };

  var ctx = canvas.getContext("2d");
  var label = document.getElementById("nw-globe-label");
  var marker = toSphere(ORLANDO.lat, ORLANDO.lon);
  var dots = null; // [{x, y, z} unit-sphere points]
  var size = 0; // CSS pixel size of the square canvas
  var radius = 0;
  // Orlando faces the viewer: rotate about Y so its azimuth lands
  // front-center, then apply a fixed tilt. Never changes — the globe is static.
  var rotY = -Math.atan2(marker.x, marker.z);
  var rotX = TILT;

  // Same lat/lon → unit-sphere mapping used for the precomputed land dots
  function toSphere(lat, lon) {
    var phi = ((90 - lat) * Math.PI) / 180;
    var theta = ((180 - lon) * Math.PI) / 180;
    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    };
  }

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
    if (!dots || !size) return;
    readDotColor();
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
      // Keep the rotated surface normal (x1, y2, z2) so each dot can be drawn
      // as a foreshortened disc lying flat on the sphere rather than a
      // camera-facing circle.
      projected.push({ z: z2, nx: x1, ny: y2, sx: c + x1 * radius, sy: c - y2 * radius });
    }
    projected.sort(function (a, b) {
      return a.z - b.z;
    });
    var dotR = Math.max(1.4, size * 0.006);
    for (var j = 0; j < projected.length; j++) {
      var p = projected[j];
      const depth = (p.z + 1) / 2; // 0 = far side, 1 = near side
      // A flat disc on the surface projects to an ellipse: its minor axis lies
      // along the projected normal and shrinks by |normal·view| = |z2|, so
      // dots near the limb foreshorten to slivers instead of staying round.
      const minor = dotR * Math.abs(p.z);
      const angle = Math.atan2(-p.ny, p.nx); // screen-space normal direction
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, minor, dotR, angle, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + DOT_COLOR + "," + (0.08 + 0.82 * depth) + ")";
      ctx.fill();
    }
    drawMarker(c, cosX, sinX, cosY, sinY);
  }

  // Static Orlando marker (glow halo + ring + dot); the coordinate label (an
  // HTML card) tracks it. Orlando is rotated to always face the camera, so
  // there is no far-side case to hide it in.
  function drawMarker(c, cosX, sinX, cosY, sinY) {
    var x1 = marker.x * cosY + marker.z * sinY;
    var z1 = -marker.x * sinY + marker.z * cosY;
    var y2 = marker.y * cosX - z1 * sinX;
    var sx = c + x1 * radius;
    var sy = c - y2 * radius;
    var r = Math.max(3.5, size * 0.011);

    ctx.beginPath();
    ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + MARKER_COLOR + ", 0.08)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + MARKER_COLOR + ", 0.15)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(" + MARKER_COLOR + ")";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.4);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    if (label) {
      label.hidden = false;
      label.style.left = canvas.offsetLeft + sx + "px";
      label.style.top = canvas.offsetTop + sy - r * 2.2 + "px";
    }
  }

  // ── lazy init: fetch + draw once the globe nears the viewport ────────────

  function start() {
    fetch("/assets/data/globe-dots.json")
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
        draw();
      })
      .catch(function (err) {
        /* decorative: never surface to visitors, the layout stands on its
           own — but leave a debug trace so a broken path is diagnosable. */
        if (window.console && console.debug) {
          console.debug("[nw-globe] dot data unavailable:", err);
        }
      });
  }

  // A resize can change the canvas's CSS size (responsive layout), so the
  // static frame has to be redrawn at the new resolution — no loop involved.
  window.addEventListener("resize", function () {
    if (!dots) return;
    resize();
    draw();
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
  } else {
    start();
  }
})();
