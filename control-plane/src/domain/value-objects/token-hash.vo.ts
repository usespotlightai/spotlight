import { InvalidTokenHashError } from '@domain/exceptions/invalid-token-hash.error';

const SHA_256_HEX = /^[0-9a-f]{64}$/;

/** All that is kept of a runner's token. The token itself is never stored. */
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
