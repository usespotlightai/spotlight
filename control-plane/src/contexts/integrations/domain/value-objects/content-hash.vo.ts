import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class ContentHash {
  private readonly kind = 'content-hash';

  private constructor(readonly value: string) {}

  static of(raw: string): ContentHash {
    if (!SHA256_HEX.test(raw)) {
      throw new InvalidIdentifierError(
        'content hash',
        'is the sha256 of what was read, in 64 lowercase hex digits',
      );
    }

    return new ContentHash(raw);
  }

  equals(other: ContentHash): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
