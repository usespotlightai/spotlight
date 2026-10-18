import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import { describe, expect, it } from 'vitest';

const matching = (pattern: string, claimed: string) =>
  ClaimPattern.of(pattern).matches(claimed);

describe('ClaimPattern', () => {
  it('matches only exactly what it names when it has no *', () => {
    expect(matching('refs/heads/main', 'refs/heads/main')).toBe(true);
    expect(matching('refs/heads/main', 'refs/heads/mainline')).toBe(false);
    expect(matching('refs/heads/main', '')).toBe(false);
  });

  it('lets * match any run of characters, none included', () => {
    expect(matching('refs/heads/*', 'refs/heads/')).toBe(true);
    expect(matching('refs/heads/*', 'refs/heads/release/1.2')).toBe(true);
    expect(matching('*/main', 'refs/heads/main')).toBe(true);
    expect(matching('a*b*c', 'abc')).toBe(true);
    expect(matching('a*b*c', 'axxbyyc')).toBe(true);
    expect(matching('a*b*c', 'axxbyy')).toBe(false);
    expect(matching('a**b', 'ab')).toBe(true);
    expect(matching('*', '')).toBe(true);
  });

  it('treats every other character as itself', () => {
    expect(matching('acme/platform.io', 'acme/platformxio')).toBe(false);
    expect(matching('a+b', 'aab')).toBe(false);
    expect(matching('(x)', '(x)')).toBe(true);
  });

  it('knows where its wildcards start', () => {
    expect(ClaimPattern.of('repo:acme/*:x').literalStart).toBe('repo:acme/');
    expect(ClaimPattern.of('repo:acme/x').isExact).toBe(true);
  });

  it('rejects a blank pattern, one with spaces, or one too long', () => {
    for (const invalid of ['', ' ', 'a b', 'a'.repeat(256)]) {
      expect(() => ClaimPattern.of(invalid)).toThrow(InvalidTokenTrustError);
    }
  });
});
