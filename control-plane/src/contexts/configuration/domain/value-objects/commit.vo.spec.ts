import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

const FULL = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

describe('Commit', () => {
  it('is the name a host gives a commit', () => {
    expect(Commit.of(FULL).value).toBe(FULL);
    expect(Commit.of('a1b2c3d').value).toBe('a1b2c3d');
  });

  it('reads a name a host wrote in capitals just the same', () => {
    expect(Commit.of('A1B2C3D').value).toBe('a1b2c3d');
  });

  it('shows the few characters anybody actually reads', () => {
    expect(Commit.of(FULL).short).toBe('a1b2c3d');
  });

  it('refuses anything that is not one', () => {
    for (const named of ['sha_1', 'a1b2c3', 'zzzzzzz', '', 'main']) {
      expect(() => Commit.of(named)).toThrow(InvalidIdentifierError);
    }
  });

  it('is the same commit as another named the same', () => {
    expect(Commit.of(FULL).equals(Commit.of(FULL))).toBe(true);
    expect(Commit.of(FULL).equals(Commit.of('a1b2c3d'))).toBe(false);
  });
});
