import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/** Directory-per-entry: `src/content/<coll>/<slug>/index.md` → id `<slug>`. */
const dirLoader = (base: string) =>
  glob({
    base,
    pattern: '*/index.md',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  });

const link = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'ghost']).default('ghost'),
  external: z.boolean().optional(),
});

const projects = defineCollection({
  loader: dirLoader('./src/content/projects'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    categories: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    links: z.array(link).default([]),
  }),
});

const publications = defineCollection({
  loader: dirLoader('./src/content/publications'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    categories: z.array(z.string()).default([]),
    citation: z.string().optional(),
    links: z.array(link).default([]),
    'pub-authors': z.string().optional(),
    'pub-venue': z.string().optional(),
    'pub-details': z.string().optional(),
    'pub-doi': z.string().optional(),
    'pub-url': z.string().optional(),
    'pub-pdf': z.string().optional(),
    'pub-oa': z.boolean().optional(),
    'pub-citations': z.number().optional(),
    'pub-listed': z.string().optional(),
    'pub-appearance-of': z.string().optional(),
    'pub-appearance-count': z.number().optional(),
    'pub-appearances': z
      .array(
        z.object({
          venue: z.string().optional(),
          when: z.string().optional(),
          kind: z.string().optional(),
          url: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

const awards = defineCollection({
  loader: dirLoader('./src/content/awards'),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        date: z.coerce.date(),
        description: z.string().optional(),
        featured: z.boolean().default(false),
        image: image().optional(),
        'image-alt': z.string().optional(),
      })
      .refine((data) => !data.image || !!data['image-alt'], {
        message: '`image-alt` is required whenever `image` is set',
        path: ['image-alt'],
      }),
});

const blog = defineCollection({
  loader: dirLoader('./src/content/blog'),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        date: z.coerce.date(),
        description: z.string(),
        categories: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        image: image().optional(),
        // Light-theme counterpart of `image`, swapped in by CSS (`dark:`/light
        // pairing, same as the header's logo and theme-toggle icons). Falls
        // back to `image` when a post doesn't have one.
        'image-light': image().optional(),
        'image-alt': z.string().optional(),
      })
      .refine((data) => !data.image || !!data['image-alt'], {
        message: '`image-alt` is required whenever `image` is set',
        path: ['image-alt'],
      }),
});

const timeline = (base: string) =>
  defineCollection({
    loader: dirLoader(base),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      dates: z.string().optional(),
      description: z.string().optional(),
      org: z.string().optional(),
      'org-url': z.string().optional(),
      location: z.string().optional(),
      categories: z.array(z.string()).default([]),
    }),
  });

export const collections = {
  projects,
  publications,
  awards,
  blog,
  education: timeline('./src/content/education'),
  experience: timeline('./src/content/experience'),
};
