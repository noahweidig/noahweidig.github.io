export const site = {
  name: 'Noah Weidig',
  role: 'GIS Analyst & Data Scientist',
  url: 'https://noahweidig.com',
  email: 'noah@noahweidig.com',
  location: 'Orlando, FL',
  booking: 'https://cal.com/noahweidig/meet',
  resume: '/uploads/resume.pdf',
  cv: '/uploads/cv.pdf',
  description:
    'Noah is an ecologist and GIS analyst specializing in geospatial data science, environmental modeling, and large-scale spatial analysis.',
  // 1200x630 (the standard OG/Twitter card ratio), smart-cropped from `me.webp`
  // so link previews on Slack/X/LinkedIn/Facebook don't auto-crop a square photo.
  ogImage: '/media/authors/me-og.webp',
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
  { text: 'Projects', href: '/projects/', tip: 'Open tools, maps and applications' },
  { text: 'Publications', href: '/publications/', tip: 'Papers, talks and peer review' },
  { text: 'Experience', href: '/experience/', tip: 'Roles, research posts and internships' },
  { text: 'Awards', href: '/awards/', tip: 'Fellowships, scholarships and honors' },
  { text: 'Blog', href: '/blog/', tip: 'Notes and tutorials on R and spatial work' },
  { text: 'CV', href: '/cv/', tip: 'Full record, plus CV and résumé PDFs' },
  { text: 'Contact', href: '/contact/', tip: 'Email, booking and the contact form' },
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
      { text: 'Experience', href: '/experience/', tip: 'Roles, research posts and internships' },
      { text: 'Education', href: '/education/', tip: 'Degrees, theses and coursework' },
      { text: 'Skills', href: '/#skills', tip: 'The tools I work with day to day' },
      { text: 'Affiliations', href: '/#affiliations', tip: 'Societies and labs I belong to' },
    ],
  },
  {
    heading: 'Work',
    links: [
      { text: 'Projects', href: '/projects/', tip: 'Open tools, maps and applications' },
      {
        text: 'Geo Portfolio',
        href: 'https://noahweidig.com/geo-portfolio',
        tip: 'Interactive map gallery (opens a separate site)',
      },
      { text: 'Awards', href: '/awards/', tip: 'Fellowships, scholarships and honors' },
      { text: 'Interests', href: '/#interests', tip: 'Six research focus areas' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { text: 'Publications', href: '/publications/', tip: 'Papers, talks and peer review' },
      { text: 'Blog', href: '/blog/', tip: 'Notes and tutorials on R and spatial work' },
      { text: 'CV', href: '/cv/', tip: 'Full record, plus CV and résumé PDFs' },
      { text: 'FAQ', href: '/#faq', tip: 'Common questions about my work' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { text: 'Email', href: 'mailto:noah@noahweidig.com', tip: 'Email me directly' },
      { text: 'Contact', href: '/contact/', tip: 'Send a message through the site' },
      {
        text: 'Book a Call',
        href: 'https://cal.com/noahweidig/meet',
        tip: 'Book a 30-minute call on Cal.com',
      },
      {
        text: 'LinkedIn',
        href: 'https://www.linkedin.com/in/noahweidig/',
        tip: 'LinkedIn profile',
      },
    ],
  },
] as const;
