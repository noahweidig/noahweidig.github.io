import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeCitationStatsFor } from './citation-stats.ts';

const citationStatsFor = makeCitationStatsFor({
  '10.1234/example': { dimensions: { timesCited: 5, recentCitations: 1, url: 'x' } },
} as never);

describe('citationStatsFor', () => {
  it('looks up a bare DOI', () => {
    assert.equal(citationStatsFor('10.1234/example')?.dimensions?.timesCited, 5);
  });
  it('normalizes a doi.org URL and case', () => {
    assert.equal(citationStatsFor('https://doi.org/10.1234/Example')?.dimensions?.timesCited, 5);
    assert.equal(citationStatsFor('http://dx.doi.org/10.1234/EXAMPLE')?.dimensions?.timesCited, 5);
  });
  it('returns undefined for missing or nullish input', () => {
    assert.equal(citationStatsFor(undefined), undefined);
    assert.equal(citationStatsFor(null), undefined);
    assert.equal(citationStatsFor('10.9999/unknown'), undefined);
  });
});
