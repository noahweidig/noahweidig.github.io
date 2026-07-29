# scripts/vendor

Build-time dependencies for `scripts/generate-og.ts`, vendored rather than
installed so `quarto render` stays the only build step (no `npm install`, no
network access) on GitHub Actions, Netlify, and local machines alike.

## resvg/

[`@resvg/resvg-wasm`](https://github.com/yisibl/resvg-js) v2.6.2 — MPL-2.0.

- `resvg.mjs` — the package's `index.mjs` ESM bundle, unmodified.
- `resvg.wasm.gz` — the package's `index_bg.wasm`, gzipped (2.4 MB → 0.9 MB).
  `generate-og.ts` gunzips it in memory and hands the bytes to `initWasm()`.

Upgrading: `npm pack @resvg/resvg-wasm@<version>`, copy `index.mjs` over
`resvg.mjs`, and `gzip -9 -c index_bg.wasm > resvg.wasm.gz`.

## fonts/

[Inter](https://github.com/rsms/inter) — SIL Open Font License 1.1.

Static instances of the variable `assets/fonts/inter-latin.woff2` already
shipped by the site, snapshotted at weight 400 and 800 and repacked as TTF
(resvg does not read WOFF2, and matches faces by `usWeightClass`):

```sh
python3 -c "
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
for w in (400, 800):
    f = TTFont('assets/fonts/inter-latin.woff2')
    instancer.instantiateVariableFont(f, {'wght': w}, inplace=True)
    f['OS/2'].usWeightClass = w
    f.flavor = None
    f.save(f'scripts/vendor/fonts/inter-{w}.ttf')
"
```
