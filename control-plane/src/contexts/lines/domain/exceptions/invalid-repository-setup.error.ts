import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRepositorySetupError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository setup ${reason}.`);
    this.name = 'InvalidRepositorySetupError';
  }
}
