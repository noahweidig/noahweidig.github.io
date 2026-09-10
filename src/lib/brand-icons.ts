/**
 * Brand icon registry — the SVGs in `public/uploads/`, parsed once at build
 * time. A plain module (rather than living inside Icon.astro's frontmatter)
 * so the glob-and-regex-parse work runs once for the whole build: Astro
 * re-executes a component's frontmatter on every instantiation, but an
 * imported module's top-level code runs once and its exports are cached.
 */
const brandFiles = import.meta.glob<string>('/public/uploads/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const BRAND_ALIAS: Record<string, string> = { x: 'x-twitter', twitter: 'x-twitter' };

export const brand: Record<string, { viewBox: string; body: string }> = {};
for (const [path, raw] of Object.entries(brandFiles)) {
  const key = path
    .split('/')
    .pop()!
    .replace(/\.svg$/, '');
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 448 448';
  const body = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  brand[key] = { viewBox, body };
}
