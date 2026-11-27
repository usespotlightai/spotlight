import { InvalidAvatarError } from '@identity/domain/exceptions/invalid-avatar.error';

const SHA_256 = /^[0-9a-f]{64}$/;

export class AvatarDigest {
  private readonly kind = 'avatar-digest';

  private constructor(readonly value: string) {}

  static of(value: string): AvatarDigest {
    const parsed = AvatarDigest.parsed(value);

    if (!parsed) {
      throw new InvalidAvatarError('must be named by a SHA-256 digest');
    }

    return parsed;
  }

  static parsed(value: string): AvatarDigest | null {
    return SHA_256.test(value) ? new AvatarDigest(value) : null;
  }

  equals(other: AvatarDigest): boolean {
    return other instanceof AvatarDigest && this.value === other.value;
  }
}
