#!/usr/bin/env python3
"""Optimize repository images for the HugoBlox site.

Pipeline per image:
  1. Detect dimensions.
  2. Standardize aspect ratio: snap to the nearest "standard" ratio
     (16:9, 4:3, 1:1) when the source is already close to one; otherwise
     center-crop to the default target ratio. Cropping only, never padding.
  3. Resize so the longest edge <= max edge (800px inside a /thumbnails/
     folder, otherwise 1200px).
  4. Encode to WebP (quality 80), preserving EXIF where present.
  5. Delete the original when it was PNG/JPG/JPEG and conversion succeeded.

Front matter `image.filename:` / `icon:` references inside the same Hugo
page bundle are updated from the old name to the new .webp name so the
site keeps building.

Defaults live in the CONFIG block below and are overridable via env vars
so aspect ratio / max dimensions can be tuned later without code edits:
  IMG_TARGET_RATIO   default "16:9"
  IMG_STD_RATIOS     default "16:9,4:3,1:1"
  IMG_RATIO_TOL      default "0.05"   (fractional tolerance for "close")
  IMG_MAX_EDGE       default "1200"
  IMG_THUMB_MAX_EDGE default "800"
  IMG_QUALITY        default "80"
  IMG_ROOTS          default "content,assets,static"
  IMG_EXCLUDE_GLOBS  extra fnmatch patterns to skip (comma separated)

Usage:
  optimize_images.py [files...]   # process the given files
  optimize_images.py              # scan IMG_ROOTS for all images

Exit status is always 0 unless arguments are invalid; per-file failures
are logged and skipped so one bad image never blocks the rest.
"""
from __future__ import annotations

import fnmatch
import os
import re
import sys
from pathlib import Path

from PIL import Image

try:
    import piexif
except Exception:  # piexif is optional at runtime; EXIF passthrough still works
    piexif = None


# --------------------------------------------------------------------------- #
# Config (env-overridable)                                                     #
# --------------------------------------------------------------------------- #
def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def _parse_ratio(text: str) -> float:
    text = text.strip()
    if ":" in text:
        w, h = text.split(":", 1)
        return float(w) / float(h)
    return float(text)


TARGET_RATIO = _parse_ratio(_env("IMG_TARGET_RATIO", "16:9"))
STD_RATIOS = [_parse_ratio(r) for r in _env("IMG_STD_RATIOS", "16:9,4:3,1:1").split(",") if r.strip()]
RATIO_TOL = float(_env("IMG_RATIO_TOL", "0.05"))
MAX_EDGE = int(_env("IMG_MAX_EDGE", "1200"))
THUMB_MAX_EDGE = int(_env("IMG_THUMB_MAX_EDGE", "800"))
QUALITY = int(_env("IMG_QUALITY", "80"))
ROOTS = [r.strip() for r in _env("IMG_ROOTS", "content,assets,static").split(",") if r.strip()]

INPUT_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
LOSSY_SRC_EXTS = {".png", ".jpg", ".jpeg"}  # originals deleted after conversion

# HugoBlox / PWA assets that are referenced by exact filename or must keep
# their format & exact pixels. Never touch these.
DEFAULT_EXCLUDE_GLOBS = [
    "static/favicon*",
    "static/apple-touch-icon.*",
    "static/*web-app-manifest*",
    "static/*manifest*",
    "static/mstile*",
    "static/android-chrome*",
    "assets/media/icon.*",   # HugoBlox site logo/icon source
    "**/icon.*",
    "**/logo.*",
    "**/*favicon*",
]
EXCLUDE_GLOBS = DEFAULT_EXCLUDE_GLOBS + [
    g.strip() for g in _env("IMG_EXCLUDE_GLOBS", "").split(",") if g.strip()
]


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def log(msg: str) -> None:
    print(msg, flush=True)


def is_excluded(rel: str) -> bool:
    rel = rel.replace(os.sep, "/")
    name = rel.split("/")[-1]
    for pat in EXCLUDE_GLOBS:
        if fnmatch.fnmatch(rel, pat) or fnmatch.fnmatch(name, pat):
            return True
    return False


def max_edge_for(rel: str) -> int:
    return THUMB_MAX_EDGE if "/thumbnails/" in ("/" + rel.replace(os.sep, "/") + "/") else MAX_EDGE


def choose_ratio(w: int, h: int) -> float | None:
    """Return a standard ratio to crop to, or None to leave AR unchanged.

    If the image is already close to one of the standard ratios, keep that
    ratio (None => no crop). Otherwise return the default target ratio.
    """
    cur = w / h
    for r in STD_RATIOS:
        if abs(cur - r) / r <= RATIO_TOL:
            return None  # already a standard ratio -> preserve
    return TARGET_RATIO


