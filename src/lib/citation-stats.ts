import raw from '../data/citation-stats.json';

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

const stats = raw as Record<string, CitationStats>;

const normalizeDoi = (doi: string) =>
  doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

/** Cached Dimensions/Altmetric attention data for a DOI, fetched by the
 * `update-citation-stats` GitHub Action (scripts/update-citation-stats.js)
 * rather than the vendors' own client-side badge widgets. */
export function citationStatsFor(doi: string | undefined | null): CitationStats | undefined {
  if (!doi) return undefined;
  return stats[normalizeDoi(doi)];
}
