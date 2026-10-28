/* ------------------------------------------------- lucide icons as strings -- */
import { scriptIcons } from '../lib/icons.script.generated';

/* The same Lucide glyphs <Icon> renders, for scripts that build markup. The
   set is in src/lib/icons.script.generated.ts; add a name to SCRIPT in
   scripts/generate/icons.mjs to use another one here. */
export function iconSvg(name: string, size = 16, strokeWidth = 1.6): string {
  const glyph = scriptIcons[name];
  if (!glyph) throw new Error(`iconSvg: unknown icon "${name}"`);
  return `<svg viewBox="${glyph.viewBox}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${glyph.body}</svg>`;
}
