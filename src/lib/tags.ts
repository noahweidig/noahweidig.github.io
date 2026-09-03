import { getCollection } from 'astro:content';
import { slugify } from './format';

export interface TagItem {
  section: 'Projects' | 'Publications' | 'Blog';
  href: string;
  title: string;
  description?: string;
  date: Date;
}

export interface TagGroup {
  /** The label as authored, e.g. "Journal Article". */
  name: string;
  slug: string;
  items: TagItem[];
}

/**
 * Every category used anywhere, mapped to the entries carrying it. Project and
 * blog tags and publication types share one namespace: they are the same kind
 * of label to a reader, and a page per label is more useful than three.
 */
export async function tagGroups(): Promise<TagGroup[]> {
  const [projects, publications, blog] = await Promise.all([
    getCollection('projects'),
    getCollection('publications'),
    getCollection('blog', ({ data }) => !data.draft),
  ]);

  const byName = new Map<string, TagGroup>();
  const add = (name: string, item: TagItem) => {
    const key = name.trim();
    if (!key) return;
    const group = byName.get(key) ?? { name: key, slug: slugify(key), items: [] };
    group.items.push(item);
    byName.set(key, group);
  };

  for (const p of projects) {
    for (const c of p.data.categories) {
      add(c, {
        section: 'Projects',
        href: `/projects/${p.id}/`,
        title: p.data.title,
        description: p.data.description,
        date: p.data.date,
      });
    }
  }

  for (const p of publications) {
    // Repeat appearances of one work share a category; only the listed record
    // stands in for the work, matching the publications index.
    if (p.data['pub-listed'] !== 'yes') continue;
    for (const c of p.data.categories) {
      add(c, {
        section: 'Publications',
        href: `/publications/${p.id}/`,
        title: p.data.title,
        description: p.data['pub-venue'],
        date: p.data.date,
      });
    }
  }

  for (const p of blog) {
    for (const c of p.data.categories) {
      add(c, {
        section: 'Blog',
        href: `/blog/${p.id}/`,
        title: p.data.title,
        description: p.data.description,
        date: p.data.date,
      });
    }
  }

  return [...byName.values()]
    .map((g) => ({
      ...g,
      items: g.items.sort((a, b) => b.date.getTime() - a.date.getTime()),
    }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

/** Where a category chip points. */
export const tagHref = (name: string) => `/tags/${slugify(name)}/`;
