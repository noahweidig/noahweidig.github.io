import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection, render } from 'astro:content';
import { getImage } from 'astro:assets';
import sanitizeHtml from 'sanitize-html';
import type { APIContext } from 'astro';
import { site } from '../lib/site';

const escapeXml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Renders a post's Markdown to the same HTML Detail.astro shows, then strips
// anything a feed reader shouldn't execute. `container.renderToString()` runs
// the post's own remark/rehype pipeline (headings, footnotes, code blocks),
// which reimplementing by hand would drift from.
async function renderPostHtml(
  container: AstroContainer,
  post: Awaited<ReturnType<typeof getCollection>>[number],
) {
  const { Content } = await render(post);
  const html = await container.renderToString(Content);
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'figure',
      'figcaption',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
      a: ['href', 'name', 'target', 'rel'],
    },
  });
}

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  const container = await AstroContainer.create();
  const feedSite = context.site ?? new URL(site.url);

  return rss({
    title: 'Noah Weidig — Blog',
    description: 'Notes on science, data, maps, and the landscapes we live in.',
    site: feedSite,
    stylesheet: '/rss/styles.xsl',
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    items: await Promise.all(
      posts.slice(0, 20).map(async (post) => {
        const cover = post.data.image
          ? await getImage({ src: post.data.image, width: 1200 })
          : undefined;
        return {
          title: post.data.title,
          description: post.data.description,
          pubDate: post.data.date,
          link: `/blog/${post.id}/`,
          categories: [...post.data.categories],
          content: await renderPostHtml(container, post),
          customData: `<dc:creator>${escapeXml(post.data.author)}</dc:creator>`,
          ...(cover && {
            enclosure: {
              url: new URL(cover.src, feedSite).href,
              length: 0,
              type: 'image/webp',
            },
          }),
        };
      }),
    ),
    customData: '<language>en-us</language>',
  });
}
