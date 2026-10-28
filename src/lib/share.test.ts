import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShareTargets } from './share.ts';

describe('buildShareTargets', () => {
  const targets = buildShareTargets('Hello World', 'https://noahweidig.com/blog/x/');

  it('encodes title and url in every target', () => {
    for (const t of targets) {
      assert.ok(!t.href.includes(' '));
      assert.ok(!t.href.includes('Hello World'));
    }
  });

  it('includes the expected platforms', () => {
    assert.ok(targets.map((t) => t.label).includes('X'));
    assert.ok(targets.map((t) => t.label).includes('Email'));
  });

  it('builds a working mailto link', () => {
    const email = targets.find((t) => t.label === 'Email')!;
    assert.match(email.href, /^mailto:\?subject=Hello%20World&body=/);
  });
});