def center_crop(im: Image.Image, ratio: float) -> Image.Image:
    w, h = im.size
    cur = w / h
    if abs(cur - ratio) / ratio <= 1e-3:
        return im
    if cur > ratio:  # too wide -> trim width
        new_w = round(h * ratio)
        left = (w - new_w) // 2
        return im.crop((left, 0, left + new_w, h))
    # too tall -> trim height
    new_h = round(w / ratio)
    top = (h - new_h) // 2
    return im.crop((0, top, w, top + new_h))


def resize_max_edge(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    longest = max(w, h)
    if longest <= max_edge:
        return im
    scale = max_edge / longest
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def get_exif_bytes(im: Image.Image) -> bytes | None:
    raw = im.info.get("exif")
    if not raw:
        return None
    if piexif is not None:
        try:
            return piexif.dump(piexif.load(raw))  # validate / normalize
        except Exception:
            return raw  # fall back to passing the original blob through
    return raw


def update_bundle_refs(directory: Path, old_name: str, new_name: str) -> None:
    """Update front-matter image references inside the same page bundle."""
    if old_name == new_name:
        return
    for md in list(directory.glob("*.md")):
        try:
            text = md.read_text(encoding="utf-8")
        except Exception:
            continue
        # Only rewrite whole-token filename references, not substrings.
        new_text = re.sub(rf"(?<![\w./]){re.escape(old_name)}(?![\w])", new_name, text)
        if new_text != text:
            md.write_text(new_text, encoding="utf-8")
            log(f"    updated refs in {md} ({old_name} -> {new_name})")


# --------------------------------------------------------------------------- #
# Core                                                                         #
# --------------------------------------------------------------------------- #
def process(path: Path, repo_root: Path) -> bool:
    """Process one image. Returns True if the working tree changed."""
    rel = os.path.relpath(path, repo_root)
    ext = path.suffix.lower()

    if ext not in INPUT_EXTS:
        return False
    if is_excluded(rel):
        log(f"SKIP (excluded): {rel}")
        return False
    if not path.is_file():
        return False

    try:
        with Image.open(path) as im:
            im.load()
            src_format = im.format
            orig_w, orig_h = im.size
            limit = max_edge_for(rel)

            # WebP already at/under limits and standard-ish -> leave it alone.
            if ext == ".webp" and max(orig_w, orig_h) <= limit:
                log(f"SKIP (webp within {limit}px): {rel} [{orig_w}x{orig_h}]")
                return False

            exif = get_exif_bytes(im)
            work = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") and "transparency" in im.info \
                else im.convert("RGB") if im.mode not in ("RGB", "RGBA") else im

            ratio = choose_ratio(*work.size)
            if ratio is not None:
                work = center_crop(work, ratio)
            work = resize_max_edge(work, limit)
            new_w, new_h = work.size

        out_path = path.with_suffix(".webp")
        save_kwargs = {"format": "WEBP", "quality": QUALITY, "method": 6}
        if exif:
            save_kwargs["exif"] = exif
        work.save(out_path, **save_kwargs)

    except Exception as e:  # fail gracefully, keep going
        log(f"ERROR processing {rel}: {e}")
        return False

    changed = True
    log(
        f"OK: {rel} [{orig_w}x{orig_h} {src_format}] -> "
        f"{os.path.relpath(out_path, repo_root)} [{new_w}x{new_h} WEBP]"
    )

    # Delete lossy original and fix references when the name changed.
    if ext in LOSSY_SRC_EXTS and out_path.resolve() != path.resolve():
        try:
            path.unlink()
            log(f"    deleted original {rel}")
        except Exception as e:
            log(f"    WARN could not delete {rel}: {e}")
        update_bundle_refs(path.parent, path.name, out_path.name)

    return changed


def gather_targets(args: list[str], repo_root: Path) -> list[Path]:
    if args:
        return [Path(a) for a in args]
    found: list[Path] = []
    for root in ROOTS:
        base = repo_root / root
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.suffix.lower() in INPUT_EXTS:
                found.append(p)
    return found


def main() -> int:
    repo_root = Path(os.environ.get("GITHUB_WORKSPACE", ".")).resolve()
    targets = gather_targets(sys.argv[1:], repo_root)

    log(
        f"image-optimize: target_ratio={TARGET_RATIO:.4f} std={STD_RATIOS} "
        f"tol={RATIO_TOL} max_edge={MAX_EDGE} thumb={THUMB_MAX_EDGE} q={QUALITY}"
    )
    log(f"candidates: {len(targets)}")

    changed = 0
    for t in targets:
        if process(t, repo_root):
            changed += 1

    log(f"done: {changed} image(s) changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
