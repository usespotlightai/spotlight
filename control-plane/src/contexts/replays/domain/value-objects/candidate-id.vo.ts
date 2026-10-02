import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class CandidateId {
  private readonly kind = 'candidate';

  private constructor(readonly value: string) {}

  static of(value: string): CandidateId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('candidate');
    }
    return new CandidateId(value);
  }

  equals(other: CandidateId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
