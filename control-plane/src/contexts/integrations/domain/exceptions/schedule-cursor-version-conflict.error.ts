import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ScheduleCursorVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `The schedule cursor of ${integration} changed since it was loaded. Please try again.`,
    );
    this.name = 'ScheduleCursorVersionConflictError';
  }
}
