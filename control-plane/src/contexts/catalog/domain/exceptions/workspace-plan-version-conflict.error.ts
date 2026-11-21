import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspacePlanVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(
      `The plan of workspace ${workspaceId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspacePlanVersionConflictError';
  }
}
