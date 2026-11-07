import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoSuchWorkspaceError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} not found.`);
    this.name = 'NoSuchWorkspaceError';
  }
}
