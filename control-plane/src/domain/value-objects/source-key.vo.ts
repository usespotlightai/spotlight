import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/**
 * One word, lowercase: it is the first part of every happening the source
 * raises and a segment of the address its deliveries knock at, and both would
 * read ambiguously if it could hold a stop or a slash.
 */
const SHAPE = /^[a-z0-9]+$/;

/**
 * The name a host is addressed by. Everything a source has is filed under it:
 * the words it raises, where a workspace reaches it, and the door its
 * deliveries arrive at.
 */
export class SourceKey {
  private readonly kind = 'source-key';

  private constructor(readonly value: string) {}

  static of(raw: string): SourceKey {
    const named = raw.trim();

    if (!SHAPE.test(named)) {
      throw new InvalidIdentifierError(
        'source',
        'is the one word a host is addressed by, as in github',
      );
    }

    return new SourceKey(named);
  }

  /** Whether a word is one of this source's to raise. */
  raises(happening: { readonly source: string }): boolean {
    return happening.source === this.value;
  }

  equals(other: SourceKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
