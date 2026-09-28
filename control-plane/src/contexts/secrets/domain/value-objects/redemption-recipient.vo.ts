import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class RedemptionRecipient {
  private readonly kind = 'redemption-recipient';

  private constructor(readonly key: string) {}

  static of(key: string): RedemptionRecipient {
    if (key.trim().length === 0) {
      throw new InconsistentStateError(
        'redemption recipient',
        'was named with no key',
      );
    }

    return new RedemptionRecipient(key);
  }

  equals(other: RedemptionRecipient): boolean {
    return this.kind === other.kind && this.key === other.key;
  }
}
