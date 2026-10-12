export const TINTS = ['purple', 'green', 'orange', 'teal', 'pink', 'yellow', 'red', 'brown'] as const;
export type Tint = (typeof TINTS)[number];

/** Stable color for a tag/category: the same label always gets the same tint. */
export function tintFor(label: string): Tint {
  let h = 0;
  for (const ch of label.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
