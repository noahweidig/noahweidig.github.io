#!/usr/bin/env python3
"""Regenerate every favicon/app-icon from assets/media/logo.svg.

Run after changing the logo:

    pip install cairosvg pillow
    python3 scripts/generate-icons.py

Outputs (all at the site root, referenced from _quarto.yml + site.webmanifest):

  favicon.svg                    transparent mark, ink on light / white on dark
  safari-pinned-tab.svg          solid-black mask for Safari pinned tabs
  favicon.ico                    16/32/48/64 blue badge
  favicon-96x96.png              blue rounded-square badge
  apple-touch-icon.png           180px, opaque, full-bleed (iOS masks it itself)
  web-app-manifest-{192,512}.png maskable, mark inside the 80% safe zone

The PNG/ICO formats can't follow the browser's color scheme, so they use the
brand-blue badge, which stays legible against light and dark browser chrome
alike; only the SVG icons adapt via prefers-color-scheme.
"""

import io
import os
import re

import cairosvg
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOGO = os.path.join(ROOT, "assets", "media", "logo.svg")

BLUE, INK, WHITE = "#0076DF", "#0a0a0f", "#ffffff"
S = 1024  # master render size


def logo_paths():
    src = open(LOGO).read()
    view_box = re.search(r'viewBox="([^"]+)"', src).group(1)
    vb = [float(n) for n in re.split(r"[ ,]+", view_box.strip())]
    return re.findall(r'<path[^>]*\sd="([^"]+)"', src), vb


PATHS, VB = logo_paths()


def mark(size, pad_frac, fill):
    """The logo paths scaled to fit, and centered in, a `size` square."""
    box = size * (1 - 2 * pad_frac)
    scale = box / VB[3]
    tx = (size - VB[2] * scale) / 2 - VB[0] * scale
    ty = (size - box) / 2 - VB[1] * scale
    d = "".join('<path d="%s"/>' % p for p in PATHS)
    return ('<g fill="%s" transform="translate(%.3f %.3f) scale(%.6f)">%s</g>'
            % (fill, tx, ty, scale, d))


def svg(size, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
            'width="%d" height="%d">%s</svg>' % (size, size, size, size, body))


def write(name, text):
    open(os.path.join(ROOT, name), "w").write(text + "\n")


def png(source, name, size):
    cairosvg.svg2png(bytestring=source.encode(),
                     write_to=os.path.join(ROOT, name),
                     output_width=size, output_height=size)


# scheme-aware tab icon
write("favicon.svg", svg(
    S,
    '<style>.m{fill:%s}@media (prefers-color-scheme:dark){.m{fill:%s}}</style>'
    '<g class="m">%s</g>'
    % (INK, WHITE, mark(S, 0.055, "currentColor").replace(' fill="currentColor"', ''))))

# Safari pinned tab: single-color mask, Safari recolors it
write("safari-pinned-tab.svg", svg(S, mark(S, 0.06, "#000000")))

badge = svg(S, '<rect width="%d" height="%d" rx="%d" fill="%s"/>%s'
            % (S, S, int(S * 0.22), BLUE, mark(S, 0.20, WHITE)))
apple = svg(S, '<rect width="%d" height="%d" fill="%s"/>%s'
            % (S, S, BLUE, mark(S, 0.22, WHITE)))
maskable = svg(S, '<rect width="%d" height="%d" fill="%s"/>%s'
               % (S, S, BLUE, mark(S, 0.28, WHITE)))

png(badge, "favicon-96x96.png", 96)
png(apple, "apple-touch-icon.png", 180)
png(maskable, "web-app-manifest-192x192.png", 192)
png(maskable, "web-app-manifest-512x512.png", 512)

ico = Image.open(io.BytesIO(cairosvg.svg2png(
    bytestring=badge.encode(), output_width=256, output_height=256))).convert("RGBA")
ico.save(os.path.join(ROOT, "favicon.ico"), format="ICO",
         sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

print("icons regenerated from", os.path.relpath(LOGO, ROOT))
