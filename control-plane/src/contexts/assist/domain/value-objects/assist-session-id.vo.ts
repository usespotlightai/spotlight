import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class AssistSessionId {
  private readonly kind = 'assist-session';

  private constructor(readonly value: string) {}

  static of(value: string): AssistSessionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('assist session');
    }

    return new AssistSessionId(value);
  }

  equals(other: AssistSessionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
