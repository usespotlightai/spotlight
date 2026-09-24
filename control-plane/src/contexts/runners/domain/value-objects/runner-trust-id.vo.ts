import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class RunnerTrustId {
  private readonly kind = 'runner-trust';

  private constructor(readonly value: string) {}

  static of(value: string): RunnerTrustId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('runner trust');
    }

    return new RunnerTrustId(value);
  }

  equals(other: RunnerTrustId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
