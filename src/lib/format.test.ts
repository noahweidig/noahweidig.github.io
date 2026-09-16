import { describe, expect, it } from 'vitest';
import { firstSentence, inlineMarkup, readingTime, slugify, splitAuthors } from './format';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Data Science')).toBe('data-science');
  });
  it('strips leading/trailing dashes from non-alnum edges', () => {
    expect(slugify('  R & Python! ')).toBe('r-python');
  });
});

describe('inlineMarkup', () => {
  it('escapes html', () => {
    expect(inlineMarkup('<script>&')).toBe('&lt;script&gt;&amp;');
  });
  it('renders bold and italic', () => {
    expect(inlineMarkup('**bold** and *italic*')).toBe('<strong>bold</strong> and <em>italic</em>');
  });
});

describe('readingTime', () => {
  it('floors at 1 minute', () => {
    expect(readingTime('a few words')).toBe('1 min read');
  });
  it('ignores fenced code blocks', () => {
    expect(readingTime('word '.repeat(200) + '```' + 'x '.repeat(1000) + '```')).toBe('1 min read');
  });
  it('rounds to nearest minute at ~200wpm', () => {
    expect(readingTime('word '.repeat(400))).toBe('2 min read');
  });
});

describe('splitAuthors', () => {
  it('splits "Surname, Initials" pairs joined by commas and a final &', () => {
    expect(splitAuthors('Ivey, M. A., Wonkka, C. L. & Weidig, N. C.')).toEqual([
      'Ivey, M. A.',
      'Wonkka, C. L.',
      'Weidig, N. C.',
    ]);
  });
  it('handles a single author', () => {
    expect(splitAuthors('Weidig, N. C.')).toEqual(['Weidig, N. C.']);
  });
  it('handles two authors joined only by &', () => {
    expect(splitAuthors('Ivey, M. A. & Weidig, N. C.')).toEqual(['Ivey, M. A.', 'Weidig, N. C.']);
  });
  it('strips bold markup', () => {
    expect(splitAuthors('**Weidig, N. C.**')).toEqual(['Weidig, N. C.']);
  });
  it('returns empty array for empty input', () => {
    expect(splitAuthors('')).toEqual([]);
  });
});

describe('firstSentence', () => {
  it('cuts at the first sentence boundary past the 40-char minimum', () => {
    const text = 'This is a long enough first sentence to pass the floor. Second sentence.';
    expect(firstSentence(text)).toBe('This is a long enough first sentence to pass the floor.');
  });
  it('does not cut on a period before the 40-char minimum', () => {
    expect(firstSentence('First sentence here. Second sentence.')).toBe(
      'First sentence here. Second sentence.',
    );
  });
  it('collapses whitespace', () => {
    expect(firstSentence('Hello   \n  world.')).toBe('Hello world.');
  });
  it('truncates long text with an ellipsis on a word boundary', () => {
    const long = 'word '.repeat(60).trim();
    const out = firstSentence(long, 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });
  it('returns empty string for undefined', () => {
    expect(firstSentence(undefined)).toBe('');
  });
});
