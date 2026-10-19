import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { DISCOVERY_COLLECTIONS } from '../../lib/discovery';

type Entry = { id: string; body?: string; data: Record<string, unknown> };

export const getStaticPaths = (async () => {
  const paths = [];
  for (const { name, path } of DISCOVERY_COLLECTIONS) {
    const entries = (await getCollection(name as never)) as Entry[];
    for (const entry of entries) {
      if (entry.data.draft) continue;
      paths.push({ params: { collection: path, slug: entry.id }, props: { entry, path } });
    }
  }
  return paths;
}) satisfies GetStaticPaths;

const SKIP = new Set(['title', 'draft', 'links', 'image', 'cover', 'images']);

const fmt = (v: unknown): string | undefined => {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join(', ') : undefined;
  if (typeof v === 'object') return undefined;
  return String(v);
};

export const GET: APIRoute = ({ props, site }) => {
  const { entry, path } = props as { entry: Entry; path: string };
  const base = site!.origin;
  const d = entry.data;
  const lines = [`# ${d.title ?? entry.id}`, '', `Source: ${base}/${path}/${entry.id}/`];
  for (const [k, v] of Object.entries(d)) {
    const s = SKIP.has(k) ? undefined : fmt(v);
    if (s) lines.push(`${k}: ${s}`);
  }
  const links = Array.isArray(d.links) ? (d.links as { label: string; href: string }[]) : [];
  for (const l of links) {
    lines.push(`${l.label}: ${l.href.startsWith('/') ? base + l.href : l.href}`);
  }
  lines.push('', (entry.body ?? '').trim(), '');
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
