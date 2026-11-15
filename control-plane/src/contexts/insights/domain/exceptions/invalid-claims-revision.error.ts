import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidClaimsRevisionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A claims revision ${reason}.`);
    this.name = 'InvalidClaimsRevisionError';
  }
}
