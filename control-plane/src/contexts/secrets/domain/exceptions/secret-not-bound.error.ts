import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretNotBoundError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(secretName: string, host: string) {
    super(`Secret ${secretName} is not bound to ${host}.`);
    this.name = 'SecretNotBoundError';
  }
}
