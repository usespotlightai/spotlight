import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PollCursorVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `The poll cursor of ${integration} changed since it was loaded. Please try again.`,
    );
    this.name = 'PollCursorVersionConflictError';
  }
}
