import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceRunnersAlreadyExistError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} already has its workspace runners.`);
    this.name = 'WorkspaceRunnersAlreadyExistError';
  }
}
