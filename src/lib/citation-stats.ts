import raw from '../data/citation-stats.json' with { type: 'json' };

export interface DimensionsStats {
  timesCited: number;
  recentCitations: number | null;
  fieldCitationRatio: number | null;
  relativeCitationRatio: number | null;
  url: string;
}

export interface AltmetricStats {
  score: number;
  postsCount: number;
  detailsUrl: string;
  imageUrl?: string;
}

export interface CitationStats {
  dimensions?: DimensionsStats;
  altmetric?: AltmetricStats;
}

const normalizeDoi = (doi: string) =>
  doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

/** A DOI lookup over a table of cached stats, keyed by normalized DOI. */
export const makeCitationStatsFor =
  (stats: Record<string, CitationStats>) =>
  (doi: string | undefined | null): CitationStats | undefined =>
    doi ? stats[normalizeDoi(doi)] : undefined;

/** Cached Dimensions/Altmetric attention data for a DOI, fetched by the
 * `update-citation-stats` GitHub Action (scripts/sync/citation-stats.js)
 * rather than the vendors' own client-side badge widgets. */
export const citationStatsFor = makeCitationStatsFor(raw as Record<string, CitationStats>);
