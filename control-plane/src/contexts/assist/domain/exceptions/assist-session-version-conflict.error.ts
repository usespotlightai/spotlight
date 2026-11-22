import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class AssistSessionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'The assist session changed since you loaded it. Please reload and try again.',
    );
    this.name = 'AssistSessionVersionConflictError';
  }
}
