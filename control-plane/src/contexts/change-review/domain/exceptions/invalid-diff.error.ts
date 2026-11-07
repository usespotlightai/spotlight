import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDiffError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A diff ${reason}.`);
    this.name = 'InvalidDiffError';
  }
}
