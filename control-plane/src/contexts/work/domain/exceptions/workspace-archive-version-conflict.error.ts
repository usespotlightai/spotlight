import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceArchiveVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace archive ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceArchiveVersionConflictError';
  }
}
