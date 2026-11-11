import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretNotInjectableError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(secretName: string) {
    super(
      `Secret ${secretName} contains more than one line. It cannot be sent in a request.`,
    );
    this.name = 'SecretNotInjectableError';
  }
}
