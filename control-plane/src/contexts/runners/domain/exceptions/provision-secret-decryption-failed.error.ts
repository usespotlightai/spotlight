import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ProvisionSecretDecryptionFailedError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(poolId: string) {
    super(
      `Cannot decrypt the provision secret of runner pool ${poolId} with the keys of this deployment.`,
    );
    this.name = 'ProvisionSecretDecryptionFailedError';
  }
}
