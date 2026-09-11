// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import postAudit from '@casoon/astro-post-audit';
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
      filter: (page) =>
        !page.includes('/404') && !page.includes('/500') && !page.includes('/styleguide'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        const d = lastmodByPath.get(path);
        if (d) item.lastmod = d.toISOString();
        return item;
      },
    }),
    // Post-build audit of the rendered HTML in dist/ — canonicals, headings,
    // link and asset health, structured data. Last in the array so it runs
    // after @astrojs/sitemap has written the sitemap it checks.
    //
    // Report-only by default. This integration runs inside every `astro
    // build`, the one that deploys Pages included, and a finding from an
    // audit rule should not be able to stop a deploy; AUDIT_FAIL_ON=errors
    // turns it into a gate for a build that wants one.
    //
    // The checks live in a prebuilt binary the package fetches in a
    // postinstall. Installs here run with --ignore-scripts, so the binary is
    // absent unless a workflow fetches it explicitly — without it the
    // integration warns and skips instead of failing.
    postAudit({
      preset: 'standard',
      failOn: process.env.AUDIT_FAIL_ON === 'errors' ? 'errors' : 'never',
      // Written only when asked for: the integration does not create the
      // directory, so an unprepared build would report a write error.
      ...(process.env.AUDIT_REPORTS === '1'
        ? { reports: { markdown: '.audit/report.md', json: '.audit/report.json' } }
        : {}),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // The AI search panel posts to /api/ai-search, which only exists on the
    // Cloudflare Worker in front of production. Left unproxied, `astro dev`
    // answers it with a 404 and the dialog latches the AI off for the page
    // load, which is the behaviour a Netlify preview gets too. Set
    // AI_WORKER=http://localhost:8788 alongside `npm --prefix worker run dev`
    // to exercise it locally instead.
    ...(process.env.AI_WORKER
      ? { server: { proxy: { '/api': { target: process.env.AI_WORKER, changeOrigin: true } } } }
      : {}),
  },
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
