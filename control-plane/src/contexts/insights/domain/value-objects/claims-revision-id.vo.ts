import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ClaimsRevisionId {
  private readonly kind: string = 'claims-revision';

  private constructor(readonly value: string) {}

  static of(value: string): ClaimsRevisionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('claims revision');
    }
    return new ClaimsRevisionId(value);
  }

  equals(other: ClaimsRevisionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
