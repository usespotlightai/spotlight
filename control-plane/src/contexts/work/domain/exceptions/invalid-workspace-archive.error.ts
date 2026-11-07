import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkspaceArchiveError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Workspace archive ${reason}.`);
    this.name = 'InvalidWorkspaceArchiveError';
  }
}
