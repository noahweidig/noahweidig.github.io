// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://noahweidig.com',
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      wrap: false,
    },
  },
  build: { format: 'directory' },
});
