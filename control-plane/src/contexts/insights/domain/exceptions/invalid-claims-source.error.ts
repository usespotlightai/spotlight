import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidClaimsSourceError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A claims source ${reason}.`);
    this.name = 'InvalidClaimsSourceError';
  }
}
