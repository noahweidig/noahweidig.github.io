export const TINTS = ['blue', 'green', 'purple', 'yellow', 'red', 'teal', 'pink'] as const;
export type Tint = (typeof TINTS)[number];

/* Fixed colors for known categories, so neighbors in one filter bar never share
   a color. Anything else falls back to a stable hash of its label. */
const CATEGORY_TINT: Record<string, Tint> = {
  'Journal Article': 'blue',
  Presentation: 'purple',
  'Peer Review': 'yellow',
  'Media Coverage': 'pink',
  Webinar: 'teal',
  Thesis: 'green',
  Experience: 'green',
  Education: 'yellow',
  'Data Science': 'blue',
  Geospatial: 'green',
  R: 'purple',
  Fire: 'red',
  Creative: 'pink',
  APIs: 'teal',
  Tech: 'teal',
  Thoughts: 'yellow',
};

/** Stable color for a tag/category: the same label always gets the same tint. */
export function tintFor(label: string): Tint {
  const fixed = CATEGORY_TINT[label];
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
