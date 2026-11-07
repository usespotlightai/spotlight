import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoSuchSecretError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(secretName: string) {
    super(`Secret ${secretName} not found. Please create it first.`);
    this.name = 'NoSuchSecretError';
  }
}
