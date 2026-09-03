export const site = {
  name: 'Noah Weidig',
  role: 'GIS Analyst & Data Scientist',
  url: 'https://noahweidig.com/new-website',
  email: 'noah@noahweidig.com',
  location: 'Orlando, FL',
  booking: 'https://cal.com/noahweidig/meet',
  resume: '/uploads/resume.pdf',
  description:
    'Noah is an ecologist and GIS analyst specializing in geospatial data science, environmental modeling, and large-scale spatial analysis.',
  ogImage: '/media/authors/me.webp',
  analyticsId: 'G-WSCVDHQJ7H',
} as const;

/**
 * Giscus, for blog-post comments. The widget only mounts once `repoId` and
 * `categoryId` are filled in — giscus.app rejects a mount without them, and a
 * visible "giscus is not installed" error is worse than no comments at all.
 * Both ids come from https://giscus.app after enabling Discussions on the repo.
 */
export const giscus = {
  repo: 'noahweidig/noahweidig.github.io',
  repoId: '',
  category: 'General',
  categoryId: '',
} as const;

export const nav = [
  { text: 'Projects', href: '/projects/' },
  { text: 'Publications', href: '/publications/' },
  { text: 'Experience', href: '/experience/' },
  { text: 'Awards', href: '/awards/' },
  { text: 'Blog', href: '/blog/' },
  { text: 'CV', href: '/cv/' },
  { text: 'Contact', href: '/contact/' },
] as const;

export const socials = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/noahweidig/', icon: 'linkedin' },
  { label: 'GitHub', href: 'https://github.com/noahweidig/', icon: 'github' },
  {
    label: 'Google Scholar',
    href: 'https://scholar.google.com/citations?hl=en&user=Ml95eTwAAAAJ',
    icon: 'scholar',
  },
  { label: 'ORCID', href: 'https://orcid.org/0000-0003-1205-3209', icon: 'orcid' },
] as const;

export const footerColumns = [
  {
    heading: 'About',
    links: [
      { text: 'Experience', href: '/experience/', icon: 'briefcase' },
      { text: 'Education', href: '/education/', icon: 'school' },
      { text: 'Skills', href: '/#skills', icon: 'code' },
      { text: 'Affiliations', href: '/#affiliations', icon: 'users' },
    ],
  },
  {
    heading: 'Work',
    links: [
      { text: 'Projects', href: '/projects/', icon: 'sparkles' },
      { text: 'Geo Portfolio', href: 'https://noahweidig.com/geo-portfolio', icon: 'layers' },
      { text: 'Awards', href: '/awards/', icon: 'trophy' },
      { text: 'Interests', href: '/#interests', icon: 'bulb' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { text: 'Publications', href: '/publications/', icon: 'file' },
      { text: 'Blog', href: '/blog/', icon: 'pencil' },
      { text: 'CV', href: '/cv/', icon: 'file' },
      { text: 'FAQ', href: '/#faq', icon: 'help' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { text: 'Email', href: 'mailto:noah@noahweidig.com', icon: 'mail' },
      { text: 'Contact', href: '/contact/', icon: 'message' },
      { text: 'Book a Call', href: 'https://cal.com/noahweidig/meet', icon: 'calendar' },
      { text: 'LinkedIn', href: 'https://www.linkedin.com/in/noahweidig/', icon: 'linkedin' },
    ],
  },
] as const;
