import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HookFiringId {
  private readonly kind = 'hook firing';

  private constructor(readonly value: string) {}

  static of(value: string): HookFiringId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('hook firing');
    }
    return new HookFiringId(value);
  }

  equals(other: HookFiringId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
