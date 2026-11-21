import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSigningSecretError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A signing secret ${because}.`);
    this.name = 'InvalidSigningSecretError';
  }
}
