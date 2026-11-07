import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SearchTakesNoRequestsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(searchId: string) {
    super(`The search ${searchId} takes no more candidates`);
    this.name = 'SearchTakesNoRequestsError';
  }
}
