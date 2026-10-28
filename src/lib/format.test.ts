import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstSentence, inlineMarkup, readingTime, slugify, splitAuthors } from './format.ts';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    assert.equal(slugify('Data Science'), 'data-science');
  });
  it('strips leading/trailing dashes from non-alnum edges', () => {
    assert.equal(slugify('  R & Python! '), 'r-python');
  });
});

describe('inlineMarkup', () => {
  it('escapes html', () => {
    assert.equal(inlineMarkup('<script>&'), '&lt;script&gt;&amp;');
  });
  it('renders bold and italic', () => {
    assert.equal(
      inlineMarkup('**bold** and *italic*'),
      '<strong>bold</strong> and <em>italic</em>',
    );
  });
});

describe('readingTime', () => {
  it('floors at 1 minute', () => {
    assert.equal(readingTime('a few words'), '1 min read');
  });
  it('ignores fenced code blocks', () => {
    assert.equal(
      readingTime('word '.repeat(200) + '```' + 'x '.repeat(1000) + '```'),
      '1 min read',
    );
  });
  it('rounds to nearest minute at ~200wpm', () => {
    assert.equal(readingTime('word '.repeat(400)), '2 min read');
  });
});

describe('splitAuthors', () => {
  it('splits "Surname, Initials" pairs joined by commas and a final &', () => {
    assert.deepEqual(splitAuthors('Ivey, M. A., Wonkka, C. L. & Weidig, N. C.'), [
      'Ivey, M. A.',
      'Wonkka, C. L.',
      'Weidig, N. C.',
    ]);
  });
  it('handles a single author', () => {
    assert.deepEqual(splitAuthors('Weidig, N. C.'), ['Weidig, N. C.']);
  });
  it('handles two authors joined only by &', () => {
    assert.deepEqual(splitAuthors('Ivey, M. A. & Weidig, N. C.'), ['Ivey, M. A.', 'Weidig, N. C.']);
  });
  it('strips bold markup', () => {
    assert.deepEqual(splitAuthors('**Weidig, N. C.**'), ['Weidig, N. C.']);
  });
  it('returns empty array for empty input', () => {
    assert.deepEqual(splitAuthors(''), []);
  });
});

describe('firstSentence', () => {
  it('cuts at the first sentence boundary past the 40-char minimum', () => {
    const text = 'This is a long enough first sentence to pass the floor. Second sentence.';
    assert.equal(firstSentence(text), 'This is a long enough first sentence to pass the floor.');
  });
  it('does not cut on a period before the 40-char minimum', () => {
    assert.equal(
      firstSentence('First sentence here. Second sentence.'),
      'First sentence here. Second sentence.',
    );
  });
  it('collapses whitespace', () => {
    assert.equal(firstSentence('Hello   \n  world.'), 'Hello world.');
  });
  it('truncates long text with an ellipsis on a word boundary', () => {
    const long = 'word '.repeat(60).trim();
    const out = firstSentence(long, 40);
    assert.ok(out.endsWith('…'));
    assert.ok(out.length <= 41);
  });
  it('returns empty string for undefined', () => {
    assert.equal(firstSentence(undefined), '');
  });
});
