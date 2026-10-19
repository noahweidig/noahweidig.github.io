import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { DISCOVERY_COLLECTIONS } from '../lib/discovery';

export const getStaticPaths = (() =>
  DISCOVERY_COLLECTIONS.map((c) => ({
    params: { collection: c.path },
    props: { name: c.name, section: c.section, path: c.path },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props, site }) => {
  const { name, section, path } = props as { name: string; section: string; path: string };
  const base = site!.origin;
  const entries = (await getCollection(name as never)) as {
    id: string;
    data: Record<string, unknown>;
  }[];
  const lines = [`# ${section}`, '', `Source: ${base}/${path}/`, ''];
  const published = entries
    .filter((e) => !e.data.draft && !e.data['pub-appearance-of'])
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  for (const e of published) {
    const title = typeof e.data.title === 'string' ? e.data.title : e.id;
    const desc = typeof e.data.description === 'string' ? `: ${e.data.description}` : '';
    lines.push(`- [${title}](${base}/${path}/${e.id}.md)${desc}`);
  }
  return new Response(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
