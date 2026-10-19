import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

// Static routes that get a markdown twin; `/about/` -> `about.md`, `/` -> `index.md`.
const STATIC_MD_ROUTES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/data/static-md-routes.json', import.meta.url)),
    'utf-8',
  ),
);
const mdFileFor = (route) => (route === '/' ? 'index.md' : route.slice(1, -1) + '.md');

const DROP = ['script', 'style', 'svg', 'form', 'button', 'nav', 'iframe', 'noscript', 'template'];

/** Render the `<main>` of a built page to markdown, with absolute URLs. */
export function htmlToMarkdown(html, origin) {
  const raw = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!raw) return undefined;
  const main = raw.replace(/<\/span>(?=<span\b)/g, '</span> ');
  const title = html
    .match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    ?.trim()
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'");
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', hr: '---' });
  td.remove(DROP);
  td.remove((n) => n.getAttribute?.('aria-hidden') === 'true' || n.hasAttribute?.('hidden'));
  td.addRule('absoluteLinks', {
    filter: 'a',
    replacement(content, node) {
      const href = node.getAttribute('href');
      const text = content.replace(/\s+/g, ' ').trim();
      if (!href || href.startsWith('#') || !text) return text;
      return ` [${text}](${new URL(href, origin + '/').href}) `;
    },
  });
  td.addRule('absoluteImages', {
    filter: 'img',
    replacement(_, node) {
      const alt = (node.getAttribute('alt') ?? '').trim();
      const src = node.getAttribute('src');
      return alt && src ? `![${alt}](${new URL(src, origin + '/').href})` : '';
    },
  });
  const body = td
    .turndown(main)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^-\s*$\n?/gm, '')
    .replace(/^ +(?=\[)/gm, '')
    .replace(/^-   /gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${title ? `<!-- ${title} -->\n\n` : ''}${body}\n`;
}

/** Writes dist/<page>.md next to each static page's HTML after the build. */
export default function staticMarkdown() {
  return {
    name: 'static-markdown',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        for (const route of STATIC_MD_ROUTES) {
          const src = route.slice(1) + 'index.html';
          const out = mdFileFor(route);
          if (!existsSync(root + src)) continue;
          const md = htmlToMarkdown(readFileSync(root + src, 'utf-8'), 'https://noahweidig.com');
          if (md) writeFileSync(root + out, md);
        }
      },
    },
  };
}
