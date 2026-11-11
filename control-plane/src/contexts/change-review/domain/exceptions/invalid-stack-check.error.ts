import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStackCheckError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A change stack check ${reason}.`);
    this.name = 'InvalidStackCheckError';
  }
}
