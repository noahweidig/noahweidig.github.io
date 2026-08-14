// Decorative globe card in the contact section ("reach me from anywhere").
// Renders precomputed country-border polylines (assets/data/globe-lines.json,
// built by scripts/generate-globe-lines.mjs) plus a procedural lat/lon
// graticule on a transparent canvas, orthographic-projected and cropped in
// close on Orlando. Static: one draw call, no animation loop, no drag
// physics — the lightest version of the globe that still reads as one.
(function () {
  "use strict";

  var canvas = document.getElementById("nw-globe");
  if (!canvas || !canvas.getContext) return;

  // Country border color follows --nw-globe-line (blue in light mode, white
  // in dark). The graticule and sphere read off the theme's own border/bg
  // tokens, so both pick up light/dark automatically.
  var LINE_COLOR = "0, 118, 223";
  var SPHERE_FILL = "#0a0a0f";
  var GRATICULE_COLOR = "#3d3d4b";
  // The Orlando marker always stays the site's accent blue, in both themes.
  var MARKER_COLOR = "0, 118, 223";
  function readThemeColors() {
    var cs = getComputedStyle(document.documentElement);
    var line = cs.getPropertyValue("--nw-globe-line").trim();
    if (line) LINE_COLOR = line;
    var fill = cs.getPropertyValue("--nw-bg-alt").trim();
    if (fill) SPHERE_FILL = fill;
    var grid = cs.getPropertyValue("--nw-border").trim();
    if (grid) GRATICULE_COLOR = grid;
  }
  readThemeColors();
  var TILT = 0.35;
  var ORLANDO = { lat: 28.5384, lon: -81.3789 };
  var GRATICULE_STEP = 20; // degrees between meridians/parallels

  var ctx = canvas.getContext("2d");
  var label = document.getElementById("nw-globe-label");
  var marker = toSphere(ORLANDO.lat, ORLANDO.lon);
  var lines = null; // [[{x,y,z}, ...], ...] unit-sphere points per ring
  var graticule = buildGraticule();
  var size = 0; // CSS pixel size of the square canvas
  var radius = 0;
  // Orlando faces the viewer: rotate about Y so its azimuth lands
  // front-center, then apply a fixed tilt. Never changes — the globe is static.
  var rotY = -Math.atan2(marker.x, marker.z);
  var rotX = TILT;

  // Zoomed in, not the whole sphere: the projection's radius is well past
  // half the canvas, and Orlando sits below center — the same crop the
  // reference card uses — so the card reads as a close-up on one place
  // rather than a full globe. tx/ty is the point Orlando projects to.
  var tx = 0, ty = 0;

  // Same lat/lon → unit-sphere mapping used for the precomputed border lines
  function toSphere(lat, lon) {
    var phi = ((90 - lat) * Math.PI) / 180;
    var theta = ((180 - lon) * Math.PI) / 180;
    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    };
  }

  // Meridians every GRATICULE_STEP° (full circles, pole to pole) + parallels
  // every GRATICULE_STEP° (latitude circles), each as a polyline of unit-
  // sphere points — the same shape d3.geoGraticule() draws, computed by hand
  // so no extra library or data file is needed for it.
  function buildGraticule() {
    var rings = [];
    var lat, lon, i;
    for (lon = -180; lon < 180; lon += GRATICULE_STEP) {
      var meridian = [];
      for (lat = -90; lat <= 90; lat += 5) meridian.push(toSphere(lat, lon));
      rings.push(meridian);
    }
    for (lat = -80; lat <= 80; lat += GRATICULE_STEP) {
      var parallel = [];
      for (lon = -180; lon <= 180; lon += 5) parallel.push(toSphere(lat, lon));
      rings.push(parallel);
    }
    return rings;
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    size = canvas.clientWidth;
    if (!size) return;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = size * 0.625;
    tx = size * 0.5;
    ty = size * 0.72;
  }

  // Rotate a unit-sphere point by the globe's fixed rotation and project it
  // to canvas space. z > 0 means it's on the near (visible) hemisphere.
  function project(p, cosX, sinX, cosY, sinY) {
    var x1 = p.x * cosY + p.z * sinY;
    var z1 = -p.x * sinY + p.z * cosY;
    var y2 = p.y * cosX - z1 * sinX;
    var z2 = p.y * sinX + z1 * cosX;
    return { x: tx + x1 * radius, y: ty - y2 * radius, z: z2 };
  }

  // Strokes a ring of points, breaking the path wherever it crosses to the
  // far side of the sphere so hidden segments never draw as a stretched
  // line across the visible face.
  function strokeRing(ring, cosX, sinX, cosY, sinY) {
    var open = false;
    for (var i = 0; i < ring.length; i++) {
      var p = project(ring[i], cosX, sinX, cosY, sinY);
      if (p.z > 0) {
        if (open) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          open = true;
        }
      } else if (open) {
        ctx.stroke();
        open = false;
      }
    }
    if (open) ctx.stroke();
  }

  function draw() {
    if (!lines || !size) return;
    readThemeColors();
    ctx.clearRect(0, 0, size, size);
    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);

    // Sphere fill
    ctx.beginPath();
    ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    ctx.fillStyle = SPHERE_FILL;
    ctx.fill();

    // Graticule (lat/lon grid)
    ctx.strokeStyle = GRATICULE_COLOR;
    ctx.lineWidth = Math.max(0.5, size * 0.0018);
    for (var g = 0; g < graticule.length; g++) {
      strokeRing(graticule[g], cosX, sinX, cosY, sinY);
    }

    // Country borders
    ctx.strokeStyle = "rgba(" + LINE_COLOR + ", 0.6)";
    ctx.lineWidth = Math.max(0.6, size * 0.0022);
    for (var i = 0; i < lines.length; i++) {
      strokeRing(lines[i], cosX, sinX, cosY, sinY);
    }

    // Sphere outline
    ctx.beginPath();
    ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    ctx.strokeStyle = GRATICULE_COLOR;
    ctx.lineWidth = Math.max(0.75, size * 0.003);
    ctx.stroke();

    drawMarker(cosX, sinX, cosY, sinY);
  }

  // Static Orlando marker (glow halo + ring + dot); the coordinate label (an
  // HTML card) tracks it. Orlando is rotated to always face the camera, so
  // there is no far-side case to hide it in.
  function drawMarker(cosX, sinX, cosY, sinY) {
    var p = project(marker, cosX, sinX, cosY, sinY);
    var sx = p.x, sy = p.y;
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
    fetch("/assets/data/globe-lines.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        lines = data.lines.map(function (flat) {
          var ring = [];
          for (var i = 0; i < flat.length; i += 2) {
            ring.push(toSphere(flat[i], flat[i + 1]));
          }
          return ring;
        });
        resize();
        draw();
      })
      .catch(function (err) {
        /* decorative: never surface to visitors, the layout stands on its
           own — but leave a debug trace so a broken path is diagnosable. */
        if (window.console && console.debug) {
          console.debug("[nw-globe] line data unavailable:", err);
        }
      });
  }

  // A resize can change the canvas's CSS size (responsive layout), so the
  // static frame has to be redrawn at the new resolution — no loop involved.
  window.addEventListener("resize", function () {
    if (!lines) return;
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
