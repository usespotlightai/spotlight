import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WrongCallSecretsTokenError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(id: string) {
    super(`The token does not redeem the secrets of network call ${id}.`);
    this.name = 'WrongCallSecretsTokenError';
  }
}
