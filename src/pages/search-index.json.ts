import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/**
 * A small title-level index that backs fuzzy matching in the search dialog.
 *
 * Pagefind matches whole words in the page body, so a typo or a half-remembered
 * title returns nothing. This file is ~40 KB of titles, sections and tags, which
 * the dialog scores character-by-character when Pagefind comes up short.
 */
type Doc = {
  t: string; // title
  u: string; // url, base-prefixed by the client
  s: string; // section
  d?: string; // description
  g?: string[]; // tags
};

const clean = (v?: string) => (v ? v.replace(/\s+/g, ' ').trim().slice(0, 240) : undefined);

export const GET: APIRoute = async () => {
  const docs: Doc[] = [];

  const push = async (
    collection: 'projects' | 'publications' | 'blog' | 'awards' | 'experience' | 'education',
    section: string,
    path: string,
  ) => {
    const items = await getCollection(collection as never);
    for (const entry of items as { id: string; data: Record<string, unknown> }[]) {
      if (entry.data.draft) continue;
      docs.push({
        t: typeof entry.data.title === 'string' ? entry.data.title : entry.id,
        u: `/${path}/${entry.id}/`,
        s: section,
        d: clean(entry.data.description as string | undefined),
        g: (entry.data.categories as string[] | undefined)?.slice(0, 8),
      });
    }
  };

  await push('projects', 'Projects', 'projects');
  await push('publications', 'Publications', 'publications');
  await push('blog', 'Blog', 'blog');
  await push('awards', 'Awards', 'awards');
  await push('experience', 'Experience', 'experience');
  await push('education', 'Education', 'education');

  for (const [t, u, d] of [
    ['Home', '/', 'Portfolio home: research, tools and writing'],
    ['Curriculum Vitae', '/cv/', 'Education, experience, publications and awards'],
    ['Contact', '/contact/', 'Email, booking and the contact form'],
    ['Tags', '/tags/', 'Every tag used across the site'],
    ['Styleguide', '/styleguide/', 'The design system behind the site'],
    ['Privacy', '/privacy/', 'What this site collects'],
  ] as const) {
    docs.push({ t, u, s: 'Page', d });
  }

  return new Response(JSON.stringify(docs), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
