// Fails when a hex color is hardcoded outside the token source. Colors belong
// in src/styles/global.css as --c-* tokens; use them via Tailwind utilities or
// var(--c-*). A fallback inside var(--x, #hex) is allowed.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Files whose literals are deliberate: the token source, print (light-only)
// output, brand/meta values and the home banner gradient.
const allow = new Set([
  'src/styles/global.css',
  'src/styles/fonts.css',
  'src/lib/icons.generated.ts',
  'src/layouts/Print.astro',
  'src/layouts/Base.astro',
  'src/pages/print/resume.astro',
  'src/pages/index.astro',
]);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

let bad = 0;
for (const file of walk('src').filter((f) => /\.(astro|ts|css)$/.test(f))) {
  if (allow.has(file)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const code = line.replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, '');
      if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|\b(?:rgba?|hsla?)\(/.test(code)) {
        console.error(`${file}:${i + 1}: hardcoded color; use a --c-* token`);
        bad++;
      }
    });
}
if (bad) process.exit(1);
