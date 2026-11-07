import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretNotGrantedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(secretName: string, host: string) {
    super(`Run has no grant for secret ${secretName}. Host: ${host}`);
    this.name = 'SecretNotGrantedError';
  }
}
