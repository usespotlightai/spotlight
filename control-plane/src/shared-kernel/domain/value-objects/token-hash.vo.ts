import { InvalidTokenHashError } from '@shared-kernel/domain/exceptions/invalid-token-hash.error';

const SHA_256_HEX = /^[0-9a-f]{64}$/;

export class TokenHash {
  private constructor(readonly value: string) {}

  static of(raw: string): TokenHash {
    if (!SHA_256_HEX.test(raw)) {
      throw new InvalidTokenHashError();
    }
    return new TokenHash(raw);
  }

  equals(other: TokenHash): boolean {
    return this.value === other.value;
  }
}
