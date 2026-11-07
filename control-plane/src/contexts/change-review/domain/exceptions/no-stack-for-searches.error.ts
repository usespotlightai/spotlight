import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoStackForSearchesError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super('A search run has no change stack. It changes no repository.');
    this.name = 'NoStackForSearchesError';
  }
}
