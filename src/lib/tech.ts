/**
 * The tools shown on the homepage preview and the /tech page, listed in
 * `src/data/tech.json`. `icon` is a file stem in `public/media/icons/tech/`;
 * every mark there is single-color and is drawn as a mask, so it takes the
 * page's text color in either theme.
 */
import data from '../data/tech.json';

export interface Tool {
  name: string;
  icon: string;
  /** Shown in the homepage preview. */
  featured?: boolean;
}

export const techCategories: { name: string; tools: Tool[] }[] = data;

export const allTools = techCategories.flatMap((c) =>
  c.tools.map((t) => ({ ...t, category: c.name })),
);

export const featuredTools = allTools.filter((t) => t.featured);
