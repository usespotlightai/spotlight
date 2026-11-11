import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class SandboxId {
  private readonly kind = 'sandbox';

  private constructor(readonly value: string) {}

  static of(value: string): SandboxId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('sandbox');
    }

    return new SandboxId(value);
  }

  equals(other: SandboxId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
