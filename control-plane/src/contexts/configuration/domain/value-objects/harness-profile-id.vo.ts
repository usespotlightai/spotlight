import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HarnessProfileId {
  private readonly kind = 'harness-profile';

  private constructor(readonly value: string) {}

  static of(value: string): HarnessProfileId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('harness profile');
    }

    return new HarnessProfileId(value);
  }

  equals(other: HarnessProfileId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
