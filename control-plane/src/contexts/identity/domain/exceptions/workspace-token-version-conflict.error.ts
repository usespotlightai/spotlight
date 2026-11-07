import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceTokenVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(tokenId: string) {
    super(
      `Workspace token ${tokenId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceTokenVersionConflictError';
  }
}
