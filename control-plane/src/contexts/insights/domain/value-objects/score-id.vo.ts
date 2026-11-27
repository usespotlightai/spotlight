import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ScoreId {
  private readonly kind = 'score';

  private constructor(readonly value: string) {}

  static of(value: string): ScoreId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('score');
    }
    return new ScoreId(value);
  }

  equals(other: ScoreId): boolean {
    return other instanceof ScoreId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
