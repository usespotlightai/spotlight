import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SearchNotReflectingError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'This search iteration proposes candidates; only an iteration that looks into why the search stalled records causes',
    );
    this.name = 'SearchNotReflectingError';
  }
}
