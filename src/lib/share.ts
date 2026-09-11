export interface ShareTarget {
  label: string;
  icon: string;
  href: string;
}

/** Builds the per-platform share URLs used by both ShareRow and PostAside. */
export function buildShareTargets(title: string, url: string): ShareTarget[] {
  const t = encodeURIComponent(title);
  const u = encodeURIComponent(url);
  return [
    { label: 'X', icon: 'x', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    {
      label: 'LinkedIn',
      icon: 'linkedin',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      label: 'Bluesky',
      icon: 'bluesky',
      href: `https://bsky.app/intent/compose?text=${t}%20${u}`,
    },
    {
      label: 'Facebook',
      icon: 'facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      label: 'Reddit',
      icon: 'reddit',
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    },
    {
      label: 'Pinterest',
      icon: 'pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`,
    },
    {
      label: 'Mastodon',
      icon: 'mastodon',
      href: `https://mastodonshare.com/?text=${t}&url=${u}`,
    },
    { label: 'WhatsApp', icon: 'whatsapp', href: `https://wa.me/?text=${t}%20${u}` },
    {
      label: 'Threads',
      icon: 'threads',
      href: `https://www.threads.net/intent/post?text=${t}%20${u}`,
    },
    { label: 'Email', icon: 'envelope', href: `mailto:?subject=${t}&body=${u}` },
  ];
}
