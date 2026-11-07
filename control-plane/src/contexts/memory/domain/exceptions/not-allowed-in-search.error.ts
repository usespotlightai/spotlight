import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedInSearchError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`A search cannot ${what}.`);
    this.name = 'NotAllowedInSearchError';
  }
}
