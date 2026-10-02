import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class SearchId {
  private readonly kind = 'search';

  private constructor(readonly value: string) {}

  static of(value: string): SearchId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('search');
    }
    return new SearchId(value);
  }

  equals(other: SearchId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
