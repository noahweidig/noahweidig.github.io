/**
 * Named responsive-width scales for astro:assets' <Image widths={...}>.
 * Keep each scale's name tied to its usage context, not its numbers —
 * if the numbers change, the name should still describe the right thing.
 */
export const IMAGE_WIDTHS = {
  /** List/grid thumbnails, e.g. PostCard */
  thumbnail: [400, 800, 1200],
  /** Smaller thumbnails, e.g. AwardCard */
  thumbnailSmall: [320, 640, 960],
  /** Full-width hero/cover images, e.g. blog post detail page */
  hero: [600, 1000, 1600],
} satisfies Record<string, number[]>;
