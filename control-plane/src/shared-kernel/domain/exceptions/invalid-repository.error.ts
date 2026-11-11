import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRepositoryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository ${reason}.`);
    this.name = 'InvalidRepositoryError';
  }
}
