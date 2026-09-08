// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { remarkAlert } from 'remark-github-blockquote-alert';
import { readFileSync, readdirSync } from 'node:fs';
import yaml from 'js-yaml';

const COLLECTIONS = ['blog', 'projects', 'publications', 'awards', 'experience', 'education'];

// Path -> most recent frontmatter date, so the sitemap's <lastmod> reflects
// content that already carries an authoritative date instead of build time.
// astro:content isn't resolvable from this file, so frontmatter is read
// directly rather than through the content collections API.
const lastmodByPath = new Map();
for (const name of COLLECTIONS) {
  const dir = new URL(`./src/content/${name}/`, import.meta.url);
  let newest;
  for (const slug of readdirSync(dir)) {
    const raw = readFileSync(new URL(`${slug}/index.md`, dir), 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const date = new Date(yaml.load(match[1]).date);
    lastmodByPath.set(`/${name}/${slug}/`, date);
    if (!newest || date > newest) newest = date;
  }
  if (newest) lastmodByPath.set(`/${name}/`, newest);
}

export default defineConfig({
  site: 'https://noahweidig.com',
  // The site is published at the apex. `src/lib/url.ts` reads this value back
  // out of import.meta.env.BASE_URL, so hand-written root-relative URLs stay
  // correct if a base path is ever reintroduced.
  base: '/',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/styleguide'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        const d = lastmodByPath.get(path);
        if (d) item.lastmod = d.toISOString();
        return item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    remarkPlugins: [remarkAlert],
    shikiConfig: {
      // github-light's orange (#E36209) is 3.6:1 on the light code surface,
      // which fails AA for small text; the high-contrast variant is built for
      // exactly that and keeps the same palette family.
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-default' },
      wrap: false,
    },
  },
  build: { format: 'directory' },
});
