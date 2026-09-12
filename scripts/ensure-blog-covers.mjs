/**
 * Fills in whatever a blog post is missing: cover art (via
 * generate-blog-covers.mjs) and the `image`/`image-light`/`image-alt`
 * frontmatter that wires it in. Idempotent — a post that already has both
 * is left untouched, so running this in CI on every push only ever touches
 * new or changed posts.
 *
 *   node scripts/ensure-blog-covers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(root, 'src/content/blog');

// Mirrors presetFor() in generate-blog-covers.mjs — same hash, same table —
// so the alt text names the hues the rendered cover actually uses.
const PRESETS = [
  { a: 'accent', b: 'violet' },
  { a: 'violet', b: 'moss' },
  { a: 'ember', b: 'accent' },
  { a: 'moss', b: 'violet' },
];

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (h * 33) ^ str.codePointAt(i);
  return h >>> 0;
}

function presetFor(slug) {
  return PRESETS[hash(slug) % PRESETS.length];
}

function parseTitle(raw) {
  const frontmatter = raw.split('---\n', 3)[1] ?? '';
  const line = frontmatter.split('\n').find((l) => l.startsWith('title:'));
  return (line ? line.slice('title:'.length).trim() : '').replace(/^['"]|['"]$/g, '');
}

const slugs = fs
  .readdirSync(blogDir)
  .filter((slug) => fs.existsSync(path.join(blogDir, slug, 'index.md')));

const needCovers = [];
const needFrontmatter = [];

for (const slug of slugs) {
  const dir = path.join(blogDir, slug);
  const hasCovers =
    fs.existsSync(path.join(dir, 'cover.webp')) &&
    fs.existsSync(path.join(dir, 'cover-light.webp'));
  if (!hasCovers) needCovers.push(slug);

  const raw = fs.readFileSync(path.join(dir, 'index.md'), 'utf8');
  const frontmatter = raw.split('---\n', 3)[1] ?? '';
  if (!frontmatter.split('\n').some((l) => l.startsWith('image:'))) {
    needFrontmatter.push(slug);
  }
}

if (needCovers.length) {
  console.log(`Generating covers: ${needCovers.join(', ')}`);
  execFileSync(process.execPath, ['scripts/generate-blog-covers.mjs', ...needCovers], {
    cwd: root,
    stdio: 'inherit',
  });
}

for (const slug of needFrontmatter) {
  const file = path.join(blogDir, slug, 'index.md');
  const raw = fs.readFileSync(file, 'utf8');
  const title = parseTitle(raw);
  const preset = presetFor(slug);
  const alt = `Cover card reading “${title}” over the site's ${preset.a} and ${preset.b} gradient`;

  // The frontmatter block is `---\n...\n---\n`; insert right before the
  // closing fence so new fields land where the existing posts put them.
  const closingIndex = raw.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    console.error(`Skipping ${slug}: could not find closing frontmatter fence.`);
    continue;
  }
  const insert = `image: './cover.webp'\nimage-light: './cover-light.webp'\nimage-alt: "${alt}"\n`;
  const updated = raw.slice(0, closingIndex + 1) + insert + raw.slice(closingIndex + 1);
  fs.writeFileSync(file, updated);
  console.log(`Wired frontmatter: ${slug}`);
}

if (!needCovers.length && !needFrontmatter.length) {
  console.log('All blog posts already have covers.');
}
