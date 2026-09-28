import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SealedProvisionSecret {
  private readonly kind = 'sealed-provision-secret';

  private constructor(readonly value: string) {}

  static of(sealed: string): SealedProvisionSecret {
    if (sealed.length === 0) {
      throw new InconsistentStateError(
        'sealed provision secret',
        'holds nothing to open',
      );
    }

    return new SealedProvisionSecret(sealed);
  }

  equals(other: SealedProvisionSecret): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
