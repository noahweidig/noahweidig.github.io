/**
 * The site is published under a base path (`/new-website`, set in astro.config.mjs), so every
 * root-relative URL written by hand has to carry it. `import.meta.env.BASE_URL`
 * is Astro's own value for `base`, so this stays correct if the base changes —
 * including back to `/`.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefixes a root-relative path with the site's base path. */
export const u = (path: string): string =>
  path.startsWith('/') && !path.startsWith('//') ? `${BASE}${path}` : path;

export const base = BASE;
