export const fullDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const year = (d: Date) => d.getUTCFullYear();

export const slugify = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Renders the tiny `**bold**` / `*italic*` subset used in citation strings. */
export function inlineMarkup(input: string): string {
  const escaped = String(input).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/** ~200 wpm, matching the reading-time estimate the old build stamped in. */
export function readingTime(body: string | undefined): string {
  const words = String(body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** First sentence of a description, for the compact citation rows. */
export function firstSentence(text: string | undefined, max = 200): string {
  let t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  const stop = t.slice(0, max).search(/[.!?](\s|$)/);
  if (stop > 40) return t.slice(0, stop + 1);
  if (t.length > max) {
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s.,;:]+$/, '') + '…';
  }
  return t;
}
