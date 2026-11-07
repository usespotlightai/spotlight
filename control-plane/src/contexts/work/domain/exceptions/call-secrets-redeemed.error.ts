import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class CallSecretsRedeemedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`The secrets of network call ${id} were already redeemed.`);
    this.name = 'CallSecretsRedeemedError';
  }
}
