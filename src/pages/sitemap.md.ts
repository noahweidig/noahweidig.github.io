import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../lib/site';

const COLLECTIONS = [
  { name: 'projects', section: 'Projects', path: 'projects' },
  { name: 'publications', section: 'Publications', path: 'publications' },
  { name: 'blog', section: 'Blog', path: 'blog' },
  { name: 'awards', section: 'Awards', path: 'awards' },
  { name: 'experience', section: 'Experience', path: 'experience' },
  { name: 'education', section: 'Education', path: 'education' },
] as const;

const PAGES = [
  ['Home', '/'],
  ['Curriculum Vitae', '/cv/'],
  ['Contact', '/contact/'],
  ['Tags', '/tags/'],
  ['Privacy', '/privacy/'],
] as const;

export const GET: APIRoute = async ({ site: astroSite }) => {
  const base = (astroSite ?? new URL(site.url)).origin;
  const lines: string[] = [`# ${site.name} — Sitemap`, '', `Generated for ${base}`, ''];

  for (const page of PAGES) {
    lines.push(`- [${page[0]}](${base}${page[1]})`);
  }
  lines.push('');

  for (const { name, section, path } of COLLECTIONS) {
    const entries = (await getCollection(name as never)) as {
      id: string;
      data: Record<string, unknown>;
    }[];
    const published = entries
      .filter((e) => !e.data.draft)
      .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
    if (published.length === 0) continue;

    lines.push(`## ${section}`, '');
    lines.push(`- [All ${section.toLowerCase()}](${base}/${path}/)`, '');
    for (const entry of published) {
      const title = typeof entry.data.title === 'string' ? entry.data.title : entry.id;
      lines.push(`- [${title}](${base}/${path}/${entry.id}/)`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
