import { describe, expect, it, vi } from 'vitest';

vi.mock('../data/citation-stats.json', () => ({
  default: {
    '10.1234/example': { dimensions: { timesCited: 5, recentCitations: 1, url: 'x' } },
  },
}));

const { citationStatsFor } = await import('./citation-stats');

describe('citationStatsFor', () => {
  it('looks up a bare DOI', () => {
    expect(citationStatsFor('10.1234/example')?.dimensions?.timesCited).toBe(5);
  });
  it('normalizes a doi.org URL and case', () => {
    expect(citationStatsFor('https://doi.org/10.1234/Example')?.dimensions?.timesCited).toBe(5);
    expect(citationStatsFor('http://dx.doi.org/10.1234/EXAMPLE')?.dimensions?.timesCited).toBe(5);
  });
  it('returns undefined for missing or nullish input', () => {
    expect(citationStatsFor(undefined)).toBeUndefined();
    expect(citationStatsFor(null)).toBeUndefined();
    expect(citationStatsFor('10.9999/unknown')).toBeUndefined();
  });
});
