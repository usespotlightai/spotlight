import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceArchiveTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`Workspace archive ${reason}.`);
    this.name = 'InvalidWorkspaceArchiveTransitionError';
  }
}
