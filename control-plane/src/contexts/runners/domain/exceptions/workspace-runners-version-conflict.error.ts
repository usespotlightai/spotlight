import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkspaceRunnersVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Workspace runners ${id} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'WorkspaceRunnersVersionConflictError';
  }
}
