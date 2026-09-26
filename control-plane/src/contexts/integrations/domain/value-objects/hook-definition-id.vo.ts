import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HookDefinitionId {
  private readonly kind = 'hook';

  private constructor(readonly value: string) {}

  static of(value: string): HookDefinitionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('hook');
    }
    return new HookDefinitionId(value);
  }

  equals(other: HookDefinitionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
