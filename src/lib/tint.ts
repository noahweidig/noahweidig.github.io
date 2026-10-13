export const TINTS = ['blue', 'green', 'purple', 'yellow', 'red', 'teal', 'pink'] as const;
export type Tint = (typeof TINTS)[number];

/* One color per site section, shared by the navbar, page and section kickers,
   and any tag or category that carries a section's name. Edit here only. */
export const SECTION_TINT: Record<string, Tint> = {
  Projects: 'green',
  Publications: 'purple',
  Experience: 'blue',
  About: 'red',
  Education: 'blue',
  Awards: 'yellow',
  CV: 'green',
  Blog: 'purple',
  Newsletter: 'yellow',
  'Tech stack': 'teal',
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

/* Fixed colors for known categories, so neighbors in one filter bar never share
   a color. Anything else falls back to a stable hash of its label. */
const CATEGORY_TINT: Record<string, Tint> = {
  'Journal Article': 'blue',
  Presentation: 'purple',
  'Peer Review': 'yellow',
  'Media Coverage': 'pink',
  Webinar: 'teal',
  Thesis: 'green',
  'Data Science': 'blue',
  Geospatial: 'green',
  R: 'purple',
  Fire: 'red',
  Creative: 'pink',
  APIs: 'teal',
  Thoughts: 'yellow',
};

/** Stable color for a tag/category: the same label always gets the same tint. */
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

export function tintFor(label: string): Tint {
  const fixed = SECTION_TINT[SECTION_ALIAS[label] ?? label] ?? CATEGORY_TINT[label];
  if (fixed) return fixed;
  let h = 0;
  for (const ch of label.toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TINTS[h % TINTS.length]!;
}

/** Rotating color for the i-th item in a list. */
export function tintAt(i: number): Tint {
  return TINTS[i % TINTS.length]!;
}

const VAR: Record<Tint, string> = {
  blue: 'accent-ink',
  green: 'moss',
  purple: 'violet',
  yellow: 'yellow',
  red: 'red',
  teal: 'teal',
  pink: 'pink',
};

/** CSS color variable for a tint, for plain `color:` uses (icons, eyebrows). */
export const tintVar = (t: Tint) => `var(--c-${t === 'yellow' ? 'yellow-ink' : VAR[t]})`;

/** Base (wash) color variable for a tint; yellow stays Notion yellow in both themes. */
export const tintBase = (t: Tint) => `var(--c-${t === 'blue' ? 'accent' : VAR[t]})`;
