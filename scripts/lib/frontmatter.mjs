import yaml from 'js-yaml';

/** Parsed YAML frontmatter of a markdown entry, or `{}` if it has none. */
export function readFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return (match && yaml.load(match[1])) || {};
}
