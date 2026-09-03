import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { site } from '../lib/site';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  return rss({
    title: 'Noah Weidig — Blog',
    description: 'Notes on science, data, maps, and the landscapes we live in.',
    site: context.site ?? site.url,
    items: posts.slice(0, 20).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
      categories: [...post.data.categories],
    })),
    customData: '<language>en-us</language>',
  });
}
