import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+$/;

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
