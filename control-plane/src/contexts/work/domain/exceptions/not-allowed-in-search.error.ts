import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotAllowedInSearchError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(
      `A search may not ${what}: it proposes candidates and leaves nothing else behind`,
    );
    this.name = 'NotAllowedInSearchError';
  }
}
