import { InvalidTokensError } from '@work/domain/exceptions/invalid-tokens.error';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

describe('Tokens', () => {
  it('keeps each count the harness reported', () => {
    const tokens = Tokens.of({
      input: 3,
      output: 5,
      cacheRead: 120,
      cacheWrite: 0,
    });

    expect(tokens).toMatchObject({
      input: 3,
      output: 5,
      cacheRead: 120,
      cacheWrite: 0,
    });
  });

  it('keeps a count the harness left out as unknown, not zero', () => {
    const tokens = Tokens.of({ input: 3, output: 5, cacheRead: 12 });

    expect(tokens.cacheWrite).toBeNull();
    expect(tokens.cacheRead).toBe(12);
  });

  it('refuses a count that is not a whole number of tokens', () => {
    expect(() => Tokens.of({ input: -1 })).toThrow(InvalidTokensError);
    expect(() => Tokens.of({ output: 2.5 })).toThrow(InvalidTokensError);
  });

  it('adds turns count by count', () => {
    const added = Tokens.of({ input: 3, output: 5, cacheRead: 10 }).plus(
      Tokens.of({ input: 1, output: 2, cacheRead: 20 }),
    );

    expect(added).toMatchObject({
      input: 4,
      output: 7,
      cacheRead: 30,
      cacheWrite: null,
    });
  });

  it('keeps what one turn reported where another reported nothing', () => {
    const added = Tokens.UNREPORTED.plus(
      Tokens.of({ input: 3, output: 5, cacheRead: 0, cacheWrite: 4 }),
    );

    expect(added).toMatchObject({
      input: 3,
      output: 5,
      cacheRead: 0,
      cacheWrite: 4,
    });
  });
});
