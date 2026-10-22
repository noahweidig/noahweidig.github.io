/* The site has one accent: blue. Sections, categories and tiles all draw it,
   so nothing here varies; the helpers stay so call sites don't change. */
export const TINTS = ['blue'] as const;
export type Tint = (typeof TINTS)[number];

/* Every site section, shared by the navbar, page and section kickers. */
export const SECTION_TINT: Record<string, Tint> = {
  Projects: 'blue',
  Publications: 'blue',
  Experience: 'blue',
  About: 'blue',
  Education: 'blue',
  Awards: 'blue',
  CV: 'blue',
  Blog: 'blue',
  Newsletter: 'blue',
  'Tech stack': 'blue',
  FAQ: 'blue',
};

/* Kicker and label words that stand for a section above. */
const SECTION_ALIAS: Record<string, string> = {
  Project: 'Projects',
  'Featured project': 'Projects',
  'Selected work': 'Projects',
  Publication: 'Publications',
  'Research output': 'Publications',
  'Research areas': 'Publications',
  Background: 'Experience',
  Award: 'Awards',
  Recognition: 'Awards',
  Writing: 'Blog',
  Tools: 'Tech stack',
  Tech: 'Tech stack',
};

/* Icon drawn beside a section's eyebrow, matching the nav's icons. */
const SECTION_ICON: Record<string, string> = {
  Projects: 'terminal',
  Publications: 'book',
  Experience: 'briefcase',
  About: 'users',
  Education: 'graduationCap',
  Awards: 'trophy',
  CV: 'file',
  Blog: 'pencil',
  Newsletter: 'mail',
  'Tech stack': 'cpu',
  FAQ: 'help',
};

/** Icon for an eyebrow label, or undefined when it names no known section. */
export const iconFor = (label: string): string | undefined =>
  SECTION_ICON[SECTION_ALIAS[label] ?? label];

/** Accent tint for a label; always blue. */
export const tintFor = (_label: string): Tint => 'blue';

/** Accent tint for the i-th item in a list; always blue. */
export const tintAt = (_i: number): Tint => 'blue';

/** Base (wash) color variable for a tint. */
export const tintBase = (_t: Tint) => 'var(--c-accent)';
