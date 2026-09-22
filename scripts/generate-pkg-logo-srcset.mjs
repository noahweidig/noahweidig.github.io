/**
 * Resizes the R-package hex-logo stickers used inline in the "Favorite R
 * Packages" post (src/content/blog/favorite-r-packages/index.md) down to the
 * size they're actually displayed at.
 *
 * Those logos are raw `<img>` tags in markdown prose (inline next to a
 * heading, floated with the `.pkg-logo` CSS class), so they bypass Astro's
 * `astro:assets`/`<Image>` pipeline entirely — see issue #189. Rather than a
 * fragile custom remark/rehype step reaching into that pipeline from inside
 * markdown compilation, this script does the same resize work sharp (the
 * same library astro:assets' default image service uses) would do, and
 * writes real 1x/2x density variants straight to `public/`, where the
 * markdown's `srcset` attribute already points.
 *
 * Source of truth is src/assets/blog/favorite-r-packages/logos/ (the
 * original, full-resolution files). Run after changing one of those:
 *
 *   node scripts/generate-pkg-logo-srcset.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src/assets/blog/favorite-r-packages/logos');
const outDir = path.join(root, 'public/media/blog/favorite-r-packages/logos');

// Displayed at 76 CSS px (`.pkg-logo` in src/styles/global.css); 1x/2x covers
// standard and retina displays without shipping the full source resolution.
const WIDTH_1X = 90;
const WIDTH_2X = 180;

const RASTER_LOGOS = [
  'ggplot2',
  'dplyr',
  'tidyr',
  'readr',
  'purrr',
  'tibble',
  'stringr',
  'forcats',
  'lubridate',
  'fs',
  'glue',
  'arrow',
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of RASTER_LOGOS) {
    const srcFile = path.join(srcDir, `${name}.webp`);
    const before = fs.statSync(srcFile).size;

    await sharp(srcFile)
      .resize({ width: WIDTH_1X })
      .webp({ quality: 90 })
      .toFile(path.join(outDir, `${name}.webp`));
    await sharp(srcFile)
      .resize({ width: WIDTH_2X })
      .webp({ quality: 90 })
      .toFile(path.join(outDir, `${name}@2x.webp`));

    const after1x = fs.statSync(path.join(outDir, `${name}.webp`)).size;
    const after2x = fs.statSync(path.join(outDir, `${name}@2x.webp`)).size;
    console.log(
      `✓ ${name} (before: ${(before / 1024).toFixed(1)}kB, 1x: ${(after1x / 1024).toFixed(1)}kB, 2x: ${(after2x / 1024).toFixed(1)}kB)`,
    );
  }

  // renv's logo is an SVG — already resolution-independent, so it's just
  // copied through untouched (no density variants needed).
  fs.copyFileSync(path.join(srcDir, 'renv.svg'), path.join(outDir, 'renv.svg'));
  console.log('✓ renv (svg, copied as-is)');
}

await main();
