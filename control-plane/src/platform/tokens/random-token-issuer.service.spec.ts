import { RandomTokenIssuer } from '@platform/tokens/random-token-issuer.service';
import { describe, expect, it } from 'vitest';

const tokens = new RandomTokenIssuer();

describe('RandomTokenIssuer', () => {
  it('issues a token nobody could guess', () => {
    const { token } = tokens.issue();

    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('never issues the same token twice', () => {
    const issued = new Set(
      Array.from({ length: 100 }, () => tokens.issue().token),
    );

    expect(issued.size).toBe(100);
  });

  it('keeps a hash rather than the token', () => {
    const { token, hash } = tokens.issue();

    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes a token back to what was stored, so it can be looked up', () => {
    const { token, hash } = tokens.issue();

    expect(tokens.hash(token)).toBe(hash);
  });

  it('gives different tokens different hashes', () => {
    expect(tokens.issue().hash).not.toBe(tokens.issue().hash);
  });
});
