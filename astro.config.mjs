// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync } from 'node:fs';

// Publication "appearance" records (pub-appearance-of set) are noindexed by
// src/pages/publications/[...slug].astro — excluded here too so the sitemap
// never contradicts that signal. astro:content isn't resolvable from this
// file, so the frontmatter key is matched directly.
const excludedPaths = new Set(['/404/', '/print/resume/']);
const noindexedPaths = new Set();
const pubsDir = new URL('./src/content/publications/', import.meta.url);
for (const slug of readdirSync(pubsDir)) {
  const raw = readFileSync(new URL(`${slug}/index.md`, pubsDir), 'utf-8');
  if (/^pub-appearance-of:\s*\S/m.test(raw.split(/^---$/m)[1] ?? '')) {
    noindexedPaths.add(`/publications/${slug}/`);
  }
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
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  build: { format: 'directory' },
});
