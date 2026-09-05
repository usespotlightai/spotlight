import { RunnerTokenService } from '@infrastructure/auth/runner-token.service';
import { describe, expect, it } from 'vitest';

const tokens = new RunnerTokenService();

describe('RunnerTokenService', () => {
  it('mints a token nobody could guess', () => {
    const { token } = tokens.mint();

    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('never mints the same token twice', () => {
    const minted = new Set(
      Array.from({ length: 100 }, () => tokens.mint().token),
    );

    expect(minted.size).toBe(100);
  });

  it('keeps a hash rather than the token', () => {
    const { token, hash } = tokens.mint();

    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes a token back to what was stored, so it can be looked up', () => {
    const { token, hash } = tokens.mint();

    expect(tokens.hash(token)).toBe(hash);
  });

  it('gives different tokens different hashes', () => {
    expect(tokens.mint().hash).not.toBe(tokens.mint().hash);
  });
});
