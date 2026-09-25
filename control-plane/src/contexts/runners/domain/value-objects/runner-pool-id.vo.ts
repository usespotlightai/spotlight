import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class RunnerPoolId {
  private readonly kind = 'runner-pool';

  private constructor(readonly value: string) {}

  static of(value: string): RunnerPoolId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('runner pool');
    }

    return new RunnerPoolId(value);
  }

  equals(other: RunnerPoolId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
