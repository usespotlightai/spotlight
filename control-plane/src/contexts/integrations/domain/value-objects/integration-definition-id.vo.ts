import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class IntegrationDefinitionId {
  private readonly kind = 'integration';

  private constructor(readonly value: string) {}

  static of(value: string): IntegrationDefinitionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('integration');
    }
    return new IntegrationDefinitionId(value);
  }

  equals(other: IntegrationDefinitionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
