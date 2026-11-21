import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspacePlanAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(
      `Workspace ${workspaceId} already has a plan. Please reload and try again.`,
    );
    this.name = 'WorkspacePlanAlreadyExistsError';
  }
}
