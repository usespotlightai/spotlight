import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class Recipient {
  private readonly kind = 'recipient';

  private constructor(readonly key: string) {}

  static of(key: string): Recipient {
    if (key.trim().length === 0) {
      throw new InconsistentStateError('recipient', 'was named with no key');
    }

    return new Recipient(key);
  }

  equals(other: Recipient): boolean {
    return this.kind === other.kind && this.key === other.key;
  }
}
