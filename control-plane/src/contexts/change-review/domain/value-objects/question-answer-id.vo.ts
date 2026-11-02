import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class QuestionAnswerId {
  private readonly kind = 'question-answer';

  private constructor(readonly value: string) {}

  static of(value: string): QuestionAnswerId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('question answer');
    }
    return new QuestionAnswerId(value);
  }

  equals(other: QuestionAnswerId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
