export const TINTS = ['blue', 'green', 'purple', 'yellow', 'red'] as const;
export type Tint = (typeof TINTS)[number];

/** Stable color for a tag/category: the same label always gets the same tint. */
export function tintFor(label: string): Tint {
  let h = 0;
  for (const ch of label.toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TINTS[h % TINTS.length]!;
}

/** Rotating color for the i-th item in a list. */
export function tintAt(i: number): Tint {
  return TINTS[i % TINTS.length]!;
}

/** CSS color variable for a tint, for plain `color:` uses (icons, eyebrows). */
export const tintVar = (t: Tint) =>
  `var(--c-${{ blue: 'accent-ink', green: 'moss', purple: 'violet', yellow: 'ink', red: 'red' }[t]})`;
