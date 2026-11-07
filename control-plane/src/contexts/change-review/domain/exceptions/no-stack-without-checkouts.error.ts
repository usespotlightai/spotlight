import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoStackWithoutCheckoutsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'A run without checkouts has no change stack. It changes no repository.',
    );
    this.name = 'NoStackWithoutCheckoutsError';
  }
}
