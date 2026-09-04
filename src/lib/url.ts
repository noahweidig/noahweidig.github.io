/**
 * The site is published at the apex (`base` is `/` in astro.config.mjs), so this
 * is a no-op today. `import.meta.env.BASE_URL` is Astro's own value for `base`,
 * so hand-written root-relative URLs stay correct if a base path is ever set.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefixes a root-relative path with the site's base path. */
export const u = (path: string): string =>
  path.startsWith('/') && !path.startsWith('//') ? `${BASE}${path}` : path;

export const base = BASE;
