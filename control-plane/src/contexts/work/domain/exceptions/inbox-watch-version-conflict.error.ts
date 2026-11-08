import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InboxWatchVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(
      `The inbox watch of workspace ${workspaceId} changed while Spotlight read it.`,
    );
    this.name = 'InboxWatchVersionConflictError';
  }
}
