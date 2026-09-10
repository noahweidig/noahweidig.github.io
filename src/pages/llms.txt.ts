import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../lib/site';
import { DISCOVERY_COLLECTIONS, DISCOVERY_PAGES } from '../lib/discovery';

export const GET: APIRoute = async ({ site: astroSite }) => {
  const base = (astroSite ?? new URL(site.url)).origin;
  const lines: string[] = [`${site.name} — public discovery`, '', `Base URL: ${base}`, ''];

  lines.push(
    'Start here:',
    `- ${base}/sitemap.md -> markdown discovery index`,
    `- ${base}/sitemap-index.xml -> XML sitemap for crawlers`,
    `- ${base}/rss.xml -> blog RSS feed`,
    '',
    'Route families:',
  );
  for (const { name, section, path } of DISCOVERY_COLLECTIONS) {
    const entries = (await getCollection(name as never)) as {
      id: string;
      data: Record<string, unknown>;
    }[];
    const example = entries.find((e) => !e.data.draft);
    const sample = example ? ` (e.g. ${base}/${path}/${example.id}/)` : '';
    lines.push(`- ${section}: ${base}/${path}/<slug>${sample}`);
  }
  for (const [label, href] of DISCOVERY_PAGES) {
    if (href === '/') continue;
    lines.push(`- ${label}: ${base}${href}`);
  }
  lines.push(
    '',
    'Formats:',
    '- HTML by default',
    `- Markdown discovery index at ${base}/sitemap.md`,
    '- No public API; content is a static site',
  );

  return new Response(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
