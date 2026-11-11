import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSearchError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Search ${reason}.`);
    this.name = 'InvalidSearchError';
  }
}
