import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SearchVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(searchId: string) {
    super(
      `Search ${searchId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SearchVersionConflictError';
  }
}
