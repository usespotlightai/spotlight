import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class JudgeDisagreementId {
  private readonly kind: string = 'judge-disagreement';

  private constructor(readonly value: string) {}

  static of(value: string): JudgeDisagreementId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('judge disagreement');
    }
    return new JudgeDisagreementId(value);
  }

  equals(other: JudgeDisagreementId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
