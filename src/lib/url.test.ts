import { describe, expect, it } from 'vitest';
import { u } from './url';

describe('u', () => {
  it('prefixes root-relative paths with the base', () => {
    expect(u('/projects/')).toBe('/projects/');
  });
  it('leaves protocol-relative paths alone', () => {
    expect(u('//example.com/x')).toBe('//example.com/x');
  });
  it('leaves non-root-relative paths alone', () => {
    expect(u('mailto:noah@noahweidig.com')).toBe('mailto:noah@noahweidig.com');
  });
});
