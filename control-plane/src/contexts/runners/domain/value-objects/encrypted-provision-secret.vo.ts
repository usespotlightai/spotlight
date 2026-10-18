import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class EncryptedProvisionSecret {
  private readonly kind = 'encrypted-provision-secret';

  private constructor(readonly value: string) {}

  static of(ciphertext: string): EncryptedProvisionSecret {
    if (ciphertext.length === 0) {
      throw new InconsistentStateError(
        'encrypted provision secret',
        'has nothing to decrypt',
      );
    }

    return new EncryptedProvisionSecret(ciphertext);
  }

  equals(other: EncryptedProvisionSecret): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
