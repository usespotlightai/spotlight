import { InvalidAvatarError } from '@identity/domain/exceptions/invalid-avatar.error';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { describe, expect, it } from 'vitest';

describe('AvatarDigest', () => {
  it('accepts a lowercase SHA-256 hex digest', () => {
    expect(AvatarDigest.of('0f'.repeat(32)).value).toBe('0f'.repeat(32));
  });

  it.each(['', 'a'.repeat(63), 'A'.repeat(64), '../'.padEnd(64, 'a')])(
    'rejects %j',
    (value) => {
      expect(AvatarDigest.parsed(value)).toBeNull();
      expect(() => AvatarDigest.of(value)).toThrow(InvalidAvatarError);
    },
  );

  it('equals a digest with the same value', () => {
    expect(
      AvatarDigest.of('a'.repeat(64)).equals(AvatarDigest.of('a'.repeat(64))),
    ).toBe(true);
    expect(
      AvatarDigest.of('a'.repeat(64)).equals(AvatarDigest.of('b'.repeat(64))),
    ).toBe(false);
  });
});
