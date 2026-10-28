import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection, render } from 'astro:content';
import { byDate } from '../lib/format';
import sanitizeHtml from 'sanitize-html';
import type { APIContext } from 'astro';
import { site } from '../lib/site';

const escapeXml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Renders a post's Markdown to the same HTML Detail.astro shows, then strips
// anything a feed reader shouldn't execute. `container.renderToString()` runs
// the post's own remark/rehype pipeline (headings, footnotes, code blocks),
// which reimplementing by hand would drift from. Relative `src`/`href` values
// (e.g. `../../media/...`) are resolved against the post's URL because readers
// don't agree on a base for them.
async function renderPostHtml(
  container: AstroContainer,
  post: Awaited<ReturnType<typeof getCollection>>[number],
  base: URL,
) {
  const absolutize =
    (attr: 'src' | 'href'): sanitizeHtml.Transformer =>
    (tagName, attribs) => {
      if (attribs[attr]) attribs[attr] = new URL(attribs[attr], base).href;
      return { tagName, attribs };
    };
  const { Content } = await render(post);
  const html = await container.renderToString(Content);
  return sanitizeHtml(html, {
    transformTags: { img: absolutize('src'), a: absolutize('href') },
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
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(byDate);
  const container = await AstroContainer.create();
  const feedSite = context.site ?? new URL(site.url);

  return rss({
    title: 'Noah Weidig — Blog',
    description: 'Notes on science, data, maps, and the landscapes we live in.',
    site: feedSite,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    items: await Promise.all(
      posts.slice(0, 20).map(async (post) => {
        return {
          title: post.data.title,
          description: post.data.description,
          pubDate: post.data.date,
          link: `/blog/${post.id}/`,
          categories: [...post.data.categories],
          content: await renderPostHtml(container, post, new URL(`/blog/${post.id}/`, feedSite)),
          customData: `<dc:creator>${escapeXml(post.data.author)}</dc:creator>`,
        };
      }),
    ),
    customData: '<language>en-us</language>',
  });
}
