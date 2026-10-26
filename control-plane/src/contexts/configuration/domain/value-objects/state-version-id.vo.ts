import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class StateVersionId {
  private readonly kind = 'state-version';

  private constructor(readonly value: string) {}

  static of(value: string): StateVersionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('Terraform state version');
    }

    return new StateVersionId(value);
  }

  equals(other: StateVersionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
