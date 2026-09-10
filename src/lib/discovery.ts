/** Shared config for the site's discovery surfaces (`/sitemap.md`, `/llms.txt`). */

export const DISCOVERY_COLLECTIONS = [
  { name: 'projects', section: 'Projects', path: 'projects' },
  { name: 'publications', section: 'Publications', path: 'publications' },
  { name: 'blog', section: 'Blog', path: 'blog' },
  { name: 'awards', section: 'Awards', path: 'awards' },
  { name: 'experience', section: 'Experience', path: 'experience' },
  { name: 'education', section: 'Education', path: 'education' },
] as const;

export const DISCOVERY_PAGES = [
  ['Home', '/'],
  ['Curriculum Vitae', '/cv/'],
  ['Contact', '/contact/'],
  ['Tags', '/tags/'],
  ['Privacy', '/privacy/'],
] as const;
