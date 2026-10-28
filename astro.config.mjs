// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';

const COLLECTIONS = ['blog', 'projects', 'publications', 'awards', 'experience', 'education'];

// Path -> most recent frontmatter date, so the sitemap's <lastmod> reflects
// content that already carries an authoritative date instead of build time.
// astro:content isn't resolvable from this file, so frontmatter is read
// directly rather than through the content collections API.
const lastmodByPath = new Map();
// Publication "appearance" records (pub-appearance-of set) are noindexed by
// src/pages/publications/[...slug].astro — excluded here too so the sitemap
// never contradicts that signal.
const excludedPaths = new Set(['/404/', '/500/', '/print/resume/']);
const noindexedPaths = new Set();
for (const name of COLLECTIONS) {
  const dir = new URL(`./src/content/${name}/`, import.meta.url);
  let newest;
  for (const slug of readdirSync(dir)) {
    const raw = readFileSync(new URL(`${slug}/index.md`, dir), 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const data = load(match[1]);
    const date = new Date(data.date);
    const path = `/${name}/${slug}/`;
    if (name === 'publications' && data['pub-appearance-of']) {
      noindexedPaths.add(path);
      continue;
    }
    lastmodByPath.set(path, date);
    if (!newest || date > newest) newest = date;
  }
  if (newest) lastmodByPath.set(`/${name}/`, newest);
}

export default defineConfig({
  site: 'https://noahweidig.com',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        if (excludedPaths.has(path.replace(/\/?$/, '/'))) return false;
        return !noindexedPaths.has(path);
      },
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
