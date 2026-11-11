import { capitalised } from '@shared-kernel/domain/capitalised';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReviewError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(what: string) {
    super(`${capitalised(what)} not found.`);
    this.name = 'UnknownReviewError';
  }
}
