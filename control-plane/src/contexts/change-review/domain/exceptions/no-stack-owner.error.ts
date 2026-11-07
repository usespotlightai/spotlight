import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoStackOwnerError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'A run without a task or a team has no change stack. Nobody could review it.',
    );
    this.name = 'NoStackOwnerError';
  }
}
