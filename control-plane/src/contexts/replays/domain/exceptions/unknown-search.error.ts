import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownSearchError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(searchId: string) {
    super(`Search ${searchId} not found.`);
    this.name = 'UnknownSearchError';
  }
}
