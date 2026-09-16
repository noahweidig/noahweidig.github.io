import { describe, expect, it } from 'vitest';
import { buildShareTargets } from './share';

describe('buildShareTargets', () => {
  const targets = buildShareTargets('Hello World', 'https://noahweidig.com/blog/x/');

  it('encodes title and url in every target', () => {
    for (const t of targets) {
      expect(t.href).not.toContain(' ');
      expect(t.href).not.toContain('Hello World');
    }
  });

  it('includes the expected platforms', () => {
    expect(targets.map((t) => t.label)).toContain('X');
    expect(targets.map((t) => t.label)).toContain('Email');
  });

  it('builds a working mailto link', () => {
    const email = targets.find((t) => t.label === 'Email')!;
    expect(email.href).toMatch(/^mailto:\?subject=Hello%20World&body=/);
  });
});
